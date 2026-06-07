'use client'

import * as React from 'react'
import { Box, Link, Typography } from '@mui/material'

const links = [
  { label: 'Email', href: 'mailto:jjowcl01@gmail.com', external: false },
  { label: 'GitHub', href: 'https://github.com/joeywcl', external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/cheauling-wong/', external: true },
]

export default function Footer() {
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: { xs: 1.5, sm: 2.5 },
          marginBottom: 1.5,
        }}
      >
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            underline="hover"
            sx={{ color: 'text.secondary', fontSize: '14px' }}
          >
            {link.label}
          </Link>
        ))}
      </Box>
      <Typography variant="body2">
        © {currentYear} Joey Wong
      </Typography>
    </Box>
  )
}

