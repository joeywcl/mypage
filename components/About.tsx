'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Grid, useTheme } from '@mui/material'

export default function About() {
  const theme = useTheme()

  const skills = [
    {
      title: 'Frontend',
      content: 'Next.js, React, MUI (DataGrid), ApexCharts, AngularJS, RTK Query, NextAuth, TypeScript/JavaScript, HTML/CSS',
    },
    {
      title: 'Testing/DevEx',
      content: 'Cypress, GitHub Actions, Postman',
    },
    {
      title: 'Backend/Platform',
      content: 'Node.js, Python (FastAPI/Pydantic), Keycloak, Docker',
    },
    {
      title: 'Design & UX',
      content: 'Figma, design systems, accessible UI',
    },
    {
      title: 'Workflow & Tools',
      content: 'WebStorm, PyCharm (JetBrains), Jira, Docker, Lens, GitHub, Android Studio · Agile/Scrum',
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
      <Typography
        variant="body1"
        sx={{
          marginBottom: 3,
          color: 'text.primary',
        }}
      >
        I&apos;ve shipped production features across data-heavy enterprise apps, artist portals, and Android apps.
        I collaborate closely with product and research teams, translate ideas into Figma prototypes and production
        code, and keep quality high with Cypress and CI.
        Experienced in state management and API integration using RTK Query, and in implementing secure
        authentication flows with NextAuth and Keycloak.
        Experienced in integrating REST and schema-validated APIs; familiar with federated data flows and GraphQL
        concepts.
        Familiar with backend databases and deployment tools including Postgres, InfluxDB, Docker, and Ansible.
        Previously the sole frontend for Garena Malaysia; later full-stack at Warner Music; now Research Engineer at
        NTU.
      </Typography>
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

