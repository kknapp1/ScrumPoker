/**
 * useLocalRoom — Phase 1 local state hook.
 *
 * Manages room state entirely in memory (single browser tab).
 * In Phase 2 this is replaced by useWebSocketRoom, which syncs
 * state across all participants via the WebSocket backend.
 * Components consume this via RoomContext so they don't care
 * which implementation is active.
 */
import { useState, useCallback } from 'react'
import { CARD_DECKS, DEFAULT_DECK, ROOM_STATUS } from '../constants.js'

function generateRoomId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

export function useLocalRoom(roomId, currentUser) {
  const [status, setStatus] = useState(ROOM_STATUS.VOTING)
  const [deckKey, setDeckKey] = useState(DEFAULT_DECK)
  const [storyName, setStoryName] = useState('')
  const [myVote, setMyVote] = useState(null)

  // Phase 1: only the local user is visible as a participant.
  // In Phase 2, participants is a live list synced via WebSocket.
  const participants = currentUser
    ? [{ name: currentUser, vote: myVote, isCurrentUser: true }]
    : []

  const deck = CARD_DECKS[deckKey] ?? CARD_DECKS[DEFAULT_DECK]

  const castVote = useCallback((value) => {
    setMyVote(prev => prev === value ? null : value) // toggle off if same card clicked
  }, [])

  const reveal = useCallback(() => {
    setStatus(ROOM_STATUS.REVEALED)
  }, [])

  const reset = useCallback(() => {
    setMyVote(null)
    setStatus(ROOM_STATUS.VOTING)
    setStoryName('')
  }, [])

  // Compute results (used post-reveal)
  const results = (() => {
    if (status !== ROOM_STATUS.REVEALED) return null
    const numericVotes = participants
      .map(p => parseFloat(p.vote))
      .filter(v => !isNaN(v))

    if (numericVotes.length === 0) return { average: null, median: null }

    const avg = numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
    const sorted = [...numericVotes].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

    return {
      average: Math.round(avg * 10) / 10,
      median: Math.round(median * 10) / 10,
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
    // Phase 2 will add: isConnected, connectionError
    isLocalOnly: true,
  }
}

export { generateRoomId }
