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
      'AI-assisted workflow canvas for complex data analysis: connect nodes, inspect live data, review outputs, and move through dense flows without losing context.',
    image: getAssetPath('/img/dcwiz-canvas.png'),
    imageAlt: 'DCWiz canvas workspace screenshot',
    tags: ['Next.js', 'React Flow', 'MUI', 'Redux Toolkit', 'WebSockets', 'i18n'],
    impact: [
      'Canvas UX: keyboard shortcuts, focus modes, edge visibility controls',
      'AI chat: clearer agent-run progress and source-aware outputs',
      'Rich previews: template charts, multi-sheet Excel, HTML report nodes',
      'Multilingual tooling, export flows, reusable node UI patterns',
    ],
    note: 'Company project (NDA). Details at a high level.',
  },
  {
    title: 'DCWiz – Data-Driven Operations Optimisation',
    description:
      'Enterprise analytics product: Figma prototypes, Next.js + MUI refactor, ApexCharts, Cypress E2E, and FastAPI/Pydantic alignment with the frontend.',
    image: getAssetPath('/img/dcwiz.png'),
    imageAlt: 'DCWiz app screenshot',
    tags: ['Next.js', 'MUI', 'ApexCharts', 'Cypress', 'Keycloak', 'Python (FastAPI/Pydantic)'],
    impact: [
      'Critical fetches ~4s → ~1s',
      'Standardised on MUI across modules',
      'Added Cypress E2E; responsive layouts module-wide',
    ],
    note: 'Company project (NDA). Details at a high level.',
  },
  {
    title: 'Figma Make Bot – AI-Assisted Design Automation',
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
    note: 'Personal experiment — AI-assisted design workflow.',
  },
  {
    title: 'Client Portal – Royalties Data & Insights',
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
    title: 'Analytics – Android App',
    description:
      'Enterprise Android analytics app: shipped pending features, UX improvements, and ongoing maintenance.',
    image: getAssetPath('/img/myanalytics.png'),
    imageAlt: 'Android analytics screenshot',
    tags: ['Android', 'Java', 'Retrofit'],
    impact: [
      'Owned features from development through release and support',
      'Improved stability and in-app UX',
    ],
  },
  {
    title: 'Earlier work – demos, campaigns & microsites',
    description:
      'Internal OKTA demo clone of the analytics app; responsive event and campaign sites across SEA; gaming event and community microsites.',
    image: getAssetPath('/img/myweb.png'),
    imageAlt: 'Collage of earlier web and mobile work',
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
