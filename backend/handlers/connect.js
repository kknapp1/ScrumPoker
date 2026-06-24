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
const { broadcastToRoom } = require('../lib/broadcast')
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

    // Note: we deliberately do NOT PostToConnection back to connectionId
    // here. API Gateway's WebSocket Management API cannot send to the
    // connection that's still inside its own $connect invocation — the
    // two-way channel isn't established until $connect returns, so any
    // send attempt fails with a 410 GoneException (and would incorrectly
    // delete this brand-new connection via sendTo's 410 cleanup). The
    // client requests its own ROOM_STATE via a REQUEST_ROOM_STATE message
    // (see message.js) right after the connection's open event fires.

    return { statusCode: 200 }
  } catch (err) {
    console.error('connect error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }
}
