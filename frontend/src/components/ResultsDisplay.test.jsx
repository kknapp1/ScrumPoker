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

  test('non-numeric deck with no consensus shows low/high outliers with names', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: {
        average: null,
        median: null,
        low: { value: 'S', names: ['Alice'] },
        high: { value: 'XL', names: ['Bob', 'Carl'] },
      },
      participants: [
        { name: 'Alice', vote: 'S' },
        { name: 'Bob', vote: 'XL' },
        { name: 'Carl', vote: 'XL' },
      ],
    })
    expect(screen.getByText('Lowest')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Highest')).toBeInTheDocument()
    expect(screen.getByText('XL')).toBeInTheDocument()
    expect(screen.getByText('Bob, Carl')).toBeInTheDocument()
    expect(screen.queryByText('Average')).not.toBeInTheDocument()
  })

  test('non-numeric deck with consensus shows only the consensus banner, no outliers', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { average: null, median: null, low: { value: 'M', names: ['Alice', 'Bob'] }, high: { value: 'M', names: ['Alice', 'Bob'] } },
      participants: [{ name: 'Alice', vote: 'M' }, { name: 'Bob', vote: 'M' }],
    })
    expect(screen.getByText(/consensus/i)).toBeInTheDocument()
    expect(screen.queryByText('Lowest')).not.toBeInTheDocument()
    expect(screen.queryByText('Highest')).not.toBeInTheDocument()
  })
})
