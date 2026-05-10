"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FaGithub, FaExternalLinkAlt } from "react-icons/fa";
import { ZoomParallax } from "@/components/ZoomParallax";

type Category = "all" | "web" | "app" | "plugin";

const projects = [
  { id: 1, key: "project1", category: "app", github: "ManagementStockWeb", og: "7b0cc63b4492ad5d6d69e2be5aba26f51fb9a43f22949eda1a5929109c57f294", tag: "Plateforme · Laravel" },
  { id: 2, key: "project2", category: "app", github: "School", og: "c9eb563c2d914c701c536473c339515b5c8ffdf3bbc508ec21303ed5c9ca83f5", tag: "Administration" },
  { id: 3, key: "project3", category: "app", github: "Rent-Car", og: "570d2c2440f47d994401dc86fbf19abb8db5d953cee7dd1125797c842732027a", tag: "Booking app" },
  { id: 4, key: "project4", category: "web", github: "Sykweb_Site", og: "3aaf66b9b94f8446a993f15b885630d63f706becfafe506e7c5a725304eb4d92", tag: "Agency site" },
  { id: 5, key: "project5", category: "web", github: "Main-Site-Baraka-Idman", og: "16e7e1c37c3434fa7dfc4afb1b35b18a56420bff01d4f8118861086835f42b8c", tag: "Sports site" },
  { id: 6, key: "project6", category: "plugin", github: "portalAddons", og: "9a9b70d6c25a909623c0ccf6b95c54667d988ac1378bb68b9d60a68fff471eff", tag: "WordPress plugin" },
  { id: 7, key: "project7", category: "web", url: "https://terrene.webyms.com/", image: "/projects/terrene.jpg", tag: "Architecture studio" },
];

const categoryDots: Record<string, string> = {
  web: "#7F77DD",
  app: "#1D9E75",
  plugin: "#D85A30",
};

function getImageSrc(project: (typeof projects)[number]) {
  return project.image || `https://opengraph.githubassets.com/${project.og}/AyoubKhyat/${project.github}`;
}

export default function PortfolioPage() {
  const t = useTranslations("Portfolio");
  const [filter, setFilter] = useState<Category>("all");
  const [displayedCards, setDisplayedCards] = useState(projects);
  const [cardPhase, setCardPhase] = useState<"visible" | "exiting" | "entering">("visible");

  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filters: { key: Category; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "web", label: t("filter_web") },
    { key: "app", label: t("filter_app") },
    { key: "plugin", label: t("filter_plugin") },
  ];

  const parallaxImages = projects.map((p) => ({
    src: getImageSrc(p),
    alt: t(`${p.key}_title`),
  }));

  const movePill = useCallback(() => {
    if (!tabsRef.current || !pillRef.current) return;
    const activeBtn = tabsRef.current.querySelector<HTMLButtonElement>("[data-active='true']");
    if (!activeBtn) return;
    pillRef.current.style.left = `${activeBtn.offsetLeft}px`;
    pillRef.current.style.width = `${activeBtn.offsetWidth}px`;
  }, []);

  useEffect(() => {
    movePill();
  }, [filter, movePill]);

  useEffect(() => {
    movePill();
    window.addEventListener("resize", movePill);
    return () => window.removeEventListener("resize", movePill);
  }, [movePill]);

  const handleFilter = (key: Category) => {
    if (key === filter || cardPhase !== "visible") return;

    const currentCards = gridRef.current?.querySelectorAll<HTMLElement>("[data-card]");
    const exitCount = currentCards?.length ?? 0;

    setCardPhase("exiting");
    setFilter(key);

    if (currentCards) {
      currentCards.forEach((card, i) => {
        card.style.transition = `opacity 220ms ease-in ${i * 30}ms, transform 220ms ease-in ${i * 30}ms`;
        card.style.opacity = "0";
        card.style.transform = "translateY(-10px) scale(0.96)";
      });
    }

    setTimeout(() => {
      const next = key === "all" ? projects : projects.filter((p) => p.category === key);
      setDisplayedCards(next);
      setCardPhase("entering");
    }, exitCount * 30 + 240);
  };

  useEffect(() => {
    if (cardPhase !== "entering") return;

    const cards = gridRef.current?.querySelectorAll<HTMLElement>("[data-card]");
    if (!cards) return;

    cards.forEach((card) => {
      card.style.transition = "none";
      card.style.opacity = "0";
      card.style.transform = "translateY(22px) scale(0.95)";
    });

    setTimeout(() => {
      cards.forEach((card, i) => {
        card.style.transition = `opacity 450ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms, transform 450ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms`;
        card.style.opacity = "1";
        card.style.transform = "translateY(0) scale(1)";
      });
      setTimeout(() => setCardPhase("visible"), (cards.length - 1) * 60 + 480);
    }, 20);
  }, [cardPhase, displayedCards]);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <>
      {/* Zoom Parallax Hero */}
      <ZoomParallax images={parallaxImages} />

      {/* Title */}
      <section className="relative bg-background py-20 md:py-28 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary -bottom-32 left-20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <h1 className="font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
              <span className="text-primary italic">{t("title").split(" ")[0]}</span><br />{t("title").split(" ").slice(1).join(" ")}.
            </h1>
            <p className="font-serif italic text-xl text-text-muted max-w-sm leading-relaxed pb-4">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* Filters + Grid */}
      <section className="relative py-20 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Filter tabs */}
          <div ref={tabsRef} className="portfolio-tabs relative flex flex-wrap gap-1 mb-12 p-1 rounded-full w-fit bg-surface border border-line">
            <div
              ref={pillRef}
              id="tab-pill"
              className="absolute top-1 bottom-1 rounded-full pointer-events-none bg-surface-2 border border-line"
              style={{
                transition: "left 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                left: 0,
                width: 0,
              }}
            />
            {filters.map((f) => (
              <button
                key={f.key}
                data-active={filter === f.key ? "true" : "false"}
                onClick={() => handleFilter(f.key)}
                className={`relative z-10 px-5 py-2 rounded-full text-sm font-mono tracking-wider uppercase transition-colors duration-200 ${
                  filter === f.key ? "text-foreground" : "text-text-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div ref={gridRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedCards.map((project) => {
              const tags = t(`${project.key}_tags`).split(",").map((tag) => tag.trim());
              const href = project.url || `https://github.com/AyoubKhyat/${project.github}`;
              const imgSrc = getImageSrc(project);
              const dotColor = categoryDots[project.category] || "var(--txt-muted)";
              return (
                <a
                  key={project.key}
                  data-card
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseMove={handleMouseMove}
                  className="portfolio-card group rounded-2xl overflow-hidden flex flex-col bg-surface border border-line"
                >
                  <div className="relative h-48 md:h-56 overflow-hidden bg-background">
                    <Image
                      src={imgSrc}
                      alt={t(`${project.key}_title`)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-6 flex flex-col flex-1 gap-3">
                    <span className="font-mono text-[11px] tracking-[0.18em] uppercase flex items-center gap-2 text-foreground">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: dotColor }} />
                      {project.tag}
                    </span>
                    <h3 className="font-serif text-2xl md:text-3xl text-foreground">
                      {t(`${project.key}_title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-text-muted">
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
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
