import { describe, test, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithRoom } from '../test-utils.jsx'
import VoteControls from './VoteControls.jsx'

describe('VoteControls', () => {
  test('moderator sees Reveal and Reset buttons', () => {
    renderWithRoom(<VoteControls />, {
      isModerator: true,
      participants: [{ name: 'Alice', vote: '5', isCurrentUser: true }],
    })
    expect(screen.getByRole('button', { name: /reveal cards/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset votes/i })).toBeInTheDocument()
  })

  test('non-moderator sees a waiting notice instead of buttons', () => {
    renderWithRoom(<VoteControls />, { isModerator: false })
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
    expect(screen.getByText(/waiting for the moderator/i)).toBeInTheDocument()
  })

  test('Reveal button disabled when nobody has voted yet', () => {
    renderWithRoom(<VoteControls />, { isModerator: true, participants: [{ name: 'Alice', vote: null }] })
    expect(screen.getByRole('button', { name: /no votes to reveal yet|reveal cards/i })).toBeDisabled()
  })

  test('clicking Reveal calls reveal()', () => {
    const reveal = vi.fn()
    renderWithRoom(<VoteControls />, {
      isModerator: true,
      reveal,
      participants: [{ name: 'Alice', vote: '5' }],
    })
    fireEvent.click(screen.getByRole('button', { name: /reveal cards/i }))
    expect(reveal).toHaveBeenCalledOnce()
  })

  test('clicking Reset calls reset()', () => {
    const reset = vi.fn()
    renderWithRoom(<VoteControls />, { isModerator: true, reset, participants: [] })
    fireEvent.click(screen.getByRole('button', { name: /reset votes/i }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
