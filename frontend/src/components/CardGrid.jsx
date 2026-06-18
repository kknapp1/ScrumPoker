import PokerCard from './PokerCard.jsx'
import { useRoom } from '../context/RoomContext.jsx'
import { ROOM_STATUS } from '../constants.js'
import styles from './CardGrid.module.css'

export default function CardGrid() {
  const { deck, myVote, castVote, status } = useRoom()
  const isRevealed = status === ROOM_STATUS.REVEALED

  return (
    <section className={styles.section} aria-label="Voting cards">
      <h2 className={styles.heading}>
        {isRevealed ? 'Round complete — reset to vote again' : 'Pick a card to cast your vote'}
      </h2>
      <div className={styles.grid}>
        {deck.values.map(value => (
          <PokerCard
            key={value}
            value={value}
            selected={myVote === value}
            revealed={isRevealed}
            onClick={castVote}
          />
        ))}
      </div>
      {myVote && !isRevealed && (
        <p className={styles.selectedNote}>
          You selected <strong>{myVote}</strong>. Click the card again to deselect.
        </p>
      )}
    </section>
  )
}
