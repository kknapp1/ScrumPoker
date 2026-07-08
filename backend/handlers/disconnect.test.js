const { test } = require('node:test')
const assert = require('node:assert')
const db = require('../lib/db')
const broadcast = require('../lib/broadcast')
const { freshRequire } = require('./test-helpers')

function event(connectionId) {
  return { requestContext: { connectionId, domainName: 'example.execute-api.us-east-2.amazonaws.com', stage: 'sandbox' } }
}

function handler() {
  return freshRequire('./disconnect.js').handler
}

test('no-ops for an unknown connection', async (t) => {
  t.mock.method(db, 'getConnection', async () => undefined)
  const deleteMock = t.mock.method(db, 'deleteConnection', async () => {})

  const result = await handler()(event('unknown'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(deleteMock.mock.callCount(), 0)
})

test('deletes the connection and broadcasts PARTICIPANT_LEFT to remaining participants', async (t) => {
  t.mock.method(db, 'getConnection', async () => ({ connectionId: 'c1', roomId: '123', userName: 'Alice' }))
  const deleteMock = t.mock.method(db, 'deleteConnection', async () => {})
  const remaining = [{ connectionId: 'c2', userName: 'Bob' }]
  t.mock.method(db, 'getConnectionsByRoom', async () => remaining)
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c2' }))
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(deleteMock.mock.callCount(), 1)
  assert.strictEqual(deleteMock.mock.calls[0].arguments[0], 'c1')
  assert.strictEqual(broadcastMock.mock.callCount(), 1)
  const [, connections, payload] = broadcastMock.mock.calls[0].arguments
  assert.deepStrictEqual(connections, remaining)
  assert.strictEqual(payload.type, 'PARTICIPANT_LEFT')
  assert.strictEqual(payload.userName, 'Alice')
  assert.strictEqual(payload.participantCount, 1)
})

test('reassigns the moderator and broadcasts MODERATOR_CHANGED when the moderator disconnects', async (t) => {
  t.mock.method(db, 'getConnection', async () => ({ connectionId: 'c1', roomId: '123', userName: 'Alice' }))
  t.mock.method(db, 'deleteConnection', async () => {})
  const remaining = [{ connectionId: 'c2', userName: 'Bob' }, { connectionId: 'c3', userName: 'Carol' }]
  t.mock.method(db, 'getConnectionsByRoom', async () => remaining)
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 1)
  assert.strictEqual(updateRoomMock.mock.calls[0].arguments[0], '123')
  assert.deepStrictEqual(updateRoomMock.mock.calls[0].arguments[1], { moderatorConnectionId: 'c2' })

  assert.strictEqual(broadcastMock.mock.callCount(), 2)
  const [, , secondPayload] = broadcastMock.mock.calls[1].arguments
  assert.strictEqual(secondPayload.type, 'MODERATOR_CHANGED')
  assert.strictEqual(secondPayload.userName, 'Bob')
})

test('does not reassign moderator when a non-moderator disconnects', async (t) => {
  t.mock.method(db, 'getConnection', async () => ({ connectionId: 'c2', roomId: '123', userName: 'Bob' }))
  t.mock.method(db, 'deleteConnection', async () => {})
  const remaining = [{ connectionId: 'c1', userName: 'Alice' }]
  t.mock.method(db, 'getConnectionsByRoom', async () => remaining)
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c2'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
  assert.strictEqual(broadcastMock.mock.callCount(), 1)
})

test('does not error when the moderator disconnects and no other participants remain', async (t) => {
  t.mock.method(db, 'getConnection', async () => ({ connectionId: 'c1', roomId: '123', userName: 'Alice' }))
  t.mock.method(db, 'deleteConnection', async () => {})
  t.mock.method(db, 'getConnectionsByRoom', async () => [])
  t.mock.method(db, 'getRoom', async () => ({ roomId: '123', moderatorConnectionId: 'c1' }))
  const updateRoomMock = t.mock.method(db, 'updateRoom', async () => {})
  const broadcastMock = t.mock.method(broadcast, 'broadcastToRoom', async () => {})

  const result = await handler()(event('c1'))

  assert.strictEqual(result.statusCode, 200)
  assert.strictEqual(updateRoomMock.mock.callCount(), 0)
  assert.strictEqual(broadcastMock.mock.callCount(), 1)
})
