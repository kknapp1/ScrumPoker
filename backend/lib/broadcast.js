/**
 * broadcast — sends a JSON message to one or all connections in a room.
 * Stale connections (410 Gone) are cleaned up automatically.
 */
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { deleteConnection } = require('./db')

function makeClient(event) {
  const domain = event.requestContext.domainName
  const stage  = event.requestContext.stage
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`,
  })
}

async function sendTo(apigw, connectionId, payload) {
  try {
    await apigw.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(payload)),
    }))
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 410) {
      // Connection gone — clean up
      await deleteConnection(connectionId).catch(() => {})
    } else {
      console.error(`Failed to send to ${connectionId}:`, err)
    }
  }
}

async function broadcastToRoom(event, connections, payload, excludeConnectionId = null) {
  const apigw = makeClient(event)
  await Promise.all(
    connections
      .filter(c => c.connectionId !== excludeConnectionId)
      .map(c => sendTo(apigw, c.connectionId, payload))
  )
}

module.exports = { broadcastToRoom, sendTo, makeClient }
