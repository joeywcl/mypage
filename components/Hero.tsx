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
              display: 'inline-flex',
              gap: 1,
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '999px',
              backgroundColor: theme.palette.mode === 'dark' ? '#1a244a' : '#edf2ff',
              border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
              fontSize: '14px',
              color: 'text.secondary',
              marginBottom: 2,
            }}
          >
              Singapore · Next.js · React · Workflow UI · AI UX · FastAPI
          </Box>
          <Typography
            variant="h2"
            component="h2"
            sx={{
              marginBottom: 1.5,
              fontSize: { xs: '32px', md: '44px' },
            }}
          >
            Building AI-assisted workflow tools that make complex data easier to navigate, trust, and act on.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              marginBottom: 2.75,
            }}
          >
            Frontend engineer building data-heavy enterprise products from Figma to production. I focus on workflow
            UX, real-time interfaces, rich data preview experiences, and reliable delivery for complex internal tools.
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
                Current Focus
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Workflow UIs, AI-assisted interfaces, data visualisation, design systems
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
                Also Hands-on With
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Python (FastAPI/Pydantic), streaming UX, auth flows, GitHub Actions
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
                What I Value
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Clarity, maintainability, and empathetic UX
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
                Collaboration
              </Typography>
              <Typography component="strong" sx={{ fontWeight: 600, display: 'block' }}>
                Cross-functional teamwork & design alignment
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Container>
  )
}
