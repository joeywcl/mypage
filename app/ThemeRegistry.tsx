'use client'

import * as React from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

const getTheme = (mode: 'light' | 'dark') => {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? '#155eef' : '#6ea8ff',
      },
      secondary: {
        main: mode === 'light' ? '#7c3aed' : '#a78bfa',
      },
      background: {
        default: mode === 'light' ? '#f7f9ff' : '#0b1020',
        paper: mode === 'light' ? '#fff' : '#0e1530',
      },
      text: {
        primary: mode === 'light' ? '#0e1428' : '#e6e8ef',
        secondary: mode === 'light' ? '#4a5678' : '#a8b0c3',
      },
    },
    typography: {
      fontFamily: [
        'Inter',
        'system-ui',
        '-apple-system',
        'Segoe UI',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '44px',
        fontWeight: 700,
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
      },
      h3: {
        fontSize: '20px',
        fontWeight: 600,
      },
      body1: {
        fontSize: '16px',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '14px',
        lineHeight: 1.6,
      },
    },
    shape: {
      borderRadius: 18,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: mode === 'light' 
              ? 'linear-gradient(180deg, #f7f9ff 0%, #fff 40%, #f7f9ff 100%)'
              : 'linear-gradient(180deg, #0b1020 0%, #121936 40%, #0b1020 100%)',
          },
        },
      },
    },
  })
}

export const ThemeContext = React.createContext<{
  mode: 'light' | 'dark'
  toggleTheme: () => void
}>({
  mode: 'dark',
  toggleTheme: () => {},
})

// Get theme from data-theme attribute (set by blocking script) or localStorage
function getInitialMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  
  const dataTheme = document.documentElement.getAttribute('data-theme')
  if (dataTheme === 'light' || dataTheme === 'dark') {
    return dataTheme
  }
  
  try {
    const stored = localStorage.getItem('jw-theme')
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch (e) {
    // localStorage not available
  }
  
  return 'dark'
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMode(getInitialMode())
    setMounted(true)
  }, [])

  const toggleTheme = React.useCallback(() => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light'
      localStorage.setItem('jw-theme', newMode)
      document.documentElement.setAttribute('data-theme', newMode)
      document.documentElement.style.colorScheme = newMode
      return newMode
    })
  }, [])

  const theme = React.useMemo(() => getTheme(mode), [mode])
  const contextValue = React.useMemo(
    () => ({ mode, toggleTheme }),
    [mode, toggleTheme]
  )

  // Prevent hydration mismatch by hiding content until client-side theme is determined
  if (!mounted) {
    return (
      <ThemeProvider theme={getTheme('dark')}>
        <CssBaseline />
        <ThemeContext.Provider value={{ mode: 'dark', toggleTheme }}>
          <div style={{ visibility: 'hidden' }}>{children}</div>
        </ThemeContext.Provider>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ThemeContext.Provider value={contextValue}>
        {children}
      </ThemeContext.Provider>
    </ThemeProvider>
  )
}

