# Ibda3 Digital — Agency Portfolio

## Project Overview
Portfolio website for **Ibda3 Digital** (إبداع), a web development agency based in Marrakech, Morocco.
Built with Next.js 16 (App Router), Tailwind CSS v4, and next-intl for i18n (French + English).

**Owner:** Ayoub Khyat
**GitHub:** https://github.com/AyoubKhyat
**WhatsApp:** +212 625 461 645

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4 with custom color theme (dark & premium)
- **i18n**: next-intl v4 — French (default) + English
- **Icons**: react-icons (Heroicons + Font Awesome)
- **Routing**: next-intl middleware (proxy.ts in Next.js 16)
- **Node**: Requires Node.js >= 20 (`nvm use 20`)

## Color Theme (Dark & Premium)
- Primary: `#A78BFA` (violet)
- Primary Dark: `#8B6FE0`
- Secondary/Background: `#0F0F1A` (near black)
- Accent: `#F59E0B` (amber)
- Surface: `#1E1E2E` (dark grey cards)
- Text: `#E4E4E7` (light grey)
- Text Muted: `#9CA3AF`

## Project Structure
```
src/
├── app/
│   ├── globals.css              # Tailwind + theme colors
│   ├── layout.tsx               # Root layout (fonts, metadata)
│   └── [locale]/
│       ├── layout.tsx           # Locale layout (Navbar, Footer, WhatsApp)
│       ├── page.tsx             # Home — hero, stats, services preview, CTA
│       ├── services/page.tsx    # Services grid + 3-tier pricing
│       ├── portfolio/page.tsx   # Project cards with filters (client component)
│       ├── blog/page.tsx        # Blog listing with categories
│       ├── about/page.tsx       # Story, why us, values
│       └── contact/page.tsx     # Form + info + WhatsApp + Google Maps
├── components/
│   ├── Navbar.tsx               # Sticky nav with mobile menu + CTA button
│   ├── Footer.tsx               # 4-column footer with social links
│   ├── WhatsAppButton.tsx       # Floating green WhatsApp button (bottom-right)
│   └── LanguageSwitcher.tsx     # FR/EN toggle pill
├── i18n/
│   ├── routing.ts               # Locale config (fr default, en)
│   ├── request.ts               # Server request config
│   └── navigation.ts            # Typed Link, useRouter, usePathname
├── messages/
│   ├── fr.json                  # French translations (all pages)
│   └── en.json                  # English translations (all pages)
└── proxy.ts                     # Locale detection (Next.js 16 uses proxy, not middleware)
```

## Portfolio Projects (from GitHub)
| # | Project | Category | Tech | GitHub Repo |
|---|---------|----------|------|-------------|
| 1 | Gestion de Stock | Application | Laravel, PHP | ManagementStockWeb |
| 2 | Gestion Scolaire | Application | Laravel, PHP | School |
| 3 | Rent-Car | Application | Laravel, PHP | Rent-Car |
| 4 | Sykweb Agency | Site Web | HTML, SCSS, JS | Sykweb_Site |
| 5 | Baraka Idman | Site Web | HTML, CSS | Main-Site-Baraka-Idman |
| 6 | Portal Football | Plugin | WordPress, PHP, JS | portalAddons |

## Commands
```bash
nvm use 20           # Switch to Node 20 (required)
npm run dev          # Dev server (port 3000 or next available)
npm run build        # Production build
npm run lint         # ESLint
```

## Pricing (displayed on Services page)
- **Starter**: À partir de 3,000 MAD — site vitrine simple
- **Pro**: À partir de 8,000 MAD — site avancé avec CMS
- **Business**: À partir de 15,000 MAD — e-commerce ou application sur mesure

## Customization Checklist
- [x] Agency name: "Ibda3 Digital"
- [x] WhatsApp number: +212 625 461 645
- [x] Phone number updated in translations
- [x] Dark & premium color palette applied
- [x] Portfolio populated from real GitHub projects
- [x] Add project images to portfolio cards (GitHub OG images)
- [x] Update contact email to ibda3digital.com (placeholder, not yet connected)
- [x] Connect contact form to EmailJS (service_j25zf74, env vars on Vercel)
- [x] Add real social media links in Footer (Instagram + WhatsApp + Email)
- [ ] Replace Google Maps embed with exact office/home location
- [ ] Add real blog content (consider MDX for posts)
- [ ] Buy and configure domain (ibda3digital.com or ibda3digital.ma)
- [x] Deploy to production — https://ibda3-digital.vercel.app
- [x] Set up analytics (Google Analytics G-PK5HSDWHYM)
- [ ] Create a pitch deck in Claude Design for client meetings

## Changelog
- **2026-05-07** — Initial build
  - Scaffolded Next.js 16 + Tailwind v4 + next-intl
  - Created all 6 pages: Home, Services, Portfolio, Blog, About, Contact
  - Built shared components: Navbar, Footer, WhatsApp button, Language switcher
  - Full FR/EN translations
  - Agency name set to "Ibda3 Digital"
  - WhatsApp: +212 625 461 645
  - Portfolio populated with 6 real projects from GitHub (AyoubKhyat)
  - Applied dark & premium palette (violet #A78BFA, amber #F59E0B, near-black bg)
  - Renamed middleware.ts → proxy.ts for Next.js 16 compatibility
- **2026-05-08** — Bug fixes & UI polish
  - Fixed hardcoded French text in Footer service links (now translated)
  - Fixed hardcoded "Populaire" badge on Services page (now uses translation key)
  - Fixed `<html>` missing `lang` attribute — moved html/body to locale layout
  - Fixed contact form: added name attributes, proper labels, success state (replaces alert)
  - Made Portfolio "View Project" button link to GitHub repos
  - Blog "Read More" replaced with "Coming Soon" (no blog pages yet)
  - Added aria-labels to Footer social icons
  - Fixed WhatsApp button z-index (z-40) to not conflict with Navbar (z-50)
  - Added max-height + scroll to mobile nav menu
  - Fixed feature list comma spacing in translations
  - Fixed WhatsApp link in Footer (was dead #, now links to wa.me)
  - Updated contact email from webcraft-marrakech to ibda3digital.com
  - Added per-page SEO metadata (Services, Blog, About + locale layout)
  - Removed unused imports
- **2026-05-08** — Contact form + deploy
  - Integrated EmailJS (@emailjs/browser) with loading, success, and error states
  - Added SetLang client component for dynamic html lang attribute
  - Fixed dev mode crash (html/body must be in root layout in Next.js 16)
  - Deployed to Vercel: https://ibda3-digital.vercel.app
  - Set EmailJS env vars on Vercel (NEXT_PUBLIC_EMAILJS_*)
- **2026-05-08** — Portfolio images + social links
  - Added GitHub OG images to portfolio cards with hover zoom
  - Configured next/image for opengraph.githubassets.com
  - Added real social links: Instagram (@ibda3.digital0), WhatsApp, Email
  - Removed placeholder Facebook/LinkedIn icons
  - Updated contact email to ibda3.digital0@gmail.com
- **2026-05-08** — Analytics
  - Added Google Analytics (G-PK5HSDWHYM) via next/script in root layout
- **2026-05-08** — Full visual redesign (pitch deck style)
  - Redesigned all 6 pages to match premium pitch deck aesthetic
  - New typography: Inter (body), Instrument Serif (headlines), JetBrains Mono (accents)
  - Added globals.css utility classes: `.grid-bg`, `.glow`, `.pill` for consistent design language
  - Home: cover-style hero with giant serif title, stats row, numbered service cards, CTA
  - Services: numbered solution cards (01–03), maintenance card, pricing table rows
  - Portfolio: bento grid layout with filter buttons, hover effects on project cards
  - Blog: table-row layout with numbered posts, "Coming Soon" labels
  - About: two-column "Why Us" with numbered reasons, 4-step process flow with timeline
  - Contact: hero with contact info card, form with EmailJS, WhatsApp CTA, Google Maps
  - Navbar: simplified with logo mark (gradient "i" square), mono brand text
  - Footer: mono headings, circular social icons with border hover
  - Fixed circular CSS variable bug (`--font-serif: var(--font-serif)` → `--font-instrument`)
- **2026-05-08** — Light/dark theme toggle
  - Light theme as default, dark mode via toggle button (sun/moon icon)
  - Dual-theme CSS variable system in globals.css (`:root` light, `.dark` dark)
  - Created ThemeToggle component with localStorage persistence
  - Inline script in root layout prevents flash of wrong theme
  - Updated all pages: `text-white` → `text-foreground`, `bg-secondary` → `bg-background`
  - Fixed LanguageSwitcher colors for theme compatibility
  - Navbar background adapts via `--nav-bg` CSS variable
  - Primary buttons always use `text-white` for contrast on both themes
