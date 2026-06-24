/**
 * sendmessage route — single entry point for all client-to-server events.
 * Routes to sub-handlers based on message.type.
 *
 * Expected payload: { type: string, ...payload }
 */
const { getConnection, getConnectionsByRoom, getRoom, updateRoom,
        saveVote, getVotesByRoom, deleteVotesByRoom } = require('../lib/db')
const { broadcastToRoom, makeClient, sendTo } = require('../lib/broadcast')

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

      case 'REQUEST_ROOM_STATE':
        return handleRequestRoomState(event, connectionId, roomId)

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

async function handleReveal(event, connectionId, roomId) {
  const room = await getRoom(roomId)
  if (!room) return { statusCode: 404 }

  // Phase 3: enforce moderator-only. For now any participant can reveal.
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
  // Phase 3: enforce moderator-only. For now any participant can reset.
  await Promise.all([
    updateRoom(roomId, { status: 'voting', storyName: '' }),
    deleteVotesByRoom(roomId),
  ])

  const connections = await getConnectionsByRoom(roomId)
  await broadcastToRoom(event, connections, { type: 'ROUND_RESET' })

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
  const name = (storyName || '').trim().slice(0, 120)
  await updateRoom(roomId, { storyName: name })

  const connections = await getConnectionsByRoom(roomId)
  await broadcastToRoom(event, connections, {
    type: 'STORY_UPDATED',
    storyName: name,
  })

  return { statusCode: 200 }
}
