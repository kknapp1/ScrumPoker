import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateRoomId } from '../hooks/useLocalRoom.js'
import Footer from './Footer.jsx'
import styles from './LobbyPage.module.css'

export default function LobbyPage() {
  const navigate = useNavigate()
  const [joinId, setJoinId] = useState('')
  const [joinError, setJoinError] = useState('')

  function handleCreateRoom() {
    const id = generateRoomId()
    navigate(`/room/${id}`)
  }

  function handleJoinRoom(e) {
    e.preventDefault()
    const trimmed = joinId.trim()
    if (!trimmed) {
      setJoinError('Please enter a room ID.')
      return
    }
    if (!/^\d{8}$/.test(trimmed)) {
      setJoinError('Room IDs are 8 digits (e.g. 12345678).')
      return
    }
    navigate(`/room/${trimmed}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>♠</span>
        <h1 className={styles.title}>Scrum Poker</h1>
        <p className={styles.subtitle}>Collaborative effort estimation for agile teams</p>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Start a new session</h2>
          <p className={styles.cardDesc}>
            Create a room and share the link with your team.
          </p>
          <button className={styles.primaryButton} onClick={handleCreateRoom}>
            Create Room
          </button>
        </section>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Join an existing room</h2>
          <p className={styles.cardDesc}>
            Enter an 8-digit room ID from a teammate.
          </p>
          <form onSubmit={handleJoinRoom} className={styles.joinForm}>
            <input
              type="text"
              placeholder="Room ID (e.g. 12345678)"
              value={joinId}
              onChange={e => { setJoinId(e.target.value); setJoinError('') }}
              className={styles.input}
              maxLength={8}
              inputMode="numeric"
              pattern="\d*"
              aria-label="Room ID"
            />
            {joinError && <p className={styles.error} role="alert">{joinError}</p>}
            <button type="submit" className={styles.secondaryButton}>
              Join Room
            </button>
          </form>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>An internal tool for sprint planning — no ads, no accounts required.</p>
      </footer>

      <Footer />
    </div>
  )
}
