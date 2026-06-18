/**
 * RoomContext — provides room state to all child components.
 *
 * Phase 1: backed by useLocalRoom (in-memory, single tab).
 * Phase 2: swap provider internals to use useWebSocketRoom.
 *          Components below this context need zero changes.
 */
import { createContext, useContext } from 'react'

export const RoomContext = createContext(null)

export function useRoom() {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used inside RoomContext.Provider')
  return ctx
}
