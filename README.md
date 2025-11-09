# Wong Cheau Ling (Joey) – Portfolio

A modern, responsive portfolio website showcasing my work as a Frontend Developer.

## 🚀 Live Site

[View Portfolio](https://joeywcl.github.io/)

## ✨ Features

- **Modern Design**: Clean, minimal interface with dark/light theme support
- **Responsive**: Fully responsive layout optimized for all devices
- **Next.js + MUI**: Built with Next.js 14 and Material-UI for modern React development
- **SEO Optimized**: Meta tags and semantic HTML with Next.js metadata API
- **Accessible**: Proper ARIA labels and keyboard navigation
- **TypeScript**: Type-safe development experience

## 🛠️ Tech Stack

- **Next.js 14**: React framework with App Router
- **Material-UI (MUI)**: Component library with custom theming
- **TypeScript**: Type-safe JavaScript
- **Emotion**: CSS-in-JS styling solution
- **Google Fonts**: Inter font family

## 📁 Project Structure

```
portfolio/
├── app/
│   ├── layout.tsx          # Root layout with metadata & theme init script
│   ├── page.tsx            # Home page
│   ├── ThemeRegistry.tsx   # MUI theme provider with dark/light mode
│   └── theme-init.css      # CSS for preventing theme flash
├── components/
│   ├── Header.tsx          # Navigation header with theme toggle
│   ├── Hero.tsx            # Hero section
│   ├── About.tsx           # About section
│   ├── Projects.tsx        # Projects showcase
│   ├── DesignSystems.tsx   # Design systems section
│   ├── Contact.tsx         # Contact section
│   └── Footer.tsx          # Footer
├── public/
│   ├── img/                # Images and favicons
│   └── Wong-Cheau-Ling-Resume.pdf
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions deployment
├── package.json
├── next.config.js
└── tsconfig.json
```

## 🔧 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

4. Build for production:
   ```bash
   npm run build
   ```

5. Start production server:
   ```bash
   npm start
   ```

## 🚀 Deployment

The site is configured for GitHub Pages deployment using GitHub Actions. The workflow automatically builds and deploys on push to `main` branch.

### Manual Deployment

1. Build the static export:
   ```bash
   npm run build
   ```

2. The `out` directory contains the static files ready for deployment

## 📝 Technical Notes

### Theme Implementation
- **Theme Persistence**: User preference saved in `localStorage` as `jw-theme`
- **Hydration Fix**: Blocking script in `layout.tsx` sets theme before React hydrates
- **No Flash**: CSS in `theme-init.css` applies correct background immediately
- **SSR Safety**: Content hidden until client-side theme is determined, preventing mismatches

### Deployment
- Uses Next.js static export (`output: 'export'`) for GitHub Pages compatibility
- Images are unoptimized for static hosting
- All components are client-side rendered (`'use client'`) for theme toggle functionality
- Redirects are set up for backward compatibility:
  - `/portfolio` → redirects to root `/`
  - `/mypage` → redirects to root `/`

## 🎨 Features Breakdown

- **Hero Section**: Clear value proposition and key skills
- **About Section**: Professional background and skill categories
- **Projects**: Featured work with impact metrics and tech stack tags
- **Design Systems**: UI platform and collaboration experience
- **Contact**: Easy ways to get in touch

---

Built with ❤️ by [Joey Wong](https://github.com/joeywcl)
