import { createTheme } from '@mui/material/styles'

export function buildTheme(mode) {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#5C6BC0',
        light: '#8e99f3',
        dark: '#26418f',
      },
      secondary: {
        main: '#EC407A',
      },
      background: {
        default: mode === 'dark' ? '#0f1117' : '#f0f2f8',
        paper:   mode === 'dark' ? '#1a1d27' : '#ffffff',
      },
      ...(mode === 'dark' ? {
        text: { primary: '#e8eaf6', secondary: '#9fa8da' }
      } : {
        text: { primary: '#1a1d27', secondary: '#5c6bc0' }
      }),
    },
    typography: {
      fontFamily: '"DM Sans", sans-serif',
      h6: { fontWeight: 600 },
      subtitle2: { fontWeight: 600, letterSpacing: '0.02em' },
      caption: { fontFamily: '"DM Mono", monospace', fontSize: '0.7rem' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            transition: 'box-shadow 0.2s, transform 0.15s',
            '&:hover': { transform: 'translateY(-1px)' },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.7rem' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundImage: 'none' },
        },
      },
    },
  })
}
