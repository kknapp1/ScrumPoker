/**
 * useWebSocketRoom — Phase 2 real-time room hook.
 *
 * Same return shape as useLocalRoom so RoomPage can swap hooks with no
 * changes to the components below RoomContext. Talks to the API Gateway
 * WebSocket API: roomId/userName are passed as query params on the
 * connection URL (the $connect route reads them that way, not via a
 * JOIN_ROOM message), and all other actions are sent as
 * { type, ...payload } frames matching backend/handlers/message.js's
 * dispatch.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { CARD_DECKS, DEFAULT_DECK, ROOM_STATUS, WS_EVENTS, WS_ENDPOINT } from '../constants.js'

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000]

export function useWebSocketRoom(roomId, currentUser) {
  const [status, setStatus] = useState(ROOM_STATUS.VOTING)
  const [deckKey, setDeckKeyState] = useState(DEFAULT_DECK)
  const [storyName, setStoryNameState] = useState('')
  const [myVote, setMyVote] = useState(null)
  const [participants, setParticipants] = useState([])
  const [isModerator, setIsModerator] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [lastError, setLastError] = useState(null)

  const socketRef = useRef(null)
  const hasReceivedRoomStateRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const closedDeliberatelyRef = useRef(false)

  const deck = CARD_DECKS[deckKey] ?? CARD_DECKS[DEFAULT_DECK]

  useEffect(() => {
    if (!roomId || !currentUser) return

    closedDeliberatelyRef.current = false
    hasReceivedRoomStateRef.current = false
    reconnectAttemptRef.current = 0

    function handleMessage(msg) {
      switch (msg.type) {
        case WS_EVENTS.ROOM_STATE: {
          hasReceivedRoomStateRef.current = true
          const room = msg.room || {}
          setStatus(room.status === ROOM_STATUS.REVEALED ? ROOM_STATUS.REVEALED : ROOM_STATUS.VOTING)
          setDeckKeyState(room.deckKey || DEFAULT_DECK)
          setStoryNameState(room.storyName || '')
          setIsModerator(!!room.isModerator)
          setParticipants(
            (room.participants || []).map(p => ({
              name: p.userName,
              // value is only present once the room is already revealed
              // (e.g. reconnecting after reveal); otherwise fall back to
              // the hidden-value placeholder used everywhere else.
              vote: p.value !== undefined ? p.value : (p.hasVoted ? true : null),
              isCurrentUser: p.userName === currentUser,
            }))
          )
          break
        }

        case WS_EVENTS.PARTICIPANT_JOINED: {
          setParticipants(prev =>
            prev.some(p => p.name === msg.userName)
              ? prev
              : [...prev, { name: msg.userName, vote: null, isCurrentUser: msg.userName === currentUser }]
          )
          break
        }

        case WS_EVENTS.PARTICIPANT_LEFT: {
          setParticipants(prev => prev.filter(p => p.name !== msg.userName))
          break
        }

        case WS_EVENTS.MODERATOR_CHANGED: {
          setIsModerator(msg.userName === currentUser)
          break
        }

        case WS_EVENTS.VOTE_CAST: {
          // Hidden-value placeholder — actual value only arrives via VOTES_REVEALED.
          setParticipants(prev => prev.map(p => (p.name === msg.userName ? { ...p, vote: true } : p)))
          break
        }

        case WS_EVENTS.VOTES_REVEALED: {
          setStatus(ROOM_STATUS.REVEALED)
          setParticipants(prev => prev.map(p => ({ ...p, vote: msg.votes?.[p.name] ?? null })))
          break
        }

        case WS_EVENTS.ROUND_RESET: {
          setStatus(ROOM_STATUS.VOTING)
          setStoryNameState('')
          setMyVote(null)
          setParticipants(prev => prev.map(p => ({ ...p, vote: null })))
          break
        }

        case WS_EVENTS.STORY_UPDATED: {
          setStoryNameState(msg.storyName || '')
          break
        }

        case WS_EVENTS.DECK_UPDATED: {
          setDeckKeyState(msg.deckKey || DEFAULT_DECK)
          break
        }

        case WS_EVENTS.ERROR: {
          setLastError(msg.message || 'Something went wrong')
          break
        }

        default:
          break
      }
    }

    function connect() {
      const url = `${WS_ENDPOINT}?roomId=${encodeURIComponent(roomId)}&userName=${encodeURIComponent(currentUser)}`
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttemptRef.current = 0
        // The server can't push ROOM_STATE from $connect (API Gateway can't
        // PostToConnection to a connection still inside its own $connect
        // invocation), so the client requests it explicitly once the
        // channel is actually open.
        socket.send(JSON.stringify({ type: WS_EVENTS.REQUEST_ROOM_STATE }))
      }

      socket.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data))
        } catch {
          // Ignore malformed frames.
        }
      }

      socket.onclose = () => {
        setIsConnected(false)
        if (closedDeliberatelyRef.current) return

        if (!hasReceivedRoomStateRef.current) {
          // Never successfully joined this room — see #10. Don't auto-retry;
          // a connect-time rejection (e.g. room full) would just loop.
          setConnectionError("Couldn't join this room. Try again in a moment.")
          return
        }

        // Was connected, then dropped unexpectedly — reconnect with backoff.
        const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS_MS.length - 1)]
        reconnectAttemptRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      socket.onerror = () => {
        // onclose fires immediately after and handles state/reconnect.
      }
    }

    connect()

    return () => {
      closedDeliberatelyRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close(1000)
    }
  }, [roomId, currentUser])

  const send = useCallback((payload) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const castVote = useCallback((value) => {
    setMyVote(prev => {
      const next = prev === value ? null : value // toggle off if same card clicked
      send({ type: WS_EVENTS.VOTE, value: next })
      return next
    })
  }, [send])

  const reveal = useCallback(() => {
    send({ type: WS_EVENTS.REVEAL })
  }, [send])

  const reset = useCallback(() => {
    setMyVote(null)
    send({ type: WS_EVENTS.RESET })
  }, [send])

  const setStoryName = useCallback((name) => {
    send({ type: WS_EVENTS.UPDATE_STORY, storyName: name })
  }, [send])

  const setDeckKey = useCallback((key) => {
    send({ type: WS_EVENTS.SET_DECK, deckKey: key })
  }, [send])

  // Transient errors (e.g. "Only the moderator can...") auto-dismiss rather
  // than lingering until the next one replaces them.
  useEffect(() => {
    if (!lastError) return
    const timer = setTimeout(() => setLastError(null), 4000)
    return () => clearTimeout(timer)
  }, [lastError])

  // Average/median of a Fibonacci or powers-of-2 vote isn't a meaningful
  // estimate either (e.g. averaging 3 and 13 doesn't land on a number
  // anyone actually voted for) — every deck gets the same low/high
  // outlier display instead, by ordinal position in the deck's `values`
  // (already sorted low-to-high — not numeric parsing, so this works
  // regardless of whether the deck's labels are numbers or sizes), along
  // with who cast them, to spark discussion. ☕/? are excluded from
  // ranking since they're not estimates.
  const results = (() => {
    if (status !== ROOM_STATUS.REVEALED) return null

    const rankable = deck.values.filter(v => v !== '☕' && v !== '?')
    const ranked = participants
      .filter(p => p.vote !== null && rankable.includes(p.vote))
      .map(p => ({ name: p.name, rank: rankable.indexOf(p.vote) }))

    if (ranked.length === 0) return { low: null, high: null }

    const minRank = Math.min(...ranked.map(p => p.rank))
    const maxRank = Math.max(...ranked.map(p => p.rank))

    return {
      low: { value: rankable[minRank], names: ranked.filter(p => p.rank === minRank).map(p => p.name) },
      high: { value: rankable[maxRank], names: ranked.filter(p => p.rank === maxRank).map(p => p.name) },
    }
  })()

  return {
    roomId,
    status,
    deck,
    deckKey,
    setDeckKey,
    storyName,
    setStoryName,
    participants,
    myVote,
    castVote,
    reveal,
    reset,
    results,
    isModerator,
    isConnected,
    connectionError,
    lastError,
  }
}
