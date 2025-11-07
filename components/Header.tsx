'use client'

import * as React from 'react'
import { AppBar, Toolbar, Box, Button, IconButton, Avatar, useTheme } from '@mui/material'
import { Brightness4, Brightness7 } from '@mui/icons-material'
import { ThemeContext } from '@/app/ThemeRegistry'
import { getAssetPath } from '@/lib/config'

export default function Header() {
  const theme = useTheme()
  const { mode, toggleTheme } = React.useContext(ThemeContext)

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: theme.palette.mode === 'dark' 
          ? 'rgba(11, 16, 32, 0.75)' 
          : 'rgba(247, 249, 255, 0.75)',
        backdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
        boxShadow: 'none',
      }}
    >
      <Toolbar
        sx={{
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
          padding: '14px 24px !important',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Avatar
            src={getAssetPath('/img/profile-photo.jpg')}
            alt="Joey profile"
            sx={{
              width: 40,
              height: 40,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
            }}
            imgProps={{
              style: { objectFit: 'cover' },
            }}
          />
          <Box
            component="h1"
            sx={{
              fontSize: '18px',
              fontWeight: 600,
              margin: 0,
              color: 'text.primary',
            }}
          >
            Wong Cheau Ling (Joey) · Frontend Developer
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            href={getAssetPath('/Wong-Cheau-Ling-Resume.pdf')}
            target="_blank"
            rel="noopener"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6ea8ff, #a78bfa)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a97ff, #9668f9)',
              },
            }}
          >
            View Résumé
          </Button>
          <Button
            variant="outlined"
            href="mailto:jjowcl01@gmail.com"
            aria-label="Email Joey"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              borderColor: theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5',
              backgroundColor: theme.palette.mode === 'dark' ? '#1a244a' : '#edf2ff',
              color: 'text.primary',
              '&:hover': {
                borderColor: theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5',
                backgroundColor: theme.palette.mode === 'dark' ? '#1f2a52' : '#e0e7ff',
              },
            }}
          >
            Email
          </Button>
          <Button
            variant="outlined"
            href="https://github.com/joeywcl"
            target="_blank"
            rel="me noopener"
            aria-label="GitHub"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              borderColor: theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5',
              backgroundColor: theme.palette.mode === 'dark' ? '#1a244a' : '#edf2ff',
              color: 'text.primary',
              '&:hover': {
                borderColor: theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5',
                backgroundColor: theme.palette.mode === 'dark' ? '#1f2a52' : '#e0e7ff',
              },
            }}
          >
            GitHub
          </Button>
          <IconButton
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
            sx={{
              borderRadius: '999px',
              border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
              backgroundColor: theme.palette.mode === 'dark' ? '#1a244a' : '#edf2ff',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? '#1f2a52' : '#e0e7ff',
              },
            }}
          >
            {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

