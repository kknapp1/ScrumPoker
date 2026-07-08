const { getConnection, deleteConnection, getConnectionsByRoom,
        getRoom, updateRoom } = require('../lib/db')
const { broadcastToRoom } = require('../lib/broadcast')

// API Gateway populates requestContext.disconnectStatusCode/disconnectReason
// on $disconnect based on the WebSocket close frame it saw:
//   1000 "Normal Closure"  — the client (or our own onbeforeunload/route
//                            change cleanup) initiated the close itself,
//                            e.g. frontend's `socket.close(1000)`.
//   1001 "Going Away" with reason "Connection idleTimeout" — API Gateway
//                            itself closed the connection after its idle
//                            timeout elapsed, not the client.
//   1006 / undefined       — abnormal closure (network drop, browser
//                            crash, etc.) — API Gateway never saw a close
//                            frame at all.
// Only a 1000 tells us the participant actually chose to leave; anything
// else (including idle timeouts and dropped connections that will very
// likely reconnect momentarily) must NOT trigger reassignment, or an
// idle moderator would keep losing their role to a reconnect race (#101
// follow-up). For those cases, any participant can claim an unattended
// moderator role via the CLAIM_MODERATOR message (see message.js).
function isExplicitDisconnect(event) {
  return event.requestContext?.disconnectStatusCode === 1000
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId

  try {
    const conn = await getConnection(connectionId)
    if (!conn) return { statusCode: 200 }

    await deleteConnection(connectionId)

    const room = await getRoom(conn.roomId)
    const wasModerator = !!room && room.moderatorConnectionId === connectionId
    const remaining = await getConnectionsByRoom(conn.roomId)

    // Notify remaining participants. wasModerator lets already-connected
    // clients immediately show the "claim moderator" workaround if this
    // wasn't an explicit disconnect (so no MODERATOR_CHANGED follows) —
    // without it they'd have no way to know the moderator is gone until
    // their own reconnect re-requests ROOM_STATE.
    await broadcastToRoom(event, remaining, {
      type: 'PARTICIPANT_LEFT',
      userName: conn.userName,
      participantCount: remaining.length,
      wasModerator,
    })

    // If the departing connection was the moderator AND they explicitly
    // disconnected (not an idle timeout or dropped connection — see
    // isExplicitDisconnect above), hand the role to another remaining
    // participant so the room isn't left stuck with no moderator (#101).
    if (wasModerator && isExplicitDisconnect(event)) {
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
