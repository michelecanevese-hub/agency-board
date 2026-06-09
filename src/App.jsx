import { useState, useMemo } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { buildTheme } from './theme'
import LoginScreen from './components/LoginScreen'
import Board from './components/Board'

function App() {
  const [mode, setMode] = useState(() => localStorage.getItem('theme_mode') || 'light')
  const [authed, setAuthed] = useState(() => localStorage.getItem('board_auth') === '1')

  const theme = useMemo(() => buildTheme(mode), [mode])

  function toggleMode() {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('theme_mode', next)
  }

  function handleLogin() { setAuthed(true) }

  function handleLogout() {
    localStorage.removeItem('board_auth')
    setAuthed(false)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {authed
        ? <Board onLogout={handleLogout} mode={mode} onToggleMode={toggleMode} />
        : <LoginScreen onLogin={handleLogin} />
      }
    </ThemeProvider>
  )
}

export default App
