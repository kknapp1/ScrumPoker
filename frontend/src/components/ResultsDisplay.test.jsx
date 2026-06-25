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
      results: { low: { value: '5', names: ['Alice', 'Bob'] }, high: { value: '5', names: ['Alice', 'Bob'] } },
      participants: [{ name: 'Alice', vote: '5' }, { name: 'Bob', vote: '5' }],
    })
    expect(screen.getByText(/consensus/i)).toBeInTheDocument()
  })

  test('no consensus banner when votes differ', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { low: { value: '3', names: ['Alice'] }, high: { value: '5', names: ['Bob'] } },
      participants: [{ name: 'Alice', vote: '3' }, { name: 'Bob', vote: '5' }],
    })
    expect(screen.queryByText(/consensus/i)).not.toBeInTheDocument()
  })

  test('shows vote count, no average/median (not a meaningful estimate for any deck)', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { low: { value: '3', names: ['Alice'] }, high: { value: '5', names: ['Bob'] } },
      participants: [{ name: 'Alice', vote: '3' }, { name: 'Bob', vote: '5' }],
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Votes cast')).toBeInTheDocument()
    expect(screen.queryByText('Average')).not.toBeInTheDocument()
    expect(screen.queryByText('Median')).not.toBeInTheDocument()
  })

  test('no consensus shows low/high outliers with names', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: {
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
  })

  test('consensus shows only the consensus banner, no outliers', () => {
    renderWithRoom(<ResultsDisplay />, {
      status: ROOM_STATUS.REVEALED,
      results: { low: { value: 'M', names: ['Alice', 'Bob'] }, high: { value: 'M', names: ['Alice', 'Bob'] } },
      participants: [{ name: 'Alice', vote: 'M' }, { name: 'Bob', vote: 'M' }],
    })
    expect(screen.getByText(/consensus/i)).toBeInTheDocument()
    expect(screen.queryByText('Lowest')).not.toBeInTheDocument()
    expect(screen.queryByText('Highest')).not.toBeInTheDocument()
  })
})
