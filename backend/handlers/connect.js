/**
 * $connect route handler.
 *
 * Query params expected on the WebSocket URL:
 *   ?roomId=12345678&userName=Alex
 *
 * Enforces the 50-participant limit.
 * Creates the room if it doesn't exist (first joiner becomes moderator).
 */
const { getRoom, createRoom, updateRoom, saveConnection,
        getConnectionsByRoom } = require('../lib/db')
const { broadcastToRoom, makeClient, sendTo } = require('../lib/broadcast')
const { MAX_PARTICIPANTS } = require('../lib/constants')

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId
  const { roomId, userName } = event.queryStringParameters || {}

  if (!roomId || !userName) {
    return { statusCode: 400, body: 'Missing roomId or userName' }
  }

  if (userName.trim().length === 0 || userName.length > 32) {
    return { statusCode: 400, body: 'Invalid userName' }
  }

  try {
    const connections = await getConnectionsByRoom(roomId)

    // Enforce participant limit
    if (connections.length >= MAX_PARTICIPANTS) {
      // Future: allow view-only mode instead of hard rejection
      return { statusCode: 403, body: `Room is full (max ${MAX_PARTICIPANTS} participants)` }
    }

    let room = await getRoom(roomId)
    if (!room) {
      // First joiner creates the room and becomes moderator
      room = await createRoom(roomId, connectionId)
    } else {
      // Bump TTL on activity
      await updateRoom(roomId, { lastActivityAt: Date.now() })
    }

    await saveConnection(connectionId, roomId, userName.trim())

    // Get updated connections list (including this new one)
    const allConnections = await getConnectionsByRoom(roomId)

    // Notify existing participants of the new joiner
    await broadcastToRoom(event, connections, {
      type: 'PARTICIPANT_JOINED',
      userName: userName.trim(),
      participantCount: allConnections.length,
    })

    // Send current room state to the new joiner
    const apigw = makeClient(event)
    await sendTo(apigw, connectionId, {
      type: 'ROOM_STATE',
      room: {
        roomId: room.roomId,
        status: room.status,
        storyName: room.storyName,
        deckKey: room.deckKey,
        isModerator: room.moderatorConnectionId === connectionId,
        participants: allConnections.map(c => ({
          userName: c.userName,
          hasVoted: false, // votes are hidden until reveal
        })),
      },
    })

    return { statusCode: 200 }
  } catch (err) {
    console.error('connect error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }
}
