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
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: { xs: '12px 16px !important', md: '14px 24px !important' },
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
          <Avatar
            src={getAssetPath('/img/profile-photo.jpg')}
            alt="Joey profile"
            sx={{
              width: { xs: 34, sm: 40 },
              height: { xs: 34, sm: 40 },
              flexShrink: 0,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
            }}
            imgProps={{
              style: { objectFit: 'cover' },
            }}
          />
          <Box
            component="h1"
            sx={{
              fontSize: { xs: '14px', sm: '18px' },
              fontWeight: 600,
              margin: 0,
              color: 'text.primary',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            Wong Cheau Ling (Joey)
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              {' · Frontend Engineer · Full Stack'}
            </Box>
          </Box>
        </Box>
        <Box
          component="nav"
          aria-label="Sections"
          sx={{ display: { xs: 'none', lg: 'flex' }, gap: '4px', alignItems: 'center', flexShrink: 0 }}
        >
          {[
            { label: 'Work', href: '#projects' },
            { label: 'About', href: '#about' },
            { label: 'Contact', href: '#contact' },
          ].map((link) => (
            <Button
              key={link.href}
              href={link.href}
              disableRipple
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '15px',
                color: 'text.secondary',
                px: 1.25,
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: 'text.primary',
                },
                '&.Mui-focusVisible': {
                  color: 'text.primary',
                  outline: '2px solid #6ea8ff',
                  outlineOffset: '2px',
                },
              }}
            >
              {link.label}
            </Button>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: { xs: '8px', md: '18px' }, alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          <Button
            variant="contained"
            href={getAssetPath('/CheauLing_Wong_resume.pdf')}
            target="_blank"
            rel="noopener"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              minWidth: 'auto',
              px: { xs: 1.5, sm: 2 },
              background: 'linear-gradient(135deg, #6ea8ff, #a78bfa)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a97ff, #9668f9)',
              },
            }}
          >
            Résumé
          </Button>
          <Button
            variant="outlined"
            href="mailto:jjowcl01@gmail.com"
            aria-label="Email Joey"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
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
              display: { xs: 'none', sm: 'inline-flex' },
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
