"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FaExternalLinkAlt } from "react-icons/fa";
import { Link } from "@/i18n/navigation";
import { FadeIn, motion, AnimatePresence } from "@/components/motion";

type Category = "all" | "web" | "app" | "plugin" | "ecommerce";

const BLUR_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGZpbHRlciBpZD0iYiI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMTIiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFhMWEyYSIgZmlsdGVyPSJ1cmwoI2IpIi8+PC9zdmc+";

export type PortfolioProject = {
  id: string;
  slug: string;
  category: string;
  url: string;
  image: string;
  tag: string;
  title: string;
  desc: string;
  tags: string;
};

export default function PortfolioGrid({ projects }: { projects: PortfolioProject[] }) {
  const t = useTranslations("Portfolio");
  const [filter, setFilter] = useState<Category>("all");

  const filters: { key: Category; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "web", label: t("filter_web") },
    { key: "app", label: t("filter_app") },
    { key: "plugin", label: t("filter_plugin") },
  ];

  const filtered =
    filter === "all" ? projects : projects.filter((p) => p.category === filter);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary -bottom-32 left-20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <h1 className="font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
                <span className="text-primary italic">{t("title").split(" ")[0]}</span><br />{t("title").split(" ").slice(1).join(" ")}.
              </h1>
              <p className="font-serif italic text-xl text-text-muted max-w-sm leading-relaxed pb-4">
                {t("subtitle")}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-wrap gap-3 mb-12 relative" role="group" aria-label="Project filters">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={`relative px-5 py-2 rounded-full text-sm font-mono tracking-wider uppercase transition-colors ${
                    filter === f.key
                      ? "text-white"
                      : "border border-line text-text-muted hover:border-primary/30 hover:text-primary"
                  }`}
                >
                  {filter === f.key && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-primary rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </button>
              ))}
            </div>
          </FadeIn>

          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((project, index) => {
                const tagList = project.tags.split(",").map((tag) => tag.trim());
                return (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.94, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -8 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: index * 0.055 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="group border border-line rounded-2xl overflow-hidden bg-surface-2 hover:border-primary/30 transition-[border-color] flex flex-col"
                  >
                    <Link href={`/portfolio/${project.slug}`} className="flex flex-col flex-1">
                      <div className="relative h-48 md:h-56 bg-background overflow-hidden">
                        {project.image && project.image.startsWith("/") ? <Image
                          src={project.image}
                          alt={project.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          placeholder="blur"
                          blurDataURL={BLUR_PLACEHOLDER}
                        /> : <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs">No image</div>}
                      </div>
                      <div className="p-6 flex flex-col flex-1 gap-3">
                        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-primary">
                          ▸ {project.tag}
                        </span>
                        <h3 className="font-serif text-2xl md:text-3xl text-foreground">
                          {project.title}
                        </h3>
                        <p className="text-sm text-text-muted leading-relaxed">
                          {project.desc}
                        </p>
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <span className="font-mono text-xs tracking-wider text-text-muted">
                            {tagList.join(" · ")}
                          </span>
                          <span className="text-xs font-mono tracking-wider text-text-muted group-hover:text-primary transition-colors">
                            {t("view_case_study")} →
                          </span>
                        </div>
                      </div>
                    </Link>
                    {project.url && (
                      <div className="px-6 pb-4">
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider text-text-muted hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FaExternalLinkAlt className="w-3 h-3" /> {t("live_site")}
                        </a>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
    </>
  );
}
