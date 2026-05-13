# Ibda3 Digital — Agency Portfolio

## Project Overview
Portfolio website for **Ibda3 Digital** (إبداع), a web development agency based in Marrakech, Morocco.
Built with Next.js 16 (App Router), Tailwind CSS v4, and next-intl for i18n (French + English + Arabic).

**Owner:** Ayoub Khyat
**GitHub:** https://github.com/AyoubKhyat
**WhatsApp:** +212 625 461 645

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4 with custom color theme (dark & premium)
- **i18n**: next-intl v4 — French (default) + English + Arabic (RTL)
- **Database**: SQLite via Prisma v7 + better-sqlite3 driver adapter
- **Auth**: JWT (bcryptjs + jose) — cookie-based session
- **Validation**: Zod for API request validation
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
prisma/
├── schema.prisma                # DB schema (AdminUser, Project, ProjectTranslation, Lead, LeadNote)
├── seed.ts                      # Seeds existing projects + admin user from JSON files
src/
├── app/
│   ├── globals.css              # Tailwind + theme colors
│   ├── layout.tsx               # Root layout (fonts, metadata)
│   ├── [locale]/
│   │   ├── layout.tsx           # Locale layout (Navbar, Footer, WhatsApp)
│   │   ├── page.tsx             # Home — hero, stats, services preview, CTA (async, reads DB)
│   │   ├── services/page.tsx    # Services grid
│   │   ├── portfolio/page.tsx   # Server component → fetches from DB → PortfolioGrid client
│   │   ├── portfolio/[slug]/    # Case study page (reads from DB)
│   │   ├── blog/page.tsx        # Blog listing with categories
│   │   ├── about/page.tsx       # Story, why us, values
│   │   └── contact/page.tsx     # Form + EmailJS + saves lead to DB
│   ├── admin/
│   │   ├── layout.tsx           # Sidebar nav + auth guard
│   │   ├── page.tsx             # Dashboard: stats cards
│   │   ├── login/page.tsx       # Login form
│   │   ├── projects/
│   │   │   ├── page.tsx         # Projects table with visibility toggle, edit, delete
│   │   │   ├── ProjectForm.tsx  # Shared form: drag-drop image, locale picker, auto-slug
│   │   │   ├── new/page.tsx     # Create project
│   │   │   └── [id]/edit/       # Edit project
│   │   └── leads/
│   │       ├── page.tsx         # Leads inbox with status filters + pagination
│   │       └── [id]/page.tsx    # Lead detail: message, status dropdown, notes
│   └── api/
│       ├── contact/route.ts     # POST — save lead to DB
│       └── admin/
│           ├── login/route.ts   # POST — JWT cookie auth
│           ├── logout/route.ts  # POST — clear cookie
│           ├── upload/route.ts  # POST — drag-drop image → webp to public/projects/
│           ├── projects/
│           │   ├── route.ts     # GET list, POST create (auto-fills 3 locales)
│           │   ├── [id]/route.ts# GET, PUT, DELETE, PATCH (toggle visibility)
│           │   └── reorder/     # PUT — batch sortOrder update
│           └── leads/
│               ├── route.ts     # GET paginated list (filterable by status)
│               ├── [id]/route.ts# GET detail, PATCH status
│               └── [id]/notes/  # POST add note
├── lib/
│   ├── prisma.ts                # Singleton PrismaClient with better-sqlite3 adapter
│   ├── auth.ts                  # JWT auth: sign/verify token, session cookies
│   └── dal.ts                   # Data Access Layer (all DB queries)
├── components/
│   ├── PortfolioGrid.tsx        # Client component: filter + animated grid (data from server)
│   ├── Navbar.tsx               # Sticky nav with mobile menu + CTA button
│   ├── Footer.tsx               # 4-column footer with social links
│   ├── WhatsAppButton.tsx       # Floating green WhatsApp button (bottom-right)
│   ├── LanguageSwitcher.tsx     # FR/EN/AR toggle pill
│   ├── ThemeToggle.tsx          # Light/dark mode toggle with localStorage
│   └── SetLang.tsx              # Sets html lang + dir (RTL for Arabic)
├── i18n/
│   ├── routing.ts               # Locale config (fr default, en, ar)
│   ├── request.ts               # Server request config
│   └── navigation.ts            # Typed Link, useRouter, usePathname
├── messages/
│   ├── fr.json                  # French translations (all pages)
│   ├── en.json                  # English translations (all pages)
│   └── ar.json                  # Arabic translations (all pages, RTL)
└── proxy.ts                     # Locale detection + admin route exclusion
```

## Portfolio Projects (managed via admin dashboard — stored in SQLite DB)
| # | Project | Category | Link |
|---|---------|----------|------|
| 1 | Hammam Nour | Web | [Live](https://hammam-nour.vercel.app/) |
| 2 | Goudoukh Luxury Cars | Web | [Live](https://goudoukh-luxury-cars.vercel.app/) |
| 3 | Tannour | Web / E-commerce | [Live](https://tannour.vercel.app/) |
| 4 | Terrene Studio | Web | [Live](https://terrene.webyms.com/) |
| 5 | Victory Path | App | [Live](https://victory-path-beta.vercel.app/login) |
| 6 | Aylani Parfums | Web / E-commerce | [Live](https://aylani-parfums.vercel.app) |

## Commands
```bash
nvm use 20                    # Switch to Node 20 (required)
npm run dev                   # Dev server (port 3000 or next available)
npm run build                 # Production build
npm run lint                  # ESLint
npx prisma db push            # Create/update DB tables from schema
npx tsx prisma/seed.ts         # Seed DB with existing projects + admin user
```

## Admin Dashboard
- **URL**: `/admin` (login at `/admin/login`)
- **Default credentials**: email from ADMIN_EMAIL env var, password from ADMIN_PASSWORD env var
- **Auth**: JWT cookie (`admin_token`), 7-day expiry
- **Features**:
  - Dashboard with stats cards (projects count, leads count)
  - Project CRUD: create/edit/delete, visibility toggle, drag-drop image upload (auto webp)
  - Single-locale input: write in FR/EN/AR, other locales auto-filled
  - Slug auto-generated from title
  - Leads inbox: status filters (NEW/CONTACTED/QUALIFIED/CLOSED), pagination, internal notes
  - Contact form submissions saved to DB alongside EmailJS
- **Database**: SQLite file at `./dev.db` (project root)
- **Env vars**: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

## Services (displayed on Services page)
1. **Websites** — Modern, responsive showcase sites
2. **E-Commerce** — Online stores with payment & inventory
3. **Mobile Apps** — iOS & Android apps
4. **SEO** — Technical SEO, keyword strategy, optimization
5. **Maintenance & Support** — Monthly update/security packages

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
- [x] Favicon replaced with Ibda3 Digital logo
- [x] Theme-aware navbar logos (light: logo_transparent, dark: Logo_horizontal)
- [x] Added SEO service (5th service)
- [x] Removed pricing section from Services page
- [x] Added Arabic (ar) language with RTL support
- [x] Added Terrene Studio (external client project) to portfolio
- [x] Animated hero text with word rotation (WordRotate component)
- [x] Service comparison table on Services page (12 features × 5 services)
- [x] Service JSON-LD structured data on detail pages
- [x] Real-time contact form validation with inline error messages (translated)
- [x] Sitemap includes service detail pages + x-default hreflang
- [x] Admin dashboard with project CRUD + lead inbox
- [x] SQLite database with Prisma ORM (local, no cloud dependency)
- [x] Portfolio pages read from database (no more hardcoded arrays)
- [x] Contact form saves leads to DB alongside EmailJS
- [x] Sitemap dynamically queries project slugs from DB
- [x] Drag-and-drop image upload with auto WebP conversion
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
- **2026-05-09** — Domain, branding, services & i18n
  - Renamed Vercel project to ibda3-digital (ibda3-digital.vercel.app)
  - Replaced favicon with Ibda3 Digital logo (icon.png)
  - Theme-aware navbar: logo_transparent.png (light), Logo_horizontal.png (dark)
  - Mobile navbar shows square logo (logo_ibda3.png) at 48px
  - Added SEO as 5th service across all pages (Home, Services, Footer)
  - Removed pricing table section from Services page
  - Unified all services into one grid (no separate maintenance card)
  - Updated stats: years of experience 3+ → 5+
  - Added Arabic language (ar.json) with full translations
  - RTL support via SetLang component (dir="rtl" for Arabic)
  - Language switcher updated: FR / EN / ع
  - Arabic metadata for SEO
  - Added Terrene Studio (architecture site) to portfolio with hero image
  - Portfolio cards now all same size (removed feature/bento layout)
  - Portfolio supports external URLs with link icon (not just GitHub)
  - Made CinematicHero theme-aware: white bg in light mode, dark cinematic in dark mode
  - Theme-aware phone mockup, premium card, glass badges, glow blobs
  - Configured Tailwind v4 `@variant dark` to use `.dark` class selector (was using media query)
- **2026-05-10** — UX enhancements & polish
  - Cookie consent banner (GDPR) gating Google Analytics
  - Page transitions (framer-motion fade + slide)
  - Scroll progress bar (3px primary at top)
  - Back-to-top button (bottom-left, appears after 400px)
  - Breadcrumbs with BreadcrumbList JSON-LD on inner pages
  - Theme transition animation (smooth 450ms background/color/border)
  - About page i18n (replaced all hardcoded French text)
  - Honeypot spam protection on contact form
  - Fixed console warnings (LCP, scroll-behavior, cssRules, container position)
  - Tech logo carousel (marquee of framework logos)
  - WhatsApp chat widget (popup with greeting, online status, CTA)
  - Blur image placeholders on portfolio cards
  - Testimonials marquee section (6 client reviews, two-row)
  - Individual service detail pages (/services/[slug]) with features, process, tools
  - Process section added to home page (from About)
- **2026-05-11** — Animated hero, comparison table & SEO
  - WordRotate component: animated word cycling in hero (5 service keywords, 2.5s interval)
  - Service comparison table: 12-feature matrix across 5 services on Services page
  - Service JSON-LD schema on each service detail page
  - Real-time contact form validation with inline errors (name, email, phone, subject, message)
  - Validation translations added for all 3 locales
  - Sitemap expanded: service detail pages included, x-default hreflang added
  - Layout metadata: x-default hreflang for fallback locale
- **2026-05-12** — New portfolio projects + case studies
  - Added Goudoukh, Tannour, Victory Path projects with full 3-locale case study pages
  - Added Hammam Nour to portfolio with case study
  - Converted all project images to WebP format
  - Arabic SEO improvements across case study pages
  - Cleaned up unused components
- **2026-05-13** — Aylani Parfums + Admin Dashboard
  - Added Aylani Parfums (e-commerce parfums) to portfolio with screenshot + case study
  - Built full admin dashboard at `/admin`:
    - Prisma v7 + SQLite database (local, `dev.db` at project root)
    - better-sqlite3 driver adapter (Prisma v7 breaking change from v5/v6)
    - JWT auth (bcryptjs + jose): login/logout, 7-day cookie session
    - Dashboard page with stats cards (projects, leads)
    - Projects CRUD: table view, create/edit forms, visibility toggle, delete
    - Simplified project form: single-locale input, auto-fills other 2 locales
    - Auto-generated slug from title
    - Drag-and-drop image upload with sharp WebP conversion (1280×800, 80% quality)
    - Leads inbox: status filters (NEW/CONTACTED/QUALIFIED/CLOSED), pagination
    - Lead detail: full message view, status dropdown, internal notes
    - Zod validation on all API routes
    - Seed script populates DB from existing translation JSON files
  - Migrated public site to read from database:
    - Portfolio page: split into server component + PortfolioGrid client component
    - Case study pages: read project data + translations from DB
    - Home page parallax: products fetched from DB
    - Sitemap: queries project slugs from DB dynamically
    - Contact form: dual submission (EmailJS + DB lead creation)
  - Fixed Next.js 16 script placement (theme init in body with beforeInteractive)
  - Protected next/image from empty/invalid src paths
