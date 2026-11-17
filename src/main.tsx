import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncSeatProfile } from './seatProfile'
import { syncSearchHistory } from './searchHistory'

// 로그인했으면 계정 취향을 먼저 받아 온다 (화면들은 그려질 때 취향을 한 번 읽는다)
await Promise.all([syncSeatProfile(), syncSearchHistory()])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
