'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Grid, useTheme } from '@mui/material'

export default function About() {
  const theme = useTheme()

  const skills = [
    {
      title: 'Frontend',
      content:
        'Next.js, React, TypeScript, MUI, Redux Toolkit, React Flow, ApexCharts, RTK Query, NextAuth, i18n',
    },
    {
      title: 'Testing & delivery',
      content: 'Playwright, Cypress, GitHub Actions, Postman',
    },
    {
      title: 'Backend & platform',
      content: 'Node.js, Python (FastAPI), WebSockets/SSE, Postgres, Keycloak, Docker',
    },
    {
      title: 'Design & UX',
      content: 'Figma, design systems, accessibility-aware UI, data visualisation',
    },
  ]

  return (
    <Container
      maxWidth="lg"
      id="about"
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
        About
      </Typography>
      <Box sx={{ marginBottom: 3 }}>
        <Typography
          variant="body1"
          sx={{
            color: 'text.primary',
            lineHeight: 1.7,
          }}
        >
          I build data-heavy enterprise UIs with product and research teams, from prototypes in Figma to production in
          React. Lately that has meant AI-assisted workflow canvases, real-time interfaces, and frontends that stay
          usable as features pile on. I use AI tools to move faster on prototyping and debugging, with review and
          automated tests as guardrails. I also turn recurring UI into shared MUI patterns so teams ship more
          consistently. Previously at Garena and Warner Music, now working as a Research Engineer at NTU.
        </Typography>
      </Box>
      <Grid container spacing={1.5}>
        {skills.map((skill) => (
          <Grid item xs={12} sm={6} md={3} key={skill.title}>
            <Paper
              elevation={0}
              sx={{
                backgroundColor: theme.palette.mode === 'dark' ? '#121936' : '#fff',
                border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
                borderRadius: 1.5,
                padding: 1.5,
                height: '100%',
              }}
            >
              <Typography
                component="strong"
                sx={{
                  fontWeight: 600,
                  display: 'block',
                  marginBottom: 0.5,
                }}
              >
                {skill.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {skill.content}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}
