/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Static export for GitHub Pages
  // basePath: '/portfolio', // Removed - deploying at root
  // assetPrefix: '/portfolio/', // Removed - deploying at root
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

