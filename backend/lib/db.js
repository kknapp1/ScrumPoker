/**
 * DynamoDB helpers — shared across all handlers.
 *
 * Tables (created by Terraform in Phase 2):
 *   CONNECTIONS_TABLE  — PK: connectionId
 *                        Attributes: roomId, userName, connectedAt, ttl
 *
 *   ROOMS_TABLE        — PK: roomId
 *                        Attributes: status, storyName, deckKey, moderatorConnectionId,
 *                                    participantCount, createdAt, ttl
 *
 *   VOTES_TABLE        — PK: roomId, SK: connectionId
 *                        Attributes: userName, value, submittedAt
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand,
        DeleteCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' })
const db = DynamoDBDocumentClient.from(client)

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE
const ROOMS_TABLE       = process.env.ROOMS_TABLE
const VOTES_TABLE       = process.env.VOTES_TABLE
const TTL_HOURS         = 24

function ttlFromNow() {
  return Math.floor(Date.now() / 1000) + TTL_HOURS * 3600
}

// ── Connection helpers ─────────────────────────────────────────

async function saveConnection(connectionId, roomId, userName) {
  await db.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: { connectionId, roomId, userName, connectedAt: Date.now(), ttl: ttlFromNow() },
  }))
}

async function getConnection(connectionId) {
  const res = await db.send(new GetCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  }))
  return res.Item
}

async function deleteConnection(connectionId) {
  await db.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  }))
}

async function getConnectionsByRoom(roomId) {
  const res = await db.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: 'roomId-index',
    KeyConditionExpression: 'roomId = :r',
    ExpressionAttributeValues: { ':r': roomId },
  }))
  return res.Items || []
}

// ── Room helpers ───────────────────────────────────────────────

async function getRoom(roomId) {
  const res = await db.send(new GetCommand({
    TableName: ROOMS_TABLE,
    Key: { roomId },
  }))
  return res.Item
}

async function createRoom(roomId, moderatorConnectionId, deckKey = 'fibonacci') {
  const item = {
    roomId,
    status: 'voting',
    storyName: '',
    deckKey,
    moderatorConnectionId,
    participantCount: 1,
    createdAt: Date.now(),
    ttl: ttlFromNow(),
  }
  await db.send(new PutCommand({ TableName: ROOMS_TABLE, Item: item }))
  return item
}

async function updateRoom(roomId, updates) {
  // Build a simple SET expression from the updates object
  const keys = Object.keys(updates)
  const expr = 'SET ' + keys.map((k, i) => `#k${i} = :v${i}`).join(', ')
  const names = Object.fromEntries(keys.map((k, i) => [`#k${i}`, k]))
  const values = Object.fromEntries(keys.map((k, i) => [`:v${i}`, updates[k]]))
  // Always bump TTL on activity
  names['#ttl'] = 'ttl'
  values[':ttl'] = ttlFromNow()
  await db.send(new UpdateCommand({
    TableName: ROOMS_TABLE,
    Key: { roomId },
    UpdateExpression: expr + ', #ttl = :ttl',
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }))
}

// ── Vote helpers ───────────────────────────────────────────────

async function saveVote(roomId, connectionId, userName, value) {
  await db.send(new PutCommand({
    TableName: VOTES_TABLE,
    Item: { roomId, connectionId, userName, value, submittedAt: Date.now() },
  }))
}

async function getVotesByRoom(roomId) {
  const res = await db.send(new QueryCommand({
    TableName: VOTES_TABLE,
    KeyConditionExpression: 'roomId = :r',
    ExpressionAttributeValues: { ':r': roomId },
  }))
  return res.Items || []
}

async function deleteVotesByRoom(roomId) {
  const votes = await getVotesByRoom(roomId)
  await Promise.all(votes.map(v =>
    db.send(new DeleteCommand({
      TableName: VOTES_TABLE,
      Key: { roomId: v.roomId, connectionId: v.connectionId },
    }))
  ))
}

module.exports = {
  saveConnection, getConnection, deleteConnection, getConnectionsByRoom,
  getRoom, createRoom, updateRoom,
  saveVote, getVotesByRoom, deleteVotesByRoom,
}
