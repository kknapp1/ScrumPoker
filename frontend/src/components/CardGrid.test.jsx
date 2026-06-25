import { describe, test, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithRoom } from '../test-utils.jsx'
import CardGrid from './CardGrid.jsx'
import { CARD_DECKS, ROOM_STATUS } from '../constants.js'

describe('CardGrid', () => {
  test('renders one card per deck value', () => {
    renderWithRoom(<CardGrid />)
    for (const value of CARD_DECKS.fibonacci.values) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
  })

  test('clicking a card calls castVote with its value', () => {
    const castVote = vi.fn()
    renderWithRoom(<CardGrid />, { castVote })
    fireEvent.click(screen.getByText('5'))
    expect(castVote).toHaveBeenCalledWith('5')
  })

  test('shows the deselect note only while voting and a card is selected', () => {
    renderWithRoom(<CardGrid />, { myVote: '5', status: ROOM_STATUS.VOTING })
    expect(screen.getByText(/you selected/i)).toBeInTheDocument()
  })

  test('hides the deselect note once revealed', () => {
    renderWithRoom(<CardGrid />, { myVote: '5', status: ROOM_STATUS.REVEALED })
    expect(screen.queryByText(/you selected/i)).not.toBeInTheDocument()
  })
})
