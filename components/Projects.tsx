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
    title: 'Red Dot AI Rebrand: Wix → Webflow, Solo',
    description:
      'Took the company rebrand end to end. Migrated the corporate site from Wix to Webflow and built a second site, Red Dot Space, from scratch. Both shipped to production within a month.',
    image: getAssetPath('/img/rebrand.jpg'),
    imageAlt: 'Red Dot AI Webflow rebrand screenshot',
    tags: ['Webflow', 'CMS', 'SEO', 'GA4', 'Claude MCP', 'HTML/CSS'],
    impact: [
      'Migrated rda.ai from Wix to Webflow, and built reddot.space from scratch',
      'Leaned on Claude and Claude MCP for refactoring and CMS iteration, saving roughly 8 days',
      'Set up SEO, GA4, and Google Search Console on both sites',
      'Built an internal branding system: a shared brand design system, plus self-serve name card and email signature generators',
    ],
    links: [
      { label: 'rda.ai', href: 'https://rda.ai' },
      { label: 'reddot.space', href: 'https://reddot.space' },
    ],
  },
  {
    title: 'DCWiz AI Canvas: real-time workflow builder',
    description:
      'Built from scratch in Next.js and React Flow, and grown into a production tool used in enterprise demos. Connect nodes, inspect live data, review outputs, and move through dense flows without losing context.',
    // TODO: replace with a lighter, more zoomed-in canvas shot (current image reads dark/hard to scan).
    // Capture from the running app — workflow mid-run with a chart/preview visible. Do not fake one.
    image: getAssetPath('/img/dcwiz-canvas.png'),
    imageAlt: 'DCWiz canvas workspace screenshot',
    tags: ['Next.js', 'React Flow', 'MUI', 'Redux Toolkit', 'SSE', 'i18n'],
    impact: [
      'Built real-time multi-user sessions with SSE streaming for live agent runs',
      'Shipped rich previews: image upload (MinIO), multi-sheet XLSX, HTML report nodes, chart templates',
      'Refined the canvas UX with keyboard shortcuts, focus modes, and edge visibility controls',
      'Turned recurring UI into reusable node patterns, export flows, and multilingual tooling',
    ],
    note: 'Built at NTU · Red Dot AI. Shown at a high level.',
  },
  {
    title: 'DCWiz platform: simulation, monitoring & AI recommendations',
    description:
      'The broader enterprise analytics product: Figma prototypes through a Next.js + MUI architecture refactor, with FastAPI/Pydantic aligned to the frontend.',
    image: getAssetPath('/img/dcwiz.png'),
    imageAlt: 'DCWiz app screenshot',
    tags: ['Next.js', 'MUI', 'ApexCharts', 'Cypress', 'Keycloak', 'Python (FastAPI/Pydantic)'],
    impact: [
      'Cut critical fetches from ~4s to ~1s with request parallelisation and caching',
      'Led the frontend Keycloak/NextAuth integration through two major upgrades (v6→v9, v22→v25)',
      'Delivered simulation, monitoring, and AI-recommendation modules: version history, model comparison, view-only access, XLSX export',
      'Standardised on MUI across modules and added Cypress E2E with responsive layouts',
    ],
    note: 'Built at NTU · Red Dot AI. Shown at a high level.',
  },
  {
    title: 'Figma Make Bot: AI-Assisted Design Automation',
    description:
      'Side project: turns a topic, spec, or URL into a Figma Make prompt, submits it, and iterates via screenshot-based review and targeted fixes.',
    image: getAssetPath('/img/figma-make-bot.png'),
    imageAlt: 'Figma Make Bot review and generation workflow screenshot',
    tags: ['TypeScript', 'OpenAI', 'Playwright', 'Figma Make', 'Prompt Design'],
    impact: [
      'Structured prompts from ideas, docs, and reference URLs',
      'Automated submit/retry in Figma Make with follow-up fixes',
      'Screenshot review for fidelity and demo readiness; logged iterations',
    ],
    note: 'Personal experiment in AI-assisted design workflow.',
  },
  {
    title: 'Client Portal: Royalties Data & Insights',
    description:
      'Enterprise royalties portal: rebranding and analytics enhancements with client stakeholders.',
    image: getAssetPath('/img/portal.png'),
    imageAlt: 'Client portal screenshot',
    tags: ['AngularJS', 'Node.js', 'D3.js'],
    impact: [
      'High-traffic analytics views in production',
      'Monthly sprint deliveries with enterprise clients',
    ],
  },
  {
    title: 'Analytics: Android App',
    description:
      'Enterprise Android analytics app: shipped pending features, UX improvements, and ongoing maintenance.',
    image: getAssetPath('/img/myanalytics.png'),
    imageAlt: 'Android analytics screenshot',
    tags: ['Android', 'Java', 'Retrofit'],
    impact: [
      'Delivered features from development through release and support',
      'Improved stability and in-app UX',
    ],
  },
  {
    title: 'Earlier work: demos, campaigns & microsites',
    description:
      'Internal OKTA demo clone of the analytics app; responsive event and campaign sites across SEA; gaming event and community microsites.',
    image: getAssetPath('/img/myweb.jpg'),
    imageAlt: 'Collage of earlier demos, OKTA app, campaign sites, and gaming microsites',
    tags: ['Android', 'OKTA', 'HTML', 'CSS', 'JavaScript', 'Bootstrap'],
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
        Selected work
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
                            rel="noopener noreferrer"
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
