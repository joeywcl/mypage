'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Chip, useTheme } from '@mui/material'

const languages = [
  'English (native)',
  'Bahasa Malaysia (native)',
  'Mandarin (conversational)',
  'Cantonese (conversational)',
]

export default function BeyondWork() {
  const theme = useTheme()

  return (
    <Container
      maxWidth="lg"
      id="beyond"
      sx={{
        py: 3,
        px: { xs: 3, md: 3 },
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'text.secondary',
          textTransform: 'uppercase',
          marginBottom: 1,
        }}
      >
        Beyond work
      </Typography>
      <Paper
        elevation={0}
        sx={{
          backgroundColor: theme.palette.mode === 'dark' ? '#121936' : '#fff',
          border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
          borderRadius: 2.25,
          padding: 3,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 10px 25px rgba(0, 0, 0, 0.35)'
            : '0 10px 25px rgba(2, 6, 23, 0.08)',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, marginBottom: 2 }}>
          <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
            Before AI, I spent about a decade in gaming. At Garena I was the only frontend developer in Malaysia,
            shipping campaign sites and microsites for League of Legends and EA Sports across Southeast Asia.
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
            I still spend weekends on event floors. I&apos;ve stage-managed the PUBG Mobile Malaysia National
            Championship, run guest liaison for the MLBB Southeast Asia Cup, and worked backstage at Comic Fiesta on
            and off from 2013 to 2024.
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontSize: '12px',
            color: 'text.secondary',
            display: 'block',
            marginBottom: 1,
          }}
        >
          Languages
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {languages.map((language) => (
            <Chip
              key={language}
              label={language}
              size="small"
              sx={{
                fontSize: '12px',
                height: 24,
                borderRadius: '999px',
                backgroundColor: theme.palette.mode === 'dark' ? '#1a244a' : '#edf2ff',
                border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
                color: 'text.secondary',
              }}
            />
          ))}
        </Box>
      </Paper>
    </Container>
  )
}
