"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FaGithub, FaExternalLinkAlt } from "react-icons/fa";
import { FadeIn, StaggerContainer, StaggerItem, motion, AnimatePresence } from "@/components/motion";

type Category = "all" | "web" | "app" | "plugin";

const projects = [
  { id: 1, key: "project1", category: "app", github: "ManagementStockWeb", og: "7b0cc63b4492ad5d6d69e2be5aba26f51fb9a43f22949eda1a5929109c57f294", tag: "Plateforme · Laravel", feature: true },
  { id: 2, key: "project2", category: "app", github: "School", og: "c9eb563c2d914c701c536473c339515b5c8ffdf3bbc508ec21303ed5c9ca83f5", tag: "Administration" },
  { id: 3, key: "project3", category: "app", github: "Rent-Car", og: "570d2c2440f47d994401dc86fbf19abb8db5d953cee7dd1125797c842732027a", tag: "Booking app" },
  { id: 4, key: "project4", category: "web", github: "Sykweb_Site", og: "3aaf66b9b94f8446a993f15b885630d63f706becfafe506e7c5a725304eb4d92", tag: "Agency site" },
  { id: 5, key: "project5", category: "web", github: "Main-Site-Baraka-Idman", og: "16e7e1c37c3434fa7dfc4afb1b35b18a56420bff01d4f8118861086835f42b8c", tag: "Sports site" },
  { id: 6, key: "project6", category: "plugin", github: "portalAddons", og: "9a9b70d6c25a909623c0ccf6b95c54667d988ac1378bb68b9d60a68fff471eff", tag: "WordPress plugin" },
  { id: 7, key: "project7", category: "web", url: "https://terrene.webyms.com/", image: "/projects/terrene.jpg", tag: "Architecture studio", feature: true },
];

export default function PortfolioPage() {
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
            <div className="flex flex-wrap gap-3 mb-12">
              {filters.map((f) => (
                <motion.button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-5 py-2 rounded-full text-sm font-mono tracking-wider uppercase transition-colors ${
                    filter === f.key
                      ? "bg-primary text-white"
                      : "border border-line text-text-muted hover:border-primary/30 hover:text-primary"
                  }`}
                >
                  {f.label}
                </motion.button>
              ))}
            </div>
          </FadeIn>

          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((project) => {
                const tags = t(`${project.key}_tags`).split(",").map((tag) => tag.trim());
                const href = project.url || `https://github.com/AyoubKhyat/${project.github}`;
                const imgSrc = project.image || `https://opengraph.githubassets.com/${project.og}/AyoubKhyat/${project.github}`;
                return (
                  <motion.a
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group border border-line rounded-2xl overflow-hidden bg-surface-2 hover:border-primary/30 transition-all flex flex-col hover:-translate-y-1 ${
                      project.feature ? "md:col-span-2 md:row-span-2" : ""
                    }`}
                  >
                    <div className="relative h-48 md:h-56 bg-background overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt={t(`${project.key}_title`)}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-1 gap-3">
                      <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-primary">
                        ▸ {project.tag}
                      </span>
                      <h3 className="font-serif text-2xl md:text-3xl text-foreground">
                        {t(`${project.key}_title`)}
                      </h3>
                      <p className="text-sm text-text-muted leading-relaxed">
                        {t(`${project.key}_desc`)}
                      </p>
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="font-mono text-xs tracking-wider text-text-muted">
                          {tags.join(" · ")}
                        </span>
                        {project.url ? (
                          <FaExternalLinkAlt className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                        ) : (
                          <FaGithub className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
    </>
  );
}
