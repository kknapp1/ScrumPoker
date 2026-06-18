import { useRoom } from '../context/RoomContext.jsx'
import { ROOM_STATUS } from '../constants.js'
import styles from './ParticipantList.module.css'

export default function ParticipantList() {
  const { participants, status } = useRoom()
  const isRevealed = status === ROOM_STATUS.REVEALED

  const votedCount = participants.filter(p => p.vote !== null).length

  return (
    <section className={styles.section} aria-label="Participants">
      <div className={styles.header}>
        <h2 className={styles.heading}>Participants</h2>
        <span className={styles.badge}>
          {votedCount}/{participants.length} voted
        </span>
      </div>

      {participants.length === 0 ? (
        <p className={styles.empty}>No participants yet.</p>
      ) : (
        <ul className={styles.list}>
          {participants.map(p => (
            <li key={p.name} className={styles.participant}>
              <div className={styles.nameRow}>
                <span
                  className={styles.onlineDot}
                  title="Online"
                  aria-label="Online"
                />
                <span className={styles.name}>
                  {p.name}
                  {p.isCurrentUser && <span className={styles.you}> (you)</span>}
                </span>
              </div>
              <div className={styles.voteStatus}>
                {isRevealed ? (
                  /* Show the actual vote after reveal */
                  p.vote !== null ? (
                    <span className={styles.revealedVote}>{p.vote}</span>
                  ) : (
                    <span className={styles.noVote}>—</span>
                  )
                ) : (
                  /* Show hidden card indicator while voting */
                  p.vote !== null ? (
                    <span className={styles.votedChip} title="Vote submitted">✓</span>
                  ) : (
                    <span className={styles.waitingChip} title="Waiting for vote">…</span>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
