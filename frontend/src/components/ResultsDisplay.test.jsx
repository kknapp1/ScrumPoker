import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithRoom } from '../test-utils.jsx'
import ResultsDisplay from './ResultsDisplay.jsx'
import { ROOM_STATUS } from '../constants.js'

describe('ResultsDisplay', () => {
  test('renders nothing before reveal', () => {
    const { container } = renderWithRoom(<ResultsDisplay />, { status: ROOM_STATUS.VOTING, results: null })
    expect(container).toBeEmptyDOMElement()
  })

  test('shows the consensus banner when everyone voted the same', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { average: 5, median: 5 },
      participants: [{ name: 'Alice', vote: '5' }, { name: 'Bob', vote: '5' }],
    })
    expect(screen.getByText(/consensus/i)).toBeInTheDocument()
  })

  test('no consensus banner when votes differ', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { average: 4, median: 4 },
      participants: [{ name: 'Alice', vote: '3' }, { name: 'Bob', vote: '5' }],
    })
    expect(screen.queryByText(/consensus/i)).not.toBeInTheDocument()
  })

  test('shows average, median, and vote count', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { average: 4.5, median: 13 },
      participants: [{ name: 'Alice', vote: '3' }, { name: 'Bob', vote: '5' }],
    })
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('Average')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('Median')).toBeInTheDocument()
  })
})
