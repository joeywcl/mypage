'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Grid, Chip, List, ListItem, useTheme } from '@mui/material'
import Image from 'next/image'
import { getAssetPath } from '@/lib/config'

interface Project {
  title: string
  description: string
  image: string
  imageAlt: string
  tags: string[]
  impact?: string[]
  links?: Array<{ label: string; href: string }>
  note?: string
}

const projects: Project[] = [
  {
    title: 'DCWiz Canvas – AI-Powered Workflow Builder',
    description:
      'I built an interactive canvas for visual data workflows: drag-and-drop nodes, connect live metrics and documents, and generate AI analysis with source traceability.',
    image: getAssetPath('/img/dcwiz-canvas.png'),
    imageAlt: 'DCWiz canvas workspace screenshot',
    tags: ['Next.js', 'React Flow', 'MUI', 'Redux Toolkit', 'WebSockets', 'i18n'],
    impact: [
      'Implemented a node-based workflow UI with custom node types',
      'Added AI answer node with sources + downloadable outputs',
      'Built multi-language UI (EN / ZH-CN / MS)',
      'Exported canvas to PNG/PDF for sharing',
    ],
    note: 'Company project (NDA). Details shared at a high level.',
  },
  {
    title: 'DCWiz – Data-Driven Operations Optimisation',
    description:
      'I translated product requirements and wireframes into Figma prototypes, led a Next.js + MUI refactor, integrated ApexCharts for interactive analytics, added Cypress E2E coverage, and aligned FastAPI router schemas with Pydantic for data validation.',
    image: getAssetPath('/img/dcwiz.png'),
    imageAlt: 'DCWiz app screenshot',
    tags: ['Next.js', 'MUI', 'ApexCharts', 'Cypress', 'Keycloak', 'Python (FastAPI/Pydantic)'],
    impact: [
      'Improved critical fetches ~4s → ~1s',
      'Standardised UI library',
      'Introduced E2E tests',
      'Implemented fully responsive layouts across modules',
    ],
    note: 'Company project (NDA). Details shared at a high level.',
  },
  {
    title: 'Client Portal – Royalties Data & Insights',
    description: 'I collaborated with enterprise clients to rebrand and enhance the royalties analytics portal.',
    image: getAssetPath('/img/portal.png'),
    imageAlt: 'Client portal screenshot',
    tags: ['AngularJS', 'Node.js', 'D3.js'],
    impact: [
      'Maintained high-traffic analytics views',
      'Delivered monthly iterations in sprints',
    ],
  },
  {
    title: 'Analytics – Android App',
    description: 'I completed pending features, improved UX, and maintained an enterprise Android analytics app.',
    image: getAssetPath('/img/myanalytics.png'),
    imageAlt: 'Android analytics screenshot',
    tags: ['Android', 'Java', 'Retrofit'],
    impact: [
      'Ownership from dev → release → support',
      'Improved stability & UX',
    ],
  },
  {
    title: 'Demo App – OKTA Auth Layer',
    description: 'I cloned the Analytics app for an internal demo and added an extra authentication layer.',
    image: getAssetPath('/img/demoanalytics.png'),
    imageAlt: 'Demo Android app screenshot',
    tags: ['Android', 'OKTA'],
  },
  {
    title: 'Landing & Static Pages',
    description: 'I designed and built responsive event and campaign sites across SEA.',
    image: getAssetPath('/img/myweb.png'),
    imageAlt: 'Landing pages collage',
    tags: ['HTML', 'CSS', 'JavaScript', 'Bootstrap'],
  },
  {
    title: 'Freelance Microsites',
    description: 'I built microsites for gaming events and community projects.',
    image: getAssetPath('/img/freelance.png'),
    imageAlt: 'Freelance microsites collage',
    tags: ['HTML', 'CSS', 'JavaScript'],
  },
]

export default function Projects() {
  const theme = useTheme()

  return (
    <Container
      maxWidth="lg"
      id="projects"
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
        Featured Projects
      </Typography>
      <Grid container spacing={2}>
        {projects.map((project) => (
          <Grid item xs={12} md={6} key={project.title} sx={{ display: 'flex' }}>
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme.palette.mode === 'dark' ? '#121936' : '#fff',
                border: `1px solid ${theme.palette.mode === 'dark' ? '#223057' : '#e6e9f5'}`,
                borderRadius: 2.25,
                overflow: 'hidden',
                boxShadow: theme.palette.mode === 'dark' 
                  ? '0 10px 25px rgba(0, 0, 0, 0.35)' 
                  : '0 10px 25px rgba(2, 6, 23, 0.08)',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: 240,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={project.image}
                  alt={project.imageAlt}
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </Box>
              <Box sx={{ padding: 2.25, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography
                  variant="h3"
                  component="h3"
                  sx={{
                    marginBottom: 0.75,
                    fontSize: '20px',
                  }}
                >
                  {project.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    marginBottom: 1.25,
                  }}
                >
                  {project.description}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    marginTop: 1.25,
                    marginBottom: project.impact ? 0 : 'auto',
                  }}
                >
                  {project.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
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
                {project.impact && (
                  <List
                    sx={{
                      marginTop: 1.25,
                      paddingLeft: 2.25,
                      '& .MuiListItem-root': {
                        padding: '2px 0',
                        fontSize: '14px',
                      },
                    }}
                  >
                    {project.impact.map((item, index) => (
                      <ListItem key={index} sx={{ display: 'list-item', listStyleType: 'disc' }}>
                        {item}
                      </ListItem>
                    ))}
                  </List>
                )}
                {(project.links?.length || project.note) && (
                  <Box sx={{ marginTop: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {!!project.links?.length && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {project.links.map((link) => (
                          <Chip
                            key={`${project.title}-${link.label}`}
                            component="a"
                            href={link.href}
                            target="_blank"
                            rel="noopener"
                            clickable
                            label={link.label}
                            size="small"
                            sx={{
                              fontSize: '12px',
                              height: 26,
                              borderRadius: '999px',
                              textDecoration: 'none',
                              backgroundColor: theme.palette.mode === 'dark' ? '#101a3a' : '#fff',
                              border: `1px solid ${theme.palette.mode === 'dark' ? '#2a3a67' : '#d8def2'}`,
                              color: 'text.primary',
                            }}
                          />
                        ))}
                      </Box>
                    )}
                    {project.note && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {project.note}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}

