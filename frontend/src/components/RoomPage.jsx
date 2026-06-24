import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RoomContext } from '../context/RoomContext.jsx'
import { useWebSocketRoom } from '../hooks/useWebSocketRoom.js'
import { CARD_DECKS } from '../constants.js'
import NameEntryModal from './NameEntryModal.jsx'
import CardGrid from './CardGrid.jsx'
import ParticipantList from './ParticipantList.jsx'
import VoteControls from './VoteControls.jsx'
import ResultsDisplay from './ResultsDisplay.jsx'
import styles from './RoomPage.module.css'

export default function RoomPage() {
  const { roomId } = useParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [copied, setCopied] = useState(false)
  const [storyInput, setStoryInput] = useState('')

  const room = useWebSocketRoom(roomId, currentUser)

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleStorySubmit(e) {
    e.preventDefault()
    room.setStoryName(storyInput.trim())
  }

  if (!currentUser) {
    return <NameEntryModal onConfirm={setCurrentUser} />
  }

  return (
    <RoomContext.Provider value={room}>
      <div className={styles.page}>

        {/* Top nav */}
        <header className={styles.nav}>
          <Link to="/" className={styles.navBrand}>♠ Scrum Poker</Link>
          <div className={styles.navRight}>
            <span className={styles.roomId}>Room {roomId}</span>
            <button className={styles.copyButton} onClick={handleCopyLink}>
              {copied ? '✓ Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        </header>

        <main className={styles.main}>

          {/* Story name input */}
          <section className={styles.storySection}>
            <form onSubmit={handleStorySubmit} className={styles.storyForm}>
              <input
                type="text"
                className={styles.storyInput}
                placeholder="Story / ticket name (optional)"
                value={storyInput}
                onChange={e => setStoryInput(e.target.value)}
                maxLength={120}
                aria-label="Story name"
              />
              {storyInput.trim() && storyInput.trim() !== room.storyName && (
                <button type="submit" className={styles.storyButton}>Set</button>
              )}
            </form>
            {room.storyName && (
              <p className={styles.activeStory}>
                Estimating: <strong>{room.storyName}</strong>
              </p>
            )}
            {room.isModerator && (
              <label className={styles.deckSelectLabel}>
                Deck:{' '}
                <select
                  className={styles.deckSelect}
                  value={room.deckKey}
                  onChange={e => room.setDeckKey(e.target.value)}
                >
                  {Object.entries(CARD_DECKS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {/* Connection status */}
          {!room.isConnected && !room.connectionError && (
            <div className={styles.statusNotice} role="status">
              Connecting…
            </div>
          )}
          {room.connectionError && (
            <div className={styles.errorNotice} role="alert">
              {room.connectionError}
            </div>
          )}
          {room.lastError && (
            <div className={styles.errorNotice} role="alert">
              {room.lastError}
            </div>
          )}

          {/* Results (shown after reveal) */}
          <ResultsDisplay />

          {/* Voting cards */}
          <CardGrid />

          {/* Controls */}
          <VoteControls />

          {/* Participant list */}
          <ParticipantList />

        </main>
      </div>
    </RoomContext.Provider>
  )
}
