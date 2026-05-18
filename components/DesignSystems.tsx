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
        How I work with design
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
              I turn requirements and wireframes into Figma prototypes, then into reusable MUI components and
              workflow patterns, especially for canvas controls, preview states, and data-heavy screens.
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
                Reusable patterns for canvas controls, previews, and dense data UI
              </ListItem>
              <ListItem sx={{ display: 'list-item', listStyleType: 'disc' }}>
                Work with PMs and researchers to validate UX before and after build
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}
