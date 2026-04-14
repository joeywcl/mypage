'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Grid, useTheme } from '@mui/material'

export default function About() {
  const theme = useTheme()

  const skills = [
    {
      title: 'Frontend',
      content:
        'Next.js, React, MUI (DataGrid), Redux Toolkit, React Flow, ApexCharts, AngularJS, RTK Query, NextAuth, TypeScript/JavaScript, HTML/CSS, i18n',
    },
    {
      title: 'Testing/DevEx',
      content: 'Cypress, automated testing, GitHub Actions, Postman',
    },
    {
      title: 'Backend/Platform',
      content: 'Node.js, Python (FastAPI/Pydantic), WebSockets/SSE, Postgres, InfluxDB, Keycloak, Docker, Ansible',
    },
    {
      title: 'Design & UX',
      content: 'Figma, design systems, accessible UI',
    },
    {
      title: 'Workflow & Tools',
      content:
        'Cursor, Claude, OpenAI, OpenCode, WebStorm, PyCharm (JetBrains), Jira, Docker, Lens, GitHub, Android Studio · Agile/Scrum',
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
            marginBottom: 2,
            color: 'text.primary',
            lineHeight: 1.7,
          }}
        >
          I build data-heavy enterprise products and work closely with product and research teams, turning early ideas
          into Figma prototypes and then into production-ready UI. My recent work centers on AI-assisted workflow
          canvases, data-rich interfaces, and frontend systems that stay usable even as complexity grows.
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'text.primary',
            lineHeight: 1.7,
          }}
        >
          I specialise in scalable frontend data layers, real-time updates, and interaction design for large workflow
          surfaces, including canvas controls, structured AI progress states, and file preview experiences. I also use
          AI-assisted development tools to speed up prototyping, debugging, and documentation, with review and
          automated testing as guardrails. Previously: Garena (frontend) and Warner Music (full-stack); now a Research
          Engineer at NTU.
        </Typography>
      </Box>
      <Grid container spacing={1.5}>
        {skills.map((skill) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} key={skill.title}>
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
