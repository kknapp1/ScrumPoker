import { useRoom } from '../context/RoomContext.jsx'
import { ROOM_STATUS } from '../constants.js'
import styles from './ResultsDisplay.module.css'

/**
 * ResultsDisplay — shown after votes are revealed.
 * Numeric decks: average, median, vote count, and a consensus indicator.
 * Non-numeric decks (e.g. T-Shirt Sizes): consensus indicator, or — when
 * there's no consensus — the low/high outlier votes with who cast them,
 * since average/median aren't meaningful for those decks.
 */
export default function ResultsDisplay() {
  const { status, results, participants } = useRoom()

  if (status !== ROOM_STATUS.REVEALED || !results) return null

  const votes = participants.map(p => p.vote).filter(v => v !== null)
  const uniqueValues = [...new Set(votes)]
  const isConsensus = uniqueValues.length === 1

  return (
    <div className={styles.container} role="region" aria-label="Voting results">
      {isConsensus && votes.length > 0 && (
        <div className={styles.consensus}>
          🎉 Consensus! Everyone voted <strong>{uniqueValues[0]}</strong>
        </div>
      )}

      <div className={styles.stats}>
        {results.average !== null && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{results.average}</span>
            <span className={styles.statLabel}>Average</span>
          </div>
        )}
        {results.median !== null && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{results.median}</span>
            <span className={styles.statLabel}>Median</span>
          </div>
        )}
        <div className={styles.stat}>
          <span className={styles.statValue}>{votes.length}</span>
          <span className={styles.statLabel}>Votes cast</span>
        </div>
      </div>

      {!isConsensus && results.low && results.high && (
        <div className={styles.outliers}>
          <div className={styles.outlierItem}>
            <span className={styles.outlierLabel}>Lowest</span>
            <span className={styles.outlierValue}>{results.low.value}</span>
            <span className={styles.outlierNames}>{results.low.names.join(', ')}</span>
          </div>
          <div className={styles.outlierItem}>
            <span className={styles.outlierLabel}>Highest</span>
            <span className={styles.outlierValue}>{results.high.value}</span>
            <span className={styles.outlierNames}>{results.high.names.join(', ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
