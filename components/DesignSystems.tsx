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
              padding: 2.25,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 10px 25px rgba(0, 0, 0, 0.35)' 
                : '0 10px 25px rgba(2, 6, 23, 0.08)',
            }}
          >
            <Typography
              variant="h3"
              component="h3"
              sx={{
                marginBottom: 0.75,
                fontSize: '20px',
              }}
            >
              UI Platform & Collaboration
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                marginBottom: 1.25,
              }}
            >
              I translate product requirements and early wireframes into Figma prototypes,
              build reusable MUI components, integrate charts and data grids, and document
              UI patterns to support faster cross-team delivery.
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                marginBottom: 1.25,
              }}
            >
              I also design and maintain frontend architecture for large-scale data flows,
              including real-time streaming updates, multi-page datasets, and performance
              optimisation using RTK Query.
            </Typography>
            <List
              sx={{
                marginTop: 1.25,
                paddingLeft: 2.25,
                '& .MuiListItem-root': {
                  padding: '6px 0',
                  fontSize: '14px',
                },
              }}
            >
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Shared component library across modules
              </ListItem>
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Standardised accessibility theming
              </ListItem>
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Partnered with PMs/Researchers for validation
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

