import styles from './PokerCard.module.css'

/**
 * PokerCard — a single selectable voting card.
 *
 * Props:
 *   value      — the display value (e.g. '5', '?', '☕')
 *   selected   — whether this card is the user's current selection
 *   revealed   — whether the round has been revealed (disables selection)
 *   onClick    — called with value when the card is clicked
 */
export default function PokerCard({ value, selected, revealed, onClick }) {
  const isSpecial = value === '☕' || value === '?'

  const classNames = [
    styles.card,
    selected && styles.selected,
    revealed && styles.revealed,
    isSpecial && styles.special,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classNames}
      onClick={() => !revealed && onClick(value)}
      disabled={revealed}
      aria-pressed={selected}
      aria-label={`Vote ${value === '☕' ? 'coffee break' : value}`}
      title={value === '☕' ? 'Need a break' : value === '?' ? 'Uncertain / cannot estimate' : `${value} points`}
    >
      <span className={styles.corner + ' ' + styles.topLeft}>{value}</span>
      <span className={styles.center}>{value}</span>
      <span className={styles.corner + ' ' + styles.bottomRight}>{value}</span>
    </button>
  )
}
