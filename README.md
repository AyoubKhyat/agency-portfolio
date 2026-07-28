# Ibda3 Digital — Agency Website

The official website of Ibda3 Digital, a web development agency based in Marrakech, Morocco. Cinematic multi-language marketing site with portfolio, blog, contact flow, and an internal admin dashboard for project and lead management.

**Live:** https://ibda3-digital.vercel.app/

## Public site features

- **Cinematic hero** with 3D scenes and scroll-driven storytelling
- **Portfolio grid** — case studies with translated content per project (data-driven from DB)
- **Services** — showcase sites, e-commerce, mobile apps, SEO, maintenance
- **Blog** — MDX-based articles
- **Contact flow** — form validation, lead saved to DB + delivered via EmailJS
- **3 languages** — French (default), English, Arabic (with RTL)
- **Testimonials, FAQs, client logos, WhatsApp floating button**
- **SEO** — sitemap (dynamic from DB), robots.txt, per-page metadata, Organization + Service JSON-LD, hreflang

## Admin dashboard (auth-gated)

- **Project CRUD** — visibility toggle, drag-drop image upload with auto WebP conversion
- **Single-locale input** — write in one language, auto-fills the others
- **Leads inbox** — status filters (NEW/CONTACTED/QUALIFIED/CLOSED), pagination, internal notes
- **Prospects, clients, campaigns, tasks** — full CRM layer
- **Team chat** — internal channels + DMs

## Tech stack

- **Framework:** Next.js 16 (App Router) · React 19 · TypeScript
- **Database:** PostgreSQL (Neon serverless) via Prisma ORM 7
- **Auth:** JWT (jose + bcryptjs), cookie-based session, 7-day expiry
- **i18n:** next-intl v4 (FR/EN/AR with RTL)
- **Styling:** Tailwind CSS v4 with dual light/dark themes
- **Animation:** Framer Motion + GSAP + Embla Carousel
- **Content:** MDX (next-mdx-remote + gray-matter) for blog posts
- **AI:** Anthropic Claude SDK (used in internal admin workflows)
- **PDFs:** jsPDF
- **Validation:** Zod on all API routes
- **Email:** EmailJS (client-side) for contact form
- **Hosting:** Vercel
- **Node:** requires Node.js 20+

## Getting started

```bash
nvm use 20
npm install
npx prisma generate
npm run dev
```

Open http://localhost:3000

## Environment variables

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — PostgreSQL connection string (Neon or self-hosted)
- `JWT_SECRET` — 32+ char random string
- `ANTHROPIC_API_KEY` — for AI-powered admin features
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — bootstrap admin login
- `NEXT_PUBLIC_EMAILJS_SERVICE_ID`, `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`, `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` — contact form delivery

## Project structure

```
ibda3-portfolio/
├── src/app/
│   ├── [locale]/       # public site (localized)
│   ├── admin/          # internal admin (JWT-gated)
│   ├── sign/           # auth pages
│   └── api/            # REST endpoints (public + admin)
├── src/components/     # UI + admin components
├── src/lib/            # prisma client, auth, DAL, fallback data
├── src/messages/       # fr.json, en.json, ar.json
├── prisma/             # schema + seed
├── content/blog/       # MDX blog posts
├── leads/              # lead intake handlers
└── public/
```

## About

Built and maintained by [Ayoub Khyat](https://github.com/AyoubKhyat) — full-stack developer, Marrakech.

Freelance work available at [Ibda3 Digital](https://ibda3-digital.vercel.app/) and on [Fiverr](https://www.fiverr.com/ayoubkhyat). Languages: English · Français · العربية.
