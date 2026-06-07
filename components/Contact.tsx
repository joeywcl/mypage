'use client'

import * as React from 'react'
import { Container, Box, Typography, Button, useTheme } from '@mui/material'
import { getAssetPath } from '@/lib/config'

export default function Contact() {
  const theme = useTheme()

  return (
    <Container
      maxWidth="lg"
      id="contact"
      sx={{
        py: 3,
        px: { xs: 3, md: 3 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          background: 'linear-gradient(135deg, #6ea8ff, #a78bfa)',
          color: '#fff',
          borderRadius: 2.25,
          padding: 3,
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 10px 25px rgba(0, 0, 0, 0.35)' 
            : '0 10px 25px rgba(2, 6, 23, 0.08)',
        }}
      >
        <Box>
          <Typography
            variant="h3"
            component="h3"
            sx={{
              marginBottom: 1,
              fontSize: '20px',
              color: '#fff',
            }}
          >
            Open to frontend, software, and full-stack roles.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Singapore, Malaysia, or remote. Especially interested in data-heavy products and workflow tooling. Résumé
            and links below, or email me directly.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', marginTop: { xs: 2, md: 0 } }}>
          <Button
            variant="outlined"
            href="mailto:jjowcl01@gmail.com"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: '#fff',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
              },
            }}
          >
            Email me
          </Button>
          <Button
            variant="outlined"
            href="https://www.linkedin.com/in/cheauling-wong/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: '#fff',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
              },
            }}
          >
            LinkedIn
          </Button>
          <Button
            variant="outlined"
            href={getAssetPath('/CheauLing_Wong_resume.pdf')}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: '#fff',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
              },
            }}
          >
            Résumé
          </Button>
        </Box>
      </Box>
    </Container>
  )
}
