'use client'

import * as React from 'react'
import { Box, Container, Typography, useTheme } from '@mui/material'

export default function Footer() {
  const theme = useTheme()
  const currentYear = new Date().getFullYear()

  return (
    <Box
      component="footer"
      sx={{
        padding: { xs: '32px 24px', md: '32px 24px' },
        color: 'text.secondary',
        textAlign: 'center',
      }}
    >
      <Typography variant="body2">
        © {currentYear} Joey Wong
      </Typography>
    </Box>
  )
}

