'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Grid, useTheme } from '@mui/material'

const highlights = [
  { stat: '10+ yrs', label: 'shipping production products across AI, media & gaming' },
  { stat: '~4s → ~1s', label: 'cut critical fetch times with parallelisation & caching' },
  { stat: '0 → 1', label: 'built the DCWiz AI canvas from scratch, now used in enterprise demos' },
  { stat: '2 upgrades', label: 'led frontend Keycloak / NextAuth through two major upgrades' },
]

export default function Highlights() {
  const theme = useTheme()

  return (
    <Container
      maxWidth="lg"
      sx={{
        pt: 0,
        pb: 3,
        px: { xs: 3, md: 3 },
      }}
    >
      <Grid container spacing={1.5}>
        {highlights.map((item) => (
          <Grid item xs={6} md={3} key={item.stat} sx={{ display: 'flex' }}>
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                backgroundColor: theme.palette.mode === 'dark' ? '#121936' : '#fff',
                border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
                borderRadius: 2.25,
                padding: { xs: 1.75, md: 2.25 },
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 10px 25px rgba(0, 0, 0, 0.35)'
                  : '0 10px 25px rgba(2, 6, 23, 0.08)',
              }}
            >
              <Typography
                component="div"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '22px', md: '26px' },
                  lineHeight: 1.1,
                  marginBottom: 0.75,
                  background: 'linear-gradient(135deg, #6ea8ff, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {item.stat}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                {item.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}
