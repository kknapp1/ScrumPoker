import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRoom } from '../test-utils.jsx'
import ParticipantList from './ParticipantList.jsx'
import { ROOM_STATUS } from '../constants.js'

describe('ParticipantList', () => {
  test('shows an empty state with no participants', () => {
    renderWithRoom(<ParticipantList />, { participants: [] })
    expect(screen.getByText(/no participants yet/i)).toBeInTheDocument()
  })

  test('hides vote values pre-reveal, even for a participant who voted', () => {
    renderWithRoom(<ParticipantList />, {
      status: ROOM_STATUS.VOTING,
      participants: [{ name: 'Alice', vote: true, isCurrentUser: false }],
    })
    expect(screen.queryByText('true')).not.toBeInTheDocument()
    expect(screen.getByTitle('Vote submitted')).toBeInTheDocument()
  })

  test('shows actual vote values once revealed', () => {
    renderWithRoom(<ParticipantList />, {
      status: ROOM_STATUS.REVEALED,
      participants: [{ name: 'Alice', vote: '5', isCurrentUser: false }],
    })
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  test('marks the current user', () => {
    renderWithRoom(<ParticipantList />, {
      participants: [{ name: 'Alice', vote: null, isCurrentUser: true }],
    })
    expect(screen.getByText(/\(you\)/i)).toBeInTheDocument()
  })
})
