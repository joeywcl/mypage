'use client'

import * as React from 'react'
import { Container, Typography, Box, Paper, Grid, List, ListItem, useTheme } from '@mui/material'

export default function DesignSystems() {
  const theme = useTheme()

  return (
    <Container
      maxWidth="lg"
      id="design"
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
        UI Platform & Design Systems
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
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
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                marginBottom: 1.25,
              }}
            >
              I translate product requirements and early wireframes into Figma prototypes,
              then turn them into reusable MUI components, workflow patterns, and data-rich
              UI building blocks that help teams ship faster with more consistency.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                marginBottom: 1.25,
              }}
            >
              I also design frontend architecture for large-scale workflow surfaces,
              including streaming states, chart and file previews, multi-step interactions,
              and performance-conscious data flows, while using AI-assisted workflows to
              accelerate iteration without dropping engineering quality.
            </Typography>
            <List
              sx={{
                paddingLeft: 2.25,
                '& .MuiListItem-root': {
                  padding: '2px 0',
                  fontSize: '14px',
                },
              }}
            >
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Shared component library across modules and workflows
              </ListItem>
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Reusable patterns for canvas controls, preview states, and data-heavy UI
              </ListItem>
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Partnered with PMs and researchers to validate UX before and after build
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}
