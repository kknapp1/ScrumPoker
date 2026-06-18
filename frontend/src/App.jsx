import { Routes, Route, Navigate } from 'react-router-dom'
import LobbyPage from './components/LobbyPage.jsx'
import RoomPage from './components/RoomPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      {/* Catch-all: redirect unknown paths to lobby */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
