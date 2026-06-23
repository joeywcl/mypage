'use client'

import * as React from 'react'
import { Box, Container, Typography, Button, Paper, Grid, useTheme } from '@mui/material'

export default function Hero() {
  const theme = useTheme()

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: { xs: 4, md: 7 },
        px: { xs: 3, md: 3 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
          gap: 4,
          alignItems: 'center',
        }}
      >
        <Box>
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              maxWidth: '100%',
              whiteSpace: 'normal',
              padding: '8px 14px',
              borderRadius: '16px',
              backgroundColor: theme.palette.mode === 'dark' ? '#1a244a' : '#edf2ff',
              border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
              fontSize: { xs: '13px', sm: '14px' },
              lineHeight: 1.6,
              color: 'text.secondary',
              marginBottom: 2,
            }}
          >
              Singapore · React · Next.js · TypeScript · workflow & data UI
          </Box>
          <Typography
            variant="h2"
            component="h2"
            sx={{
              marginBottom: 1.5,
              fontSize: { xs: '32px', md: '44px' },
            }}
          >
            Frontend engineer, 10+ years building complex, data-heavy UIs.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              marginBottom: 2.75,
            }}
          >
            For the past three years I&apos;ve taken the DCWiz AI canvas from an empty repo to the product the team
            now demos to enterprise clients: real-time sessions, workflow tooling, charts, and file previews in React
            and Next.js. When it helps, I go deeper into APIs, auth, testing, and CI.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', marginTop: 1.5 }}>
            <Button
              variant="contained"
              href="#projects"
              sx={{
                borderRadius: '999px',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6ea8ff, #a78bfa)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a97ff, #9668f9)',
                },
              }}
            >
              See my work
            </Button>
            <Button
              variant="outlined"
              href="#contact"
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
              Get in touch
            </Button>
          </Box>
        </Box>
        <Paper
          elevation={0}
          sx={{
            backgroundColor: theme.palette.mode === 'dark' ? '#0e1530' : '#fff',
            border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
            borderRadius: 2.25,
            padding: 2.25,
            boxShadow: theme.palette.mode === 'dark' 
              ? '0 10px 25px rgba(0, 0, 0, 0.35)' 
              : '0 10px 25px rgba(2, 6, 23, 0.08)',
          }}
        >
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '12px',
                  color: 'text.secondary',
                  display: 'block',
                  marginBottom: 0.5,
                }}
              >
                Focus
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Workflow UIs, React Flow canvases, charts & previews, MUI component patterns
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '12px',
                  color: 'text.secondary',
                  display: 'block',
                  marginBottom: 0.5,
                }}
              >
                Also hands-on
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Python/FastAPI, WebSockets/SSE, Playwright/Cypress, GitHub Actions
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '12px',
                  color: 'text.secondary',
                  display: 'block',
                  marginBottom: 0.5,
                }}
              >
                Background
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Frontend / Full Stack Engineer at NTU (Red Dot AI) · ex-Garena · ex-Warner Music
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Container>
  )
}
