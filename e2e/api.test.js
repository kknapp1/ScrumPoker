/**
 * Post-deployment API functional tests — run against a REAL deployed
 * sandbox WebSocket endpoint (not mocked), formalizing the manual
 * verification scripts used during Phase 2/3 development. Requires
 * WS_ENDPOINT (e.g. wss://xxxx.execute-api.us-east-2.amazonaws.com/sandbox).
 */
const { test, describe, before } = require('node:test')
const assert = require('node:assert')
const WebSocket = require('ws')

const WS_ENDPOINT = process.env.WS_ENDPOINT

before(() => {
  if (!WS_ENDPOINT) {
    throw new Error('WS_ENDPOINT env var is required (the deployed API Gateway WebSocket URL)')
  }
})

function randomRoomId() {
  return String(Math.floor(10000000 + Math.random() * 90000000))
}

function connect(roomId, userName) {
  return new WebSocket(`${WS_ENDPOINT}?roomId=${roomId}&userName=${userName}`)
}

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
}

function waitForMessage(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for message matching ${predicate}`)), timeoutMs)
    function onMessage(data) {
      const msg = JSON.parse(data.toString())
      if (predicate(msg)) {
        clearTimeout(timer)
        ws.off('message', onMessage)
        resolve(msg)
      }
    }
    ws.on('message', onMessage)
  })
}

function waitForClose(ws, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) return resolve({ code: ws._closeCode })
    ws.once('close', (code, reason) => resolve({ code, reason: reason.toString() }))
    setTimeout(() => resolve({ code: null, timedOut: true }), timeoutMs)
  })
}

describe('WebSocket protocol — connect, vote, reveal, reset, disconnect', () => {
  test('full round trip between two participants', async () => {
    const roomId = randomRoomId()

    const alice = connect(roomId, 'Alice')
    await waitForOpen(alice)
    alice.send(JSON.stringify({ type: 'REQUEST_ROOM_STATE' }))
    const aliceState = await waitForMessage(alice, m => m.type === 'ROOM_STATE')
    assert.strictEqual(aliceState.room.isModerator, true)

    // Must attach this listener BEFORE Bob connects — connect.js broadcasts
    // PARTICIPANT_JOINED from within Bob's own $connect invocation, which
    // can complete (and the message arrive at Alice's socket) before Bob's
    // own 'open' event fires client-side. Registering the listener only
    // after awaiting Bob's open would race losing the message.
    const joinedMsg = waitForMessage(alice, m => m.type === 'PARTICIPANT_JOINED' && m.userName === 'Bob')
    const bob = connect(roomId, 'Bob')
    await waitForOpen(bob)
    bob.send(JSON.stringify({ type: 'REQUEST_ROOM_STATE' }))
    const bobState = await waitForMessage(bob, m => m.type === 'ROOM_STATE')
    assert.strictEqual(bobState.room.isModerator, false)
    await joinedMsg

    bob.send(JSON.stringify({ type: 'VOTE', value: '5' }))
    const aliceSawVote = await waitForMessage(alice, m => m.type === 'VOTE_CAST' && m.userName === 'Bob')
    assert.strictEqual(aliceSawVote.userName, 'Bob')

    alice.send(JSON.stringify({ type: 'REVEAL' }))
    const revealed = await waitForMessage(bob, m => m.type === 'VOTES_REVEALED')
    assert.strictEqual(revealed.votes.Bob, '5')

    alice.send(JSON.stringify({ type: 'RESET' }))
    await waitForMessage(bob, m => m.type === 'ROUND_RESET')

    bob.close(1000)
    await waitForMessage(alice, m => m.type === 'PARTICIPANT_LEFT' && m.userName === 'Bob')
    alice.close(1000)
  })

  test('non-moderator REVEAL/RESET/SET_DECK are rejected with an ERROR', async () => {
    const roomId = randomRoomId()
    const alice = connect(roomId, 'Alice')
    await waitForOpen(alice)
    const bob = connect(roomId, 'Bob')
    await waitForOpen(bob)

    bob.send(JSON.stringify({ type: 'REVEAL' }))
    const revealError = await waitForMessage(bob, m => m.type === 'ERROR')
    assert.match(revealError.message, /moderator/i)

    bob.send(JSON.stringify({ type: 'RESET' }))
    const resetError = await waitForMessage(bob, m => m.type === 'ERROR')
    assert.match(resetError.message, /moderator/i)

    bob.send(JSON.stringify({ type: 'SET_DECK', deckKey: 'tshirt' }))
    const deckError = await waitForMessage(bob, m => m.type === 'ERROR')
    assert.match(deckError.message, /moderator/i)

    alice.close(1000)
    bob.close(1000)
  })

  test('moderator SET_DECK with a valid key broadcasts DECK_UPDATED to everyone', async () => {
    const roomId = randomRoomId()
    const alice = connect(roomId, 'Alice')
    await waitForOpen(alice)
    const bob = connect(roomId, 'Bob')
    await waitForOpen(bob)

    alice.send(JSON.stringify({ type: 'SET_DECK', deckKey: 'tshirt' }))
    const [aliceMsg, bobMsg] = await Promise.all([
      waitForMessage(alice, m => m.type === 'DECK_UPDATED'),
      waitForMessage(bob, m => m.type === 'DECK_UPDATED'),
    ])
    assert.strictEqual(aliceMsg.deckKey, 'tshirt')
    assert.strictEqual(bobMsg.deckKey, 'tshirt')

    alice.close(1000)
    bob.close(1000)
  })

  // Regression test for #14 (reconnect/rejoin): close a connection
  // mid-session and reconnect with the same roomId/userName — the server
  // has no special "session" concept, so this just confirms a fresh
  // $connect with the same identity is treated as a normal (re)join.
  test('reconnecting with the same roomId/userName rejoins cleanly', async () => {
    const roomId = randomRoomId()
    const alice = connect(roomId, 'Alice')
    await waitForOpen(alice)

    alice.close(1000)
    await waitForClose(alice)

    const aliceAgain = connect(roomId, 'Alice')
    await waitForOpen(aliceAgain)
    aliceAgain.send(JSON.stringify({ type: 'REQUEST_ROOM_STATE' }))
    const state = await waitForMessage(aliceAgain, m => m.type === 'ROOM_STATE')
    assert.strictEqual(state.room.participants.some(p => p.userName === 'Alice'), true)

    aliceAgain.close(1000)
  })
})

describe('50-participant limit', () => {
  test('the 51st connection is rejected without disrupting the other 50', async () => {
    const roomId = randomRoomId()
    const sockets = []
    for (let i = 1; i <= 50; i++) {
      const ws = connect(roomId, `User${i}`)
      await waitForOpen(ws)
      sockets.push(ws)
    }

    const overflow = connect(roomId, 'Overflow')
    const closeResult = await new Promise((resolve) => {
      let opened = false
      overflow.once('open', () => { opened = true })
      overflow.once('close', (code) => resolve({ code, opened }))
      overflow.once('error', () => {})
    })
    assert.strictEqual(closeResult.opened, false)

    // None of the original 50 should have been disturbed.
    const stillOpen = sockets.filter(s => s.readyState === WebSocket.OPEN)
    assert.strictEqual(stillOpen.length, 50)

    await Promise.all(sockets.map(s => new Promise((resolve) => {
      s.once('close', resolve)
      s.close(1000)
    })))
  })
})
