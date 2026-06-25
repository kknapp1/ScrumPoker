import React from 'react'
import { render } from '@testing-library/react'
import { RoomContext } from './context/RoomContext.jsx'
import { CARD_DECKS, DEFAULT_DECK, ROOM_STATUS } from './constants.js'

export function renderWithRoom(ui, roomOverrides = {}) {
  const room = {
    roomId: '123',
    status: ROOM_STATUS.VOTING,
    deck: CARD_DECKS[DEFAULT_DECK],
    deckKey: DEFAULT_DECK,
    storyName: '',
    setStoryName: () => {},
    setDeckKey: () => {},
    participants: [],
    myVote: null,
    castVote: () => {},
    reveal: () => {},
    reset: () => {},
    results: null,
    isModerator: true,
    isConnected: true,
    connectionError: null,
    lastError: null,
    ...roomOverrides,
  }
  return render(<RoomContext.Provider value={room}>{ui}</RoomContext.Provider>)
}
