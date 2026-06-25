import { useRoom } from '../context/RoomContext.jsx'
import { ROOM_STATUS } from '../constants.js'
import styles from './ResultsDisplay.module.css'

/**
 * ResultsDisplay — shown after votes are revealed.
 * Consensus indicator, vote count, or — when there's no consensus — the
 * low/high outlier votes with who cast them. No average/median: averaging
 * a deck's labels (whether "1"/"13" or "S"/"XL") doesn't produce a number
 * anyone actually voted for, so it isn't a meaningful estimate for any deck.
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
