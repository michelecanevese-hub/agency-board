import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button,
  Typography, InputAdornment, IconButton, Alert,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const correct = import.meta.env.VITE_BOARD_PASSWORD
    if (password === correct) {
      localStorage.setItem('board_auth', '1')
      onLogin()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme => theme.palette.mode === 'dark'
          ? 'radial-gradient(ellipse at 50% 40%, #1e2140 0%, #0f1117 70%)'
          : 'radial-gradient(ellipse at 50% 40%, #dde3f8 0%, #f0f2f8 70%)',
      }}
    >
      <Card sx={{ width: 360, p: 2 }} elevation={8}>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '50%',
              bgcolor: 'primary.main', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', mb: 2,
            }}>
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>Agency Board</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Inserisci la password per accedere
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              error={error}
              autoFocus
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(v => !v)} edge="end">
                      {showPw ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>Password errata, riprova.</Alert>
            )}
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ fontWeight: 700 }}>
              Entra
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
