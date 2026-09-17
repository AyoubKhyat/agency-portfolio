"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { motion, AnimatePresence } from "@/components/motion";

export type HeroProject = {
  slug: string;
  title: string;
  image: string;
  url: string;
  tag?: string | null;
};

const ROTATE_MS = 5000;

/** Real project domain for the mockup address bar — never a made-up one. */
function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const ease = [0.16, 1, 0.3, 1] as const;

export default function HomeHero({ projects }: { projects: HeroProject[] }) {
  const t = useTranslations("Home");
  const reduceMotion = useReducedMotion();

  // The last project sits in the small offset card; the rest rotate in the
  // main frame, so the same screenshot is never shown twice at once.
  const pinned = projects.length > 1 ? projects[projects.length - 1] : null;
  const rotating = projects.length > 1 ? projects.slice(0, -1) : projects;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduceMotion || paused || rotating.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % rotating.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [reduceMotion, paused, rotating.length]);

  const current = rotating[index] ?? null;

  const rise = useCallback(
    (delay: number) =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 16 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.6, delay, ease },
          },
    [reduceMotion],
  );

  const services = [
    t("hero_svc1"),
    t("hero_svc2"),
    t("hero_svc3"),
    t("hero_svc4"),
    t("hero_svc5"),
  ];

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="hero-wash" aria-hidden="true" />

      <div className="relative max-w-7xl xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20 xl:py-24">
        <div className="grid items-center gap-12 lg:gap-14 xl:gap-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)]">
          {/* ── Copy ── */}
          <div className="max-w-xl xl:max-w-[38rem]">
            <motion.p
              {...rise(0)}
              className="font-mono text-xs sm:text-[13px] font-medium tracking-[0.14em] uppercase text-text-muted"
            >
              {t("hero_eyebrow")}
            </motion.p>

            <motion.h1
              {...rise(0.06)}
              className="mt-6 font-serif text-[2.75rem] leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem]"
            >
              {t.rich("hero_headline", {
                br: () => <br />,
                grow: (chunks) => (
                  <span className="text-gradient-brand">{chunks}</span>
                ),
              })}
            </motion.h1>

            <motion.p
              {...rise(0.12)}
              className="mt-6 text-base sm:text-lg xl:text-xl leading-relaxed text-text-muted max-w-lg xl:max-w-xl"
            >
              {t("hero_support")}
            </motion.p>

            <motion.div
              {...rise(0.18)}
              className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <Link
                href="/contact"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 xl:px-8 xl:py-4 text-sm sm:text-base font-semibold text-white transition-transform active:scale-[0.98]"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, var(--grad-a) 0%, var(--grad-b) 100%)",
                }}
              >
                {t("hero_cta_primary")}
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>

              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center rounded-full border border-line px-7 py-3.5 xl:px-8 xl:py-4 text-sm sm:text-base font-semibold text-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.98]"
              >
                {t("hero_cta_secondary")}
              </Link>
            </motion.div>

            {/* Compact service row */}
            <motion.div {...rise(0.24)} className="mt-10">
              <div className="h-px w-full hero-rule" aria-hidden="true" />
              <ul className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs sm:text-[13px] font-medium tracking-[0.06em] uppercase text-text-muted">
                {services.map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    {i > 0 && (
                      <span className="text-primary/50" aria-hidden="true">
                        •
                      </span>
                    )}
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* ── Layered project showcase (real Ibda3 projects only) ── */}
          <motion.div
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 24 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.7, delay: 0.14, ease },
                })}
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="font-mono text-xs tracking-[0.12em] uppercase text-text-muted">
                {t("clients_title")}
              </span>
              {rotating.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {rotating.map((p, i) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={p.title}
                      aria-current={i === index ? "true" : undefined}
                      className="group/dot flex h-6 items-center px-0.5"
                    >
                      <span
                        className={`block h-1.5 rounded-full transition-all duration-300 ${
                          i === index
                            ? "w-5 bg-primary"
                            : "w-1.5 bg-line group-hover/dot:bg-primary/50"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative pb-16 sm:pb-20 ps-0 sm:ps-4">
              {/* depth panel */}
              <div
                aria-hidden="true"
                className="absolute inset-x-8 -top-3 h-16 rounded-2xl border border-line-soft bg-surface/70"
              />

              {/* main browser frame */}
              <div className="relative rounded-2xl border border-line bg-surface overflow-hidden shadow-[0_24px_60px_-40px_rgba(15,15,26,0.45)]">
                <div className="flex items-center gap-3 px-4 h-10 border-b border-line-soft bg-surface-2">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="w-2.5 h-2.5 rounded-full bg-line" />
                    <span className="w-2.5 h-2.5 rounded-full bg-line" />
                    <span className="w-2.5 h-2.5 rounded-full bg-line" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mx-auto max-w-[60%] truncate rounded-md bg-background px-3 py-1 text-center font-mono text-[10px] text-text-muted border border-line-soft">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={current ? current.slug : "idle"}
                          initial={reduceMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: 0.6, ease }}
                          className="block truncate"
                        >
                          {current ? hostname(current.url) : "ibda3digital"}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-[16/10] bg-surface-2">
                  <AnimatePresence mode="wait" initial={false}>
                    {current && (
                      <motion.div
                        key={current.slug}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.6, ease }}
                        className="absolute inset-0"
                      >
                        <Image
                          src={current.image}
                          alt={current.title}
                          fill
                          priority={index === 0}
                          sizes="(max-width: 1024px) 92vw, 740px"
                          className="object-cover object-top"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {current && (
                  <div className="flex items-center justify-end gap-3 ps-[38%] sm:ps-[34%] pe-4 py-3 border-t border-line-soft">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={current.slug}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.6, ease }}
                        className="flex min-w-0 items-center justify-end gap-3"
                      >
                        <span className="text-sm font-semibold text-foreground truncate">
                          {current.title}
                        </span>
                        {current.tag && (
                          <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] uppercase text-text-muted">
                            {current.tag}
                          </span>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* offset secondary card — a second real project */}
              {pinned && (
                <div className="absolute bottom-0 start-0 sm:-start-5 lg:-start-8 w-[34%] max-w-[180px] rounded-xl border border-line bg-surface overflow-hidden shadow-[0_18px_40px_-30px_rgba(15,15,26,0.5)]">
                  <div className="flex items-center gap-1 px-2.5 h-5 border-b border-line-soft bg-surface-2" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full bg-line" />
                    <span className="w-1.5 h-1.5 rounded-full bg-line" />
                    <span className="w-1.5 h-1.5 rounded-full bg-line" />
                  </div>
                  <div className="relative aspect-[16/10] bg-surface-2">
                    <Image
                      src={pinned.image}
                      alt={pinned.title}
                      fill
                      sizes="180px"
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="px-2.5 py-1.5">
                    <span className="block truncate text-[11px] font-semibold text-foreground">
                      {pinned.title}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
