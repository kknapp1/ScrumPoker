import { useState, useEffect, useRef } from 'react'
import styles from './NameEntryModal.module.css'

const NAME_STORAGE_KEY = 'scrumpoker_username'

export default function NameEntryModal({ onConfirm }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Pre-fill from last session
  useEffect(() => {
    const saved = localStorage.getItem(NAME_STORAGE_KEY)
    if (saved) setName(saved)
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name.')
      return
    }
    if (trimmed.length > 32) {
      setError('Name must be 32 characters or fewer.')
      return
    }
    localStorage.setItem(NAME_STORAGE_KEY, trimmed)
    onConfirm(trimmed)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={styles.modal}>
        <div className={styles.icon}>♠</div>
        <h2 id="modal-title" className={styles.title}>Join Room</h2>
        <p className={styles.subtitle}>Enter your name so teammates can identify your vote.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="name-input" className={styles.label}>Your name</label>
          <input
            id="name-input"
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="e.g. Alex"
            className={styles.input}
            maxLength={32}
            autoComplete="nickname"
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.button}>
            Enter Room
          </button>
        </form>
      </div>
    </div>
  )
}
