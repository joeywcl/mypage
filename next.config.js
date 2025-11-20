/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Static export for GitHub Pages
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

