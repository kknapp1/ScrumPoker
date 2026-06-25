import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import LobbyPage from './components/LobbyPage.jsx'
import RoomPage from './components/RoomPage.jsx'

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        {/* Catch-all: redirect unknown paths to lobby */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
