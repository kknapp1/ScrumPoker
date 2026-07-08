const { getConnection, deleteConnection, getConnectionsByRoom,
        getRoom, updateRoom } = require('../lib/db')
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

    // If the departing connection was the moderator, hand the role to
    // another remaining participant so the room isn't left stuck with no
    // moderator (see #101 — this previously only happened on an explicit
    // leave, but idle WebSocket connections time out and disconnect the
    // same way, so the moderator's role must survive here too, not just
    // survive them reconnecting with a brand-new connectionId).
    const room = await getRoom(conn.roomId)
    if (room && room.moderatorConnectionId === connectionId) {
      // No particular ordering guarantee is needed here (there's no
      // meaningful "next in line" concept for this tool) — remaining[0]
      // is whatever DynamoDB's roomId-index query happens to return
      // first. Picking anyone deterministically beats leaving the room
      // moderator-less, which is the bug being fixed.
      const newModerator = remaining[0]
      if (newModerator) {
        await updateRoom(conn.roomId, { moderatorConnectionId: newModerator.connectionId })
        await broadcastToRoom(event, remaining, {
          type: 'MODERATOR_CHANGED',
          userName: newModerator.userName,
        })
      }
    }

    return { statusCode: 200 }
  } catch (err) {
    console.error('disconnect error:', err)
    return { statusCode: 500 }
  }
}
