import type { Metadata, Viewport } from 'next'
import React from 'react'
import Script from 'next/script'
import ThemeRegistry from './ThemeRegistry'
import './theme-init.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://joeywcl.github.io/portfolio'),
  title: 'Wong Cheau Ling (Joey) – Frontend Developer',
  description: 'Frontend Developer in Singapore. Next.js, React, Material UI, Cypress, Python/Pydantic. Building data-driven UIs for enterprise apps and creative products.',
  keywords: ['Frontend Developer', 'Next.js', 'React', 'Material UI', 'TypeScript', 'Web Development', 'Singapore', 'Portfolio'],
  authors: [{ name: 'Wong Cheau Ling (Joey)', url: 'https://github.com/joeywcl' }],
  openGraph: {
    title: 'Wong Cheau Ling (Joey) – Frontend Developer',
    description: 'Next.js, React, Material UI, Cypress, Python/Pydantic. Building data-driven UIs for enterprise apps and creative products.',
    type: 'website',
    url: 'https://joeywcl.github.io/portfolio',
    images: ['/img/dcwiz.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wong Cheau Ling (Joey) – Frontend Developer',
    description: 'Next.js, React, Material UI, Cypress, Python/Pydantic. Building data-driven UIs for enterprise apps and creative products.',
    images: ['/img/dcwiz.png'],
  },
  icons: {
    icon: [
      { url: '/img/favicon/favicon.ico', sizes: 'any' },
      { url: '/img/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/img/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/img/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/img/favicon/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('jw-theme');
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.setAttribute('data-theme', theme);
                    document.documentElement.style.colorScheme = theme;
                  } else {
                    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                    var initialTheme = prefersLight ? 'light' : 'dark';
                    document.documentElement.setAttribute('data-theme', initialTheme);
                    document.documentElement.style.colorScheme = initialTheme;
                  }
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.style.colorScheme = 'dark';
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeRegistry>
          {children}
        </ThemeRegistry>
      </body>
    </html>
  )
}

