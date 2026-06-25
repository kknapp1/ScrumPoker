const { test } = require('node:test')
const assert = require('node:assert')
const db = require('../lib/db')
const broadcast = require('../lib/broadcast')
const { freshRequire } = require('./test-helpers')

function event(connectionId, body) {
  return {
    requestContext: { connectionId, domainName: 'example.execute-api.us-east-2.amazonaws.com', stage: 'sandbox' },
    body: JSON.stringify(body),
  }
}

function handler() {
  return freshRequire('./message.js').handler
}

function mockConnection(t, { connectionId = 'c1', roomId = '123', userName = 'Alice' } = {}) {
  t.mock.method(db, 'getConnection', async () => ({ connectionId, roomId, userName }))
}

test('rejects invalid JSON body', async () => {
  const result = await handler()({ requestContext: { connectionId: 'c1' }, body: '{not json' })
  assert.strictEqual(result.statusCode, 400)
})

test('rejects an unknown connection', async (t) => {
  t.mock.method(db, 'getConnection', async () => undefined)
  const result = await handler()(event('ghost', { type: 'VOTE', value: '5' }))
  assert.strictEqual(result.statusCode, 400)
})

test('VOTE: rejected with an ERROR when the room is not in voting status', async (t) => {
  mockConnection(t)
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', status: 'revealed' }))
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})
  const saveVoteMock = t.mock.method(db, 'saveVote', async () => {})

  await handler()(event('c1', { type: 'VOTE', value: '5' }))

  assert.strictEqual(saveVoteMock.mock.callCount(), 0)
  assert.strictEqual(sendToMock.mock.callCount(), 1)
  assert.strictEqual(sendToMock.mock.calls[0].arguments[2].type, 'ERROR')
})

test('VOTE: saves the vote and broadcasts VOTE_CAST without the value', async (t) => {
  mockConnection(t)
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', status: 'voting' }))
  const saveVoteMock = t.mock.method(db, 'saveVote', async () => {})
  t.mock.method(db, 'getConnectionsByRoom', async () => [{ connectionId: 'c1', userName: 'Alice' }])
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1', { type: 'VOTE', value: '5' }))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(saveVoteMock.mock.callCount(), 1)
  const payload = broadcastMock.mock.calls[0].arguments[2]
  assert.strictEqual(payload.type, 'VOTE_CAST')
  assert.strictEqual(payload.userName, 'Alice')
  assert.strictEqual(payload.value, undefined) // value must never leak pre-reveal
})

test('REVEAL: non-moderator is rejected with an ERROR, room state unchanged', async (t) => {
  mockConnection(t, { connectionId: 'c2' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', status: 'voting', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})

  const result = await handler()(event('c2', { type: 'REVEAL' }))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
  assert.strictEqual(sendToMock.mock.callCount(), 1)
  assert.match(sendToMock.mock.calls[0].arguments[2].message, /moderator/i)
})

test('REVEAL: moderator succeeds, room set to revealed, votes broadcast', async (t) => {
  mockConnection(t, { connectionId: 'c1' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', status: 'voting', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  t.mock.method(db, 'getConnectionsByRoom', async () => [{ connectionId: 'c1', userName: 'Alice' }])
  t.mock.method(db, 'getVotesByRoom', async () => [{ userName: 'Alice', value: '5' }])
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1', { type: 'REVEAL' }))

  assert.strictEqual(result.statusCode, 200)
  assert.deepStrictEqual(updateRoomMock.mock.calls[0].arguments[1], { status: 'revealed' })
  const payload = broadcastMock.mock.calls[0].arguments[2]
  assert.strictEqual(payload.type, 'VOTES_REVEALED')
  assert.deepStrictEqual(payload.votes, { Alice: '5' })
})

test('RESET: non-moderator is rejected with an ERROR', async (t) => {
  mockConnection(t, { connectionId: 'c2' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const deleteVotesMock = t.mock.method(db, 'deleteVotesByRoom', async () => {})
  t.mock.method(broadcast, 'sendTo', async () => {})

  const result = await handler()(event('c2', { type: 'RESET' }))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
  assert.strictEqual(deleteVotesMock.mock.callCount(), 0)
})

test('RESET: moderator succeeds, clears votes and story, broadcasts ROUND_RESET', async (t) => {
  mockConnection(t, { connectionId: 'c1' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const deleteVotesMock = t.mock.method(db, 'deleteVotesByRoom', async () => {})
  t.mock.method(db, 'getConnectionsByRoom', async () => [])
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1', { type: 'RESET' }))

  assert.strictEqual(result.statusCode, 200)
  assert.deepStrictEqual(updateRoomMock.mock.calls[0].arguments[1], { status: 'voting', storyName: '' })
  assert.strictEqual(deleteVotesMock.mock.callCount(), 1)
  assert.strictEqual(broadcastMock.mock.calls[0].arguments[2].type, 'ROUND_RESET')
})

test('SET_DECK: non-moderator is rejected with an ERROR', async (t) => {
  mockConnection(t, { connectionId: 'c2' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  t.mock.method(broadcast, 'sendTo', async () => {})

  const result = await handler()(event('c2', { type: 'SET_DECK', deckKey: 'tshirt' }))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
})

test('SET_DECK: moderator with an invalid deck key is rejected with an ERROR', async (t) => {
  mockConnection(t, { connectionId: 'c1' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})

  const result = await handler()(event('c1', { type: 'SET_DECK', deckKey: 'not-a-real-deck' }))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
  assert.match(sendToMock.mock.calls[0].arguments[2].message, /invalid deck/i)
})

test('SET_DECK: moderator with a valid deck key succeeds and broadcasts DECK_UPDATED', async (t) => {
  mockConnection(t, { connectionId: 'c1' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  t.mock.method(db, 'getConnectionsByRoom', async () => [])
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1', { type: 'SET_DECK', deckKey: 'tshirt' }))

  assert.strictEqual(result.statusCode, 200)
  assert.deepStrictEqual(updateRoomMock.mock.calls[0].arguments[1], { deckKey: 'tshirt' })
  const payload = broadcastMock.mock.calls[0].arguments[2]
  assert.strictEqual(payload.type, 'DECK_UPDATED')
  assert.strictEqual(payload.deckKey, 'tshirt')
})

test('UPDATE_STORY: non-moderator is rejected with an ERROR', async (t) => {
  mockConnection(t, { connectionId: 'c2' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})

  const result = await handler()(event('c2', { type: 'UPDATE_STORY', storyName: 'Some story' }))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
  assert.strictEqual(sendToMock.mock.callCount(), 1)
  assert.match(sendToMock.mock.calls[0].arguments[2].message, /moderator/i)
})

test('UPDATE_STORY: moderator trims and caps story name at 120 chars, broadcasts STORY_UPDATED', async (t) => {
  mockConnection(t, { connectionId: 'c1' })
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  t.mock.method(db, 'getConnectionsByRoom', async () => [])
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const longName = '  ' + 'x'.repeat(200) + '  '
  await handler()(event('c1', { type: 'UPDATE_STORY', storyName: longName }))

  const saved = updateRoomMock.mock.calls[0].arguments[1].storyName
  assert.strictEqual(saved.length, 120)
  assert.strictEqual(broadcastMock.mock.calls[0].arguments[2].type, 'STORY_UPDATED')
})

test('REQUEST_ROOM_STATE: hasVoted reflects real votes, value only included once revealed', async (t) => {
  mockConnection(t, { connectionId: 'c1', userName: 'Alice' })
  t.mock.method(db, 'getRoom', async () => ({
    roomId: '123', status: 'voting', storyName: '', deckKey: 'fibonacci', moderatorConnectionId: 'c1',
  }))
  t.mock.method(db, 'getConnectionsByRoom', async () => [
    { connectionId: 'c1', userName: 'Alice' },
    { connectionId: 'c2', userName: 'Bob' },
  ])
  t.mock.method(db, 'getVotesByRoom', async () => [{ userName: 'Alice', value: '5' }])
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})

  await handler()(event('c1', { type: 'REQUEST_ROOM_STATE' }))

  const payload = sendToMock.mock.calls[0].arguments[2]
  assert.strictEqual(payload.type, 'ROOM_STATE')
  assert.strictEqual(payload.room.isModerator, true)
  const alice = payload.room.participants.find(p => p.userName === 'Alice')
  const bob = payload.room.participants.find(p => p.userName === 'Bob')
  assert.strictEqual(alice.hasVoted, true)
  assert.strictEqual(alice.value, undefined) // not revealed yet — value hidden
  assert.strictEqual(bob.hasVoted, false)
})

test('REQUEST_ROOM_STATE: includes actual vote values once the room is revealed', async (t) => {
  mockConnection(t, { connectionId: 'c1', userName: 'Alice' })
  t.mock.method(db, 'getRoom', async () => ({
    roomId: '123', status: 'revealed', storyName: '', deckKey: 'fibonacci', moderatorConnectionId: 'c1',
  }))
  t.mock.method(db, 'getConnectionsByRoom', async () => [{ connectionId: 'c1', userName: 'Alice' }])
  t.mock.method(db, 'getVotesByRoom', async () => [{ userName: 'Alice', value: '5' }])
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})

  await handler()(event('c1', { type: 'REQUEST_ROOM_STATE' }))

  const alice = sendToMock.mock.calls[0].arguments[2].room.participants[0]
  assert.strictEqual(alice.value, '5')
})

test('rejects an unknown message type', async (t) => {
  mockConnection(t)
  const result = await handler()(event('c1', { type: 'NOT_A_REAL_TYPE' }))
  assert.strictEqual(result.statusCode, 400)
})
