import { useRoom } from '../context/RoomContext.jsx'
import { ROOM_STATUS } from '../constants.js'
import styles from './VoteControls.module.css'

/**
 * VoteControls — Reveal and Reset buttons, moderator-only (Phase 3).
 * Non-moderators see a status line instead of dead/disabled buttons.
 */
export default function VoteControls() {
  const { status, reveal, reset, participants, isModerator } = useRoom()
  const isRevealed = status === ROOM_STATUS.REVEALED

  const votedCount = participants.filter(p => p.vote !== null).length
  const totalCount = participants.length
  const allVoted = totalCount > 0 && votedCount === totalCount

  if (!isModerator) {
    return (
      <div className={styles.controls}>
        <p className={styles.moderatorNotice}>
          Waiting for the moderator to {isRevealed ? 'start a new round' : 'reveal votes'}.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.controls}>
      {!isRevealed && (
        <button
          className={styles.revealButton}
          onClick={reveal}
          disabled={votedCount === 0}
          title={votedCount === 0 ? 'No votes to reveal yet' : undefined}
        >
          {allVoted ? 'Reveal Cards' : `Reveal Cards (${votedCount}/${totalCount} voted)`}
        </button>
      )}

      <button
        className={styles.resetButton}
        onClick={reset}
        title="Clear all votes and start a new round"
      >
        {isRevealed ? 'Start New Round' : 'Reset Votes'}
      </button>
    </div>
  )
}
