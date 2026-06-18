import { useRoom } from '../context/RoomContext.jsx'
import { ROOM_STATUS } from '../constants.js'
import styles from './ResultsDisplay.module.css'

/**
 * ResultsDisplay — shown after votes are revealed.
 * Displays average, median, and a consensus indicator.
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
    </div>
  )
}
