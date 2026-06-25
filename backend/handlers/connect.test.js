const { test } = require('node:test')
const assert = require('node:assert')
const db = require('../lib/db')
const broadcast = require('../lib/broadcast')
const { freshRequire } = require('./test-helpers')

function event(connectionId, roomId, userName) {
  return {
    requestContext: { connectionId, domainName: 'example.execute-api.us-east-2.amazonaws.com', stage: 'sandbox' },
    queryStringParameters: { roomId, userName },
  }
}

function handler() {
  return freshRequire('./connect.js').handler
}

test('rejects missing roomId/userName', async () => {
  const result = await handler()({ requestContext: { connectionId: 'c1' }, queryStringParameters: {} })
  assert.strictEqual(result.statusCode, 400)
})

test('rejects an invalid userName (empty after trim, or too long)', async () => {
  const empty = await handler()(event('c1', '123', '   '))
  assert.strictEqual(empty.statusCode, 400)

  const tooLong = await handler()(event('c1', '123', 'x'.repeat(33)))
  assert.strictEqual(tooLong.statusCode, 400)
})

test('rejects the 51st participant with 403, without creating a room or broadcasting', async (t) => {
  const fullRoom = new Array(50).fill({ connectionId: 'x', userName: 'X' })
  t.mock.method(db, 'getConnectionsByRoom', async () => fullRoom)
  const createRoomMock = t.mock.method(db, 'createRoom', async () => { throw new Error('should not be called') })
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c51', '123', 'Overflow'))

  assert.strictEqual(result.statusCode, 403)
  assert.strictEqual(createRoomMock.mock.callCount(), 0)
  assert.strictEqual(broadcastMock.mock.callCount(), 0)
})

test('first joiner creates the room and becomes moderator', async (t) => {
  t.mock.method(db, 'getConnectionsByRoom', async () => [])
  t.mock.method(db, 'getRoom', async () => undefined)
  const createRoomMock = t.mock.method(db, 'createRoom', async (roomId, moderatorConnectionId) => ({
    roomId, moderatorConnectionId, status: 'voting',
  }))
  t.mock.method(db, 'saveConnection', async () => {})
  t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1', '123', 'Alice'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(createRoomMock.mock.callCount(), 1)
  assert.strictEqual(createRoomMock.mock.calls[0].arguments[1], 'c1') // moderatorConnectionId
})

test('broadcasts PARTICIPANT_JOINED to existing connections, excluding the new joiner', async (t) => {
  const existing = [{ connectionId: 'c1', userName: 'Alice' }]
  t.mock.method(db, 'getConnectionsByRoom', async () => existing)
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  t.mock.method(db, 'updateRoom', async () => {})
  t.mock.method(db, 'saveConnection', async () => {})
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c2', '123', 'Bob'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(broadcastMock.mock.callCount(), 1)
  const [, connections, payload] = broadcastMock.mock.calls[0].arguments
  assert.deepStrictEqual(connections, existing)
  assert.strictEqual(payload.type, 'PARTICIPANT_JOINED')
  assert.strictEqual(payload.userName, 'Bob')
})

// Regression test for the $connect self-send bug (fixed in Phase 2): the
// handler must never attempt to message its own connectionId, since API
// Gateway can't PostToConnection to a connection still inside its own
// $connect invocation (fails with 410, which would also incorrectly
// delete the brand-new connection via sendTo's cleanup path).
test('never sends or broadcasts directly to its own connectionId', async (t) => {
  t.mock.method(db, 'getConnectionsByRoom', async () => [])
  t.mock.method(db, 'getRoom', async () => undefined)
  t.mock.method(db, 'createRoom', async (roomId, moderatorConnectionId) => ({ roomId, moderatorConnectionId }))
  t.mock.method(db, 'saveConnection', async () => {})
  const sendToMock = t.mock.method(broadcast, 'sendTo', async () => {})
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  await handler()(event('c1', '123', 'Alice'))

  assert.strictEqual(sendToMock.mock.callCount(), 0)
  // broadcastToRoom is fine to call (it excludes the sender internally),
  // but connect.js itself must never pass its own connectionId as a target.
  if (broadcastMock.mock.callCount() > 0) {
    const [, connections] = broadcastMock.mock.calls[0].arguments
    assert.ok(!connections.some(c => c.connectionId === 'c1'))
  }
})
