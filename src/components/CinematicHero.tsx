"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STYLES = `
  .cinematic-hero .gsap-reveal { visibility: hidden; }

  .cinematic-hero .film-grain {
    position: absolute; inset: 0;
    pointer-events: none; z-index: 50; opacity: 0.04; mix-blend-mode: overlay;
    background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)"/></svg>');
  }

  .cinematic-hero .bg-grid-cinematic {
    background-size: 60px 60px;
    background-image:
      linear-gradient(to right, rgba(167,139,250,0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(167,139,250,0.06) 1px, transparent 1px);
    mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .cinematic-hero .text-silver-hero {
    background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter:
      drop-shadow(0px 10px 20px rgba(255,255,255,0.08))
      drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
  }

  .cinematic-hero .text-card-silver {
    background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter:
      drop-shadow(0px 8px 16px rgba(0,0,0,0.8))
      drop-shadow(0px 2px 4px rgba(0,0,0,0.6));
  }

  .cinematic-hero .premium-card {
    background: linear-gradient(145deg, #1E1045 0%, #0A0A14 100%);
    box-shadow:
      0 40px 100px -20px rgba(0,0,0,0.9),
      0 20px 40px -20px rgba(0,0,0,0.8),
      inset 0 1px 2px rgba(167,139,250,0.15),
      inset 0 -2px 4px rgba(0,0,0,0.8);
    border: 1px solid rgba(167,139,250,0.08);
  }

  .cinematic-hero .card-sheen {
    position: absolute; inset: 0; border-radius: inherit;
    pointer-events: none; z-index: 50;
    background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(167,139,250,0.08) 0%, transparent 40%);
    mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  .cinematic-hero .phone-frame {
    background-color: #111;
    box-shadow:
      inset 0 0 0 2px #52525B,
      inset 0 0 0 6px #000,
      0 30px 60px -10px rgba(0,0,0,0.9),
      0 10px 20px -5px rgba(0,0,0,0.7);
  }

  .cinematic-hero .screen-glare {
    background: linear-gradient(110deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%);
  }

  .cinematic-hero .glass-badge {
    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.1),
      0 20px 40px -10px rgba(0,0,0,0.8),
      inset 0 1px 1px rgba(255,255,255,0.15);
  }

  .cinematic-hero .btn-hero-light {
    background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%);
    color: #0F172A;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.05),
      0 2px 4px rgba(0,0,0,0.1),
      0 12px 24px -4px rgba(0,0,0,0.3),
      inset 0 1px 1px rgba(255,255,255,1),
      inset 0 -3px 6px rgba(0,0,0,0.06);
    transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .cinematic-hero .btn-hero-light:hover {
    transform: translateY(-3px);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.05),
      0 6px 12px -2px rgba(0,0,0,0.15),
      0 20px 32px -6px rgba(0,0,0,0.4),
      inset 0 1px 1px rgba(255,255,255,1);
  }
  .cinematic-hero .btn-hero-light:active {
    transform: translateY(1px);
    background: linear-gradient(180deg, #F1F5F9 0%, #E2E8F0 100%);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.1),
      0 1px 2px rgba(0,0,0,0.1),
      inset 0 3px 6px rgba(0,0,0,0.1);
  }

  .cinematic-hero .btn-hero-dark {
    background: linear-gradient(180deg, #27272A 0%, #18181B 100%);
    color: #FFFFFF;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.1),
      0 2px 4px rgba(0,0,0,0.6),
      0 12px 24px -4px rgba(0,0,0,0.9),
      inset 0 1px 1px rgba(255,255,255,0.15),
      inset 0 -3px 6px rgba(0,0,0,0.8);
    transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .cinematic-hero .btn-hero-dark:hover {
    transform: translateY(-3px);
    background: linear-gradient(180deg, #3F3F46 0%, #27272A 100%);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.15),
      0 6px 12px -2px rgba(0,0,0,0.7),
      0 20px 32px -6px rgba(0,0,0,1),
      inset 0 1px 1px rgba(255,255,255,0.2);
  }
`;

interface CinematicHeroProps {
  tagline: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  cta2Label: string;
}

export default function CinematicHero({
  tagline,
  subtitle,
  description,
  ctaLabel,
  cta2Label,
}: CinematicHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      tl.from("[data-hero-tagline]", { autoAlpha: 0, y: 20, duration: 0.6 })
        .from("[data-hero-word]", { autoAlpha: 0, y: 80, stagger: 0.12, duration: 0.8 }, "-=0.2")
        .from("[data-hero-subtitle]", { autoAlpha: 0, y: 30, duration: 0.6 }, "-=0.4")
        .from("[data-hero-desc]", { autoAlpha: 0, y: 20, duration: 0.5 }, "-=0.3")
        .from("[data-hero-btn]", { autoAlpha: 0, y: 20, stagger: 0.1, duration: 0.5 }, "-=0.3")
        .from("[data-hero-card]", { autoAlpha: 0, x: 100, rotateZ: 3, duration: 1, ease: "power2.out" }, "-=0.8")
        .from("[data-hero-badge]", { autoAlpha: 0, scale: 0.7, stagger: 0.08, duration: 0.5 }, "-=0.6")
        .from("[data-hero-bottom]", { autoAlpha: 0, y: 10, duration: 0.4 }, "-=0.3");

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1.5,
        onUpdate: (self) => {
          const p = self.progress;
          if (cardRef.current) {
            gsap.set(cardRef.current, { y: p * 60 });
          }
          document.querySelectorAll("[data-hero-badge]").forEach((el, i) => {
            gsap.set(el, { y: p * (30 + i * 15) });
          });
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  function handleMouseMove(e: React.MouseEvent) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    cardRef.current.style.setProperty("--mouse-x", `${x}%`);
    cardRef.current.style.setProperty("--mouse-y", `${y}%`);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <section
        ref={sectionRef}
        className="cinematic-hero relative min-h-screen bg-[#0A0A14] overflow-hidden flex items-center"
      >
        {/* Environment */}
        <div className="film-grain" />
        <div className="absolute inset-0 bg-grid-cinematic" />
        <div className="absolute -top-48 -right-48 w-[800px] h-[800px] rounded-full bg-[#A78BFA] opacity-[0.12] blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full bg-[#F59E0B] opacity-[0.07] blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#A78BFA] opacity-[0.05] blur-[150px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 w-full">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-16 items-center">
            {/* Text */}
            <div>
              <p
                data-hero-tagline
                className="font-mono text-xs tracking-[0.2em] uppercase text-[#A78BFA] mb-8 invisible"
              >
                {tagline}
              </p>

              <h1 className="font-serif leading-[0.92] tracking-tight">
                <span data-hero-word className="text-silver-hero inline-block text-6xl sm:text-7xl md:text-[100px] lg:text-[130px] invisible">
                  Ibda
                </span>
                <span data-hero-word className="inline-block text-6xl sm:text-7xl md:text-[100px] lg:text-[130px] italic invisible" style={{ WebkitTextFillColor: "#A78BFA", color: "#A78BFA" }}>
                  3
                </span>
                <br />
                <span data-hero-word className="text-silver-hero inline-block text-6xl sm:text-7xl md:text-[100px] lg:text-[130px] invisible">
                  Digital.
                </span>
              </h1>

              <p
                data-hero-subtitle
                className="mt-8 font-serif italic text-2xl md:text-3xl text-white/90 max-w-2xl leading-snug invisible"
              >
                {subtitle}.
              </p>
              <p
                data-hero-desc
                className="mt-4 text-lg text-white/45 max-w-xl invisible"
              >
                {description}
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  data-hero-btn
                  href="/contact"
                  className="btn-hero-light rounded-xl px-8 py-3.5 font-semibold text-center invisible"
                >
                  {ctaLabel}
                </Link>
                <Link
                  data-hero-btn
                  href="/portfolio"
                  className="btn-hero-dark rounded-xl px-8 py-3.5 font-semibold text-center invisible"
                >
                  {cta2Label}
                </Link>
              </div>
            </div>

            {/* Visual — Premium Card + Phone Mockup */}
            <div className="relative hidden lg:block">
              <div
                ref={cardRef}
                data-hero-card
                className="premium-card rounded-3xl p-8 relative invisible"
                onMouseMove={handleMouseMove}
              >
                <div className="card-sheen rounded-3xl" />

                {/* Phone */}
                <div className="phone-frame rounded-[2.5rem] p-3 mx-auto w-[240px] relative z-10">
                  <div className="relative rounded-[2rem] overflow-hidden bg-[#0F0F1A] aspect-[9/19.5]">
                    {/* Dynamic Island */}
                    <div className="mx-auto mt-2 w-[90px] h-[28px] bg-black rounded-full" />

                    {/* Screen UI */}
                    <div className="p-4 pt-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Image src="/logo_ibda3.png" alt="Logo" width={28} height={28} className="rounded" />
                        <div className="h-1.5 w-14 rounded bg-white/20" />
                      </div>
                      <div className="h-1.5 w-3/4 rounded bg-white/15 mt-4" />
                      <div className="h-1.5 w-1/2 rounded bg-white/10" />
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="h-14 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="p-2">
                            <div className="h-1 w-6 rounded bg-[#A78BFA]/40" />
                            <div className="h-4 w-8 rounded bg-white/10 mt-1.5" />
                          </div>
                        </div>
                        <div className="h-14 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="p-2">
                            <div className="h-1 w-6 rounded bg-[#F59E0B]/40" />
                            <div className="h-4 w-8 rounded bg-white/10 mt-1.5" />
                          </div>
                        </div>
                      </div>
                      <div className="h-8 rounded-lg bg-gradient-to-r from-[#A78BFA]/30 to-[#8B6FE0]/20 flex items-center justify-center">
                        <div className="h-1.5 w-12 rounded bg-white/30" />
                      </div>
                      <div className="space-y-2 mt-2">
                        <div className="h-10 rounded-lg bg-white/[0.02] border border-white/[0.04]" />
                        <div className="h-10 rounded-lg bg-white/[0.02] border border-white/[0.04]" />
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-white/20" />
                    <div className="screen-glare absolute inset-0 rounded-[2rem] pointer-events-none" />
                  </div>
                </div>

                {/* Hardware buttons */}
                <div className="absolute right-[-2px] top-[120px] w-[3px] h-[50px] rounded-r" style={{ background: "linear-gradient(90deg, #404040 0%, #171717 100%)", boxShadow: "2px 0 5px rgba(0,0,0,0.8)" }} />

                <p className="text-card-silver text-center mt-6 font-serif italic text-lg relative z-10">
                  Your next website.
                </p>
              </div>

              {/* Floating Badges */}
              <div data-hero-badge className="glass-badge absolute -top-3 -left-4 px-4 py-2 rounded-full text-white/80 text-xs font-mono tracking-wider invisible">
                Next.js
              </div>
              <div data-hero-badge className="glass-badge absolute top-[20%] -right-6 px-4 py-2 rounded-full text-white/80 text-xs font-mono tracking-wider invisible">
                React
              </div>
              <div data-hero-badge className="glass-badge absolute bottom-[25%] -left-6 px-4 py-2 rounded-full text-white/80 text-xs font-mono tracking-wider invisible">
                <span className="text-[#F59E0B]">50+</span> Projects
              </div>
              <div data-hero-badge className="glass-badge absolute -bottom-3 right-8 px-4 py-2 rounded-full text-white/80 text-xs font-mono tracking-wider invisible">
                Laravel · PHP
              </div>
              <div data-hero-badge className="glass-badge absolute top-[55%] -right-10 px-4 py-2 rounded-full text-white/80 text-xs font-mono tracking-wider invisible">
                Tailwind CSS
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            data-hero-bottom
            className="mt-16 flex justify-between items-end invisible"
          >
            <span className="font-mono text-xs tracking-[0.16em] uppercase text-white/30">
              <strong className="text-white/60 font-normal">إبداع</strong> · ibdaa ·{" "}
              <em className="italic text-white/30">creation</em>
            </span>
            <span className="font-mono text-xs tracking-[0.16em] uppercase text-white/30 text-right hidden sm:block">
              Marrakech · Morocco
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
