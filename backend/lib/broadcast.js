/**
 * broadcast — sends a JSON message to one or all connections in a room.
 * Stale connections (410 Gone) are cleaned up automatically.
 */
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { deleteConnection } = require('./db')

// Cached per warm container, keyed by endpoint. The domain/stage are the
// same for every invocation against this API, so constructing a fresh
// client (and triggering a fresh DNS lookup) on every single call was
// the real cause of intermittent "getaddrinfo EBUSY" failures observed
// under load — retrying within one invocation didn't help, since the
// underlying DNS resolver contention was sustained for that invocation's
// whole lifetime. Reusing one client across warm invocations means most
// calls do zero DNS work at all.
const clientCache = new Map()

function makeClient(event) {
  const domain = event.requestContext.domainName
  const stage  = event.requestContext.stage
  const endpoint = `https://${domain}/${stage}`

  let client = clientCache.get(endpoint)
  if (!client) {
    client = new ApiGatewayManagementApiClient({ endpoint })
    clientCache.set(endpoint, client)
  }
  return client
}

const SEND_RETRY_DELAYS_MS = [100, 250]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendTo(apigw, connectionId, payload) {
  for (let attempt = 0; ; attempt++) {
    try {
      await apigw.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(payload)),
      }))
      return
    } catch (err) {
      if (err.$metadata?.httpStatusCode === 410) {
        // Connection gone — clean up, not retryable.
        await deleteConnection(connectionId).catch(() => {})
        return
      }
      // Transient failures observed in practice (e.g. "getaddrinfo EBUSY"
      // DNS resolution hiccups inside the Lambda environment under
      // concurrent connection load) have no HTTP status at all — retry a
      // couple of times with a short delay before giving up, rather than
      // silently dropping the message on the first failure.
      if (attempt >= SEND_RETRY_DELAYS_MS.length) {
        console.error(`Failed to send to ${connectionId} after ${attempt + 1} attempts:`, err)
        return
      }
      await sleep(SEND_RETRY_DELAYS_MS[attempt])
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
