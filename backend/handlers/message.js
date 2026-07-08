/**
 * sendmessage route — single entry point for all client-to-server events.
 * Routes to sub-handlers based on message.type.
 *
 * Expected payload: { type: string, ...payload }
 */
const { getConnection, getConnectionsByRoom, getRoom, updateRoom,
        saveVote, getVotesByRoom, deleteVotesByRoom } = require('../lib/db')
const { broadcastToRoom, makeClient, sendTo } = require('../lib/broadcast')
const { VALID_DECK_KEYS } = require('../lib/constants')

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId
  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { type, ...payload } = body

  try {
    const conn = await getConnection(connectionId)
    if (!conn) return { statusCode: 400, body: 'Unknown connection' }

    const { roomId, userName } = conn

    switch (type) {
      case 'VOTE':
        return handleVote(event, connectionId, roomId, userName, payload.value)

      case 'REVEAL':
        return handleReveal(event, connectionId, roomId)

      case 'RESET':
        return handleReset(event, connectionId, roomId)

      case 'UPDATE_STORY':
        return handleUpdateStory(event, connectionId, roomId, payload.storyName)

      case 'SET_DECK':
        return handleSetDeck(event, connectionId, roomId, payload.deckKey)

      case 'REQUEST_ROOM_STATE':
        return handleRequestRoomState(event, connectionId, roomId)

      case 'CLAIM_MODERATOR':
        return handleClaimModerator(event, connectionId, roomId, userName)

      default:
        return { statusCode: 400, body: `Unknown message type: ${type}` }
    }
  } catch (err) {
    console.error('message error:', err)
    return { statusCode: 500 }
  }
}

async function handleVote(event, connectionId, roomId, userName, value) {
  const room = await getRoom(roomId)
  if (!room || room.status !== 'voting') {
    const apigw = makeClient(event)
    await sendTo(apigw, connectionId, { type: 'ERROR', message: 'Voting is not open' })
    return { statusCode: 200 }
  }

  await saveVote(roomId, connectionId, userName, value)
  const connections = await getConnectionsByRoom(roomId)

  // Broadcast that this user voted (without revealing the value)
  await broadcastToRoom(event, connections, {
    type: 'VOTE_CAST',
    userName,
  })

  return { statusCode: 200 }
}

// Fetches the room and checks the requester is its moderator, sending an
// ERROR back to them (and returning isModerator: false) if not. Callers
// should bail out on isModerator: false without taking the action.
async function requireModerator(event, connectionId, roomId, actionLabel) {
  const room = await getRoom(roomId)
  if (!room) return { room: null, isModerator: false }

  if (room.moderatorConnectionId !== connectionId) {
    const apigw = makeClient(event)
    await sendTo(apigw, connectionId, {
      type: 'ERROR',
      message: `Only the moderator can ${actionLabel}`,
    })
    return { room, isModerator: false }
  }

  return { room, isModerator: true }
}

async function handleReveal(event, connectionId, roomId) {
  const { room, isModerator } = await requireModerator(event, connectionId, roomId, 'reveal votes')
  if (!room) return { statusCode: 404 }
  if (!isModerator) return { statusCode: 200 }

  if (room.status !== 'voting') return { statusCode: 200 }

  await updateRoom(roomId, { status: 'revealed' })

  const [connections, votes] = await Promise.all([
    getConnectionsByRoom(roomId),
    getVotesByRoom(roomId),
  ])

  const voteMap = Object.fromEntries(votes.map(v => [v.userName, v.value]))

  await broadcastToRoom(event, connections, {
    type: 'VOTES_REVEALED',
    votes: voteMap,
  })

  return { statusCode: 200 }
}

async function handleReset(event, connectionId, roomId) {
  const { room, isModerator } = await requireModerator(event, connectionId, roomId, 'reset the round')
  if (!room) return { statusCode: 404 }
  if (!isModerator) return { statusCode: 200 }

  await Promise.all([
    updateRoom(roomId, { status: 'voting', storyName: '' }),
    deleteVotesByRoom(roomId),
  ])

  const connections = await getConnectionsByRoom(roomId)
  await broadcastToRoom(event, connections, { type: 'ROUND_RESET' })

  return { statusCode: 200 }
}

async function handleSetDeck(event, connectionId, roomId, deckKey) {
  const { room, isModerator } = await requireModerator(event, connectionId, roomId, 'change the deck')
  if (!room) return { statusCode: 404 }
  if (!isModerator) return { statusCode: 200 }

  if (!VALID_DECK_KEYS.includes(deckKey)) {
    const apigw = makeClient(event)
    await sendTo(apigw, connectionId, { type: 'ERROR', message: 'Invalid deck' })
    return { statusCode: 200 }
  }

  await updateRoom(roomId, { deckKey })

  const connections = await getConnectionsByRoom(roomId)
  await broadcastToRoom(event, connections, {
    type: 'DECK_UPDATED',
    deckKey,
  })

  return { statusCode: 200 }
}

async function handleRequestRoomState(event, connectionId, roomId) {
  const room = await getRoom(roomId)
  if (!room) return { statusCode: 404 }

  const [connections, votes] = await Promise.all([
    getConnectionsByRoom(roomId),
    getVotesByRoom(roomId),
  ])
  const voteMap = Object.fromEntries(votes.map(v => [v.userName, v.value]))

  const apigw = makeClient(event)
  await sendTo(apigw, connectionId, {
    type: 'ROOM_STATE',
    room: {
      roomId: room.roomId,
      status: room.status,
      storyName: room.storyName,
      deckKey: room.deckKey,
      isModerator: room.moderatorConnectionId === connectionId,
      hasActiveModerator: connections.some(c => c.connectionId === room.moderatorConnectionId),
      participants: connections.map(c => ({
        userName: c.userName,
        hasVoted: voteMap[c.userName] !== undefined,
        // Only reveal actual values once the room is in 'revealed' state —
        // matches VOTES_REVEALED's behavior for anyone joining/reconnecting
        // after the reveal already happened.
        value: room.status === 'revealed' ? voteMap[c.userName] ?? null : undefined,
      })),
    },
  })

  return { statusCode: 200 }
}

async function handleUpdateStory(event, connectionId, roomId, storyName) {
  const { room, isModerator } = await requireModerator(event, connectionId, roomId, 'set the story name')
  if (!room) return { statusCode: 404 }
  if (!isModerator) return { statusCode: 200 }

  const name = (storyName || '').trim().slice(0, 120)
  await updateRoom(roomId, { storyName: name })

  const connections = await getConnectionsByRoom(roomId)
  await broadcastToRoom(event, connections, {
    type: 'STORY_UPDATED',
    storyName: name,
  })

  return { statusCode: 200 }
}

// Workaround for cases where the moderator's connection dies without an
// explicit disconnect (idle timeout, dropped network, browser crash) —
// disconnect.js deliberately does NOT auto-reassign the moderator in
// those cases (see disconnect.js's isExplicitDisconnect), since that
// connection may still reconnect momentarily and shouldn't lose the role
// to a race. If the moderator's connection is confirmed gone (no longer
// among the room's live connections), any remaining participant can
// claim the role instead of the room being stuck moderator-less forever.
async function handleClaimModerator(event, connectionId, roomId, userName) {
  const room = await getRoom(roomId)
  if (!room) return { statusCode: 404 }

  const connections = await getConnectionsByRoom(roomId)
  const moderatorStillConnected = connections.some(c => c.connectionId === room.moderatorConnectionId)

  if (moderatorStillConnected) {
    const apigw = makeClient(event)
    await sendTo(apigw, connectionId, {
      type: 'ERROR',
      message: 'The moderator is still connected',
    })
    return { statusCode: 200 }
  }

  await updateRoom(roomId, { moderatorConnectionId: connectionId })
  await broadcastToRoom(event, connections, {
    type: 'MODERATOR_CHANGED',
    userName,
  })

  return { statusCode: 200 }
}