import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWebSocketRoom } from './useWebSocketRoom.js'

class MockWebSocket {
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.OPEN
    this.sent = []
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    MockWebSocket.instances.push(this)
  }
  send(data) {
    this.sent.push(JSON.parse(data))
  }
  close(code) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason: '' })
  }
  // Test helpers — not part of the real WebSocket API
  triggerOpen() {
    this.onopen?.()
  }
  triggerMessage(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
  triggerClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason: '' })
  }
}
MockWebSocket.CONNECTING = 0
MockWebSocket.OPEN = 1
MockWebSocket.CLOSING = 2
MockWebSocket.CLOSED = 3

function latestSocket() {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]
}

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
})

function connectAndHydrate(socket, room = {}) {
  act(() => socket.triggerOpen())
  act(() => socket.triggerMessage({
    type: 'ROOM_STATE',
    room: {
      roomId: '123',
      status: 'voting',
      deckKey: 'fibonacci',
      storyName: '',
      isModerator: true,
      participants: [{ userName: 'Alice', hasVoted: false }],
      ...room,
    },
  }))
}

describe('useWebSocketRoom', () => {
  test('connects with roomId/userName as query params, no JOIN_ROOM message', () => {
    renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    expect(socket.url).toContain('roomId=123')
    expect(socket.url).toContain('userName=Alice')
  })

  test('requests room state once the socket opens', () => {
    renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    act(() => socket.triggerOpen())
    expect(socket.sent).toContainEqual({ type: 'REQUEST_ROOM_STATE' })
  })

  test('ROOM_STATE hydrates status, deck, moderator flag, and participants', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    connectAndHydrate(latestSocket())

    expect(result.current.isConnected).toBe(true)
    expect(result.current.isModerator).toBe(true)
    expect(result.current.participants).toEqual([{ name: 'Alice', vote: null, isCurrentUser: true }])
  })

  test('PARTICIPANT_JOINED adds a new participant exactly once', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    act(() => socket.triggerMessage({ type: 'PARTICIPANT_JOINED', userName: 'Bob', participantCount: 2 }))
    act(() => socket.triggerMessage({ type: 'PARTICIPANT_JOINED', userName: 'Bob', participantCount: 2 }))

    expect(result.current.participants.filter(p => p.name === 'Bob')).toHaveLength(1)
  })

  test('MODERATOR_CHANGED sets isModerator based on whose name matches', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket, { isModerator: false })

    expect(result.current.isModerator).toBe(false)

    act(() => socket.triggerMessage({ type: 'MODERATOR_CHANGED', userName: 'Alice' }))
    expect(result.current.isModerator).toBe(true)

    act(() => socket.triggerMessage({ type: 'MODERATOR_CHANGED', userName: 'Bob' }))
    expect(result.current.isModerator).toBe(false)
  })

  test('PARTICIPANT_LEFT with wasModerator clears hasActiveModerator', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    expect(result.current.hasActiveModerator).toBe(true)

    act(() => socket.triggerMessage({ type: 'PARTICIPANT_LEFT', userName: 'Bob', wasModerator: false }))
    expect(result.current.hasActiveModerator).toBe(true)

    act(() => socket.triggerMessage({ type: 'PARTICIPANT_LEFT', userName: 'Alice', wasModerator: true }))
    expect(result.current.hasActiveModerator).toBe(false)
  })

  test('claimModerator sends a CLAIM_MODERATOR message', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    act(() => result.current.claimModerator())
    expect(socket.sent).toContainEqual({ type: 'CLAIM_MODERATOR' })
  })

  test('MODERATOR_CHANGED restores hasActiveModerator to true', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    // Realistic sequence: the moderator's connection drops (PARTICIPANT_LEFT
    // with wasModerator) before someone claims the role (MODERATOR_CHANGED).
    act(() => socket.triggerMessage({ type: 'PARTICIPANT_LEFT', userName: 'Alice', wasModerator: true }))
    expect(result.current.hasActiveModerator).toBe(false)

    act(() => socket.triggerMessage({ type: 'MODERATOR_CHANGED', userName: 'Bob' }))
    expect(result.current.hasActiveModerator).toBe(true)
  })

  test('VOTE_CAST then VOTES_REVEALED reveals the real value', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket, { participants: [{ userName: 'Alice', hasVoted: false }, { userName: 'Bob', hasVoted: false }] })

    act(() => socket.triggerMessage({ type: 'VOTE_CAST', userName: 'Bob' }))
    expect(result.current.participants.find(p => p.name === 'Bob').vote).toBe(true) // hidden placeholder

    act(() => socket.triggerMessage({ type: 'VOTES_REVEALED', votes: { Bob: '5' } }))
    expect(result.current.status).toBe('revealed')
    expect(result.current.participants.find(p => p.name === 'Bob').vote).toBe('5')
  })

  test('VOTES_REVEALED computes low/high outliers by ordinal rank for every deck, including numeric-looking ones', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket, {
      deckKey: 'fibonacci',
      participants: [
        { userName: 'Alice', hasVoted: false },
        { userName: 'Bob', hasVoted: false },
        { userName: 'Carl', hasVoted: false },
      ],
    })

    act(() => socket.triggerMessage({ type: 'VOTES_REVEALED', votes: { Alice: '3', Bob: '13', Carl: '13' } }))

    expect(result.current.results.average).toBeUndefined()
    expect(result.current.results.median).toBeUndefined()
    expect(result.current.results.low).toEqual({ value: '3', names: ['Alice'] })
    expect(result.current.results.high).toEqual({ value: '13', names: ['Bob', 'Carl'] })
  })

  test('VOTES_REVEALED computes low/high outliers for a non-numeric deck the same way', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket, {
      deckKey: 'tshirt',
      participants: [
        { userName: 'Alice', hasVoted: false },
        { userName: 'Bob', hasVoted: false },
        { userName: 'Carl', hasVoted: false },
      ],
    })

    act(() => socket.triggerMessage({ type: 'VOTES_REVEALED', votes: { Alice: 'S', Bob: 'XL', Carl: 'XL' } }))

    expect(result.current.results.low).toEqual({ value: 'S', names: ['Alice'] })
    expect(result.current.results.high).toEqual({ value: 'XL', names: ['Bob', 'Carl'] })
  })

  test('ROUND_RESET clears votes and my own selection', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    act(() => result.current.castVote('8'))
    expect(result.current.myVote).toBe('8')

    act(() => socket.triggerMessage({ type: 'ROUND_RESET' }))
    expect(result.current.myVote).toBeNull()
    expect(result.current.status).toBe('voting')
  })

  test('DECK_UPDATED switches the active deck', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    act(() => socket.triggerMessage({ type: 'DECK_UPDATED', deckKey: 'tshirt' }))
    expect(result.current.deckKey).toBe('tshirt')
  })

  test('ERROR sets a transient lastError that auto-clears', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    act(() => socket.triggerMessage({ type: 'ERROR', message: 'Only the moderator can reveal votes' }))
    expect(result.current.lastError).toBe('Only the moderator can reveal votes')

    act(() => vi.advanceTimersByTime(4000))
    expect(result.current.lastError).toBeNull()
    vi.useRealTimers()
  })

  test('castVote toggles the same card off', () => {
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    connectAndHydrate(latestSocket())

    act(() => result.current.castVote('5'))
    expect(result.current.myVote).toBe('5')

    act(() => result.current.castVote('5'))
    expect(result.current.myVote).toBeNull()
  })

  test('a connect-time failure (never received ROOM_STATE) sets a hedged connectionError and does not reconnect', () => {
    renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    const instanceCountBefore = MockWebSocket.instances.length

    act(() => socket.triggerClose(1006)) // never opened/hydrated

    expect(MockWebSocket.instances.length).toBe(instanceCountBefore) // no reconnect attempt yet
  })

  test('an unexpected drop after a successful connection reconnects', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWebSocketRoom('123', 'Alice'))
    const socket = latestSocket()
    connectAndHydrate(socket)

    act(() => socket.triggerClose(1006))
    expect(result.current.isConnected).toBe(false)

    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(MockWebSocket.instances.length).toBe(2) // reconnected

    vi.useRealTimers()
  })
})
