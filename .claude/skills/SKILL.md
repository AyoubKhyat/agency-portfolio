---
name: frontend-design
description: Design system rules for premium, agency-quality UI — typography, spacing, color tokens, component patterns
---

# Frontend Design Skill — Ibda3 Digital

## Philosophy
Build interfaces that feel expensive. Every pixel should be intentional. Avoid generic AI/template aesthetic — no default Tailwind hero sections, no cookie-cutter card grids, no unstyled forms.

## Typography System
- **Display/Headlines**: Instrument Serif (`font-serif`) — 48px to 160px, tight tracking (-0.02em), leading 0.92–0.95
- **Body**: Inter (`font-sans`) — 14–18px, relaxed leading (1.6–1.75)
- **Accents/Labels**: JetBrains Mono (`font-mono`) — 11–13px, uppercase, wide tracking (0.12–0.2em)
- Never use random font sizes. Stick to the scale: 11, 13, 14, 16, 18, 20, 24, 32, 48, 64, 72, 96, 120, 160px
- Serif headlines should feel editorial — use italic sparingly for emphasis on key words

## Spacing System (8px base grid)
- Component internal padding: 16px, 24px, 32px, 40px
- Section vertical padding: 80px (py-20) to 128px (py-32)
- Between sections: use border-t or color change, not excessive whitespace
- Card padding: p-6 (24px) to p-10 (40px) depending on content density
- Grid gaps: gap-5 (20px) for tight grids, gap-6 (24px) standard, gap-8 (32px) for loose layouts

## Color Tokens
- **Primary**: `#A78BFA` (violet) — CTAs, active states, accents
- **Primary Dark**: `#8B6FE0` — hover states for primary buttons
- **Accent**: `#F59E0B` (amber) — prices, highlights, secondary emphasis
- **Background**: Light `#FAFAFA` / Dark `#0F0F1A` — page background
- **Surface**: Light `#FFFFFF` / Dark `#1E1E2E` — cards, elevated surfaces
- **Foreground**: Light `#18181B` / Dark `#E4E4E7` — primary text
- **Text Muted**: Light `#71717A` / Dark `#9CA3AF` — secondary text
- **Line**: Light `#E4E4E7` / Dark `rgba(255,255,255,0.08)` — borders
- Never use raw hex codes — always reference CSS variables or theme tokens
- Primary buttons always use `text-white` regardless of theme

## Component Patterns

### Buttons
- Primary: `bg-primary text-white rounded-xl px-8 py-3.5 font-semibold hover:bg-primary-dark transition-colors`
- Secondary: `border border-line text-foreground rounded-xl px-8 py-3.5 backdrop-blur bg-foreground/5 hover:bg-foreground/10`
- Pill/Tag: `pill` class — small, rounded-full, mono text, uppercase
- Always add `transition-colors` or `transition-all` for hover states
- Add `active:scale-95` for tactile press feedback

### Cards
- Border: `border border-line rounded-2xl`
- Gradient overlay: `bg-gradient-to-b from-primary/5 to-transparent`
- Hover: `hover:border-primary/30 transition-all`
- Always use `rounded-2xl` (16px) for cards, `rounded-xl` (12px) for buttons/inputs
- Add `group` class and `group-hover:` for child element animations

### Forms
- Inputs: `rounded-xl bg-surface-2 border border-line-soft focus:border-primary focus:ring-2 focus:ring-primary/20`
- Labels: `font-mono text-xs tracking-wider uppercase text-text-muted`
- Always include focus ring and transition

### Section Layout
- Max width container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Section headers: pill tag + serif headline + muted subtitle
- Use `grid-bg` overlay for depth on alternating sections
- Use `glow` elements sparingly for ambient lighting

## Animation Rules (Framer Motion)
- Use `FadeIn` for scroll-triggered entrance on all sections
- Use `StaggerContainer` + `StaggerItem` for grids and lists
- Default ease: `[0.25, 0.4, 0.25, 1]` (smooth deceleration)
- Default duration: 0.5–0.6s for fades, 0.3s for hovers
- Stagger delay: 0.1s between items
- Use `once: true` on all scroll-triggered animations — don't re-animate
- Viewport margin: `-80px` for sections, `-50px` for grid items
- Hero content should stagger in: label → title → subtitle → buttons
- Never animate more than 3 properties simultaneously
- Mobile: reduce motion distances (y: 40px → 20px) if needed

## Anti-Patterns to Avoid
- Generic centered hero with stock gradient background
- Cards that all look identical with no visual hierarchy
- Rainbow gradients or neon color schemes
- Excessive drop shadows (use border + subtle gradient instead)
- Animations that block content visibility (keep durations under 0.8s)
- Placeholder images or Lorem ipsum in production
- More than 2 font families on a single page
- Inconsistent border radius (pick 2: one for cards, one for buttons)
