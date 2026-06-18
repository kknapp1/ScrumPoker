const { getConnection, deleteConnection, getConnectionsByRoom } = require('../lib/db')
const { broadcastToRoom } = require('../lib/broadcast')

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId

  try {
    const conn = await getConnection(connectionId)
    if (!conn) return { statusCode: 200 }

    await deleteConnection(connectionId)

    const remaining = await getConnectionsByRoom(conn.roomId)

    // Notify remaining participants
    await broadcastToRoom(event, remaining, {
      type: 'PARTICIPANT_LEFT',
      userName: conn.userName,
      participantCount: remaining.length,
    })

    return { statusCode: 200 }
  } catch (err) {
    console.error('disconnect error:', err)
    return { statusCode: 500 }
  }
}
