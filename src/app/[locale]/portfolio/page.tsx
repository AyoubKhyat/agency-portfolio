"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HiOutlineArrowTopRightOnSquare } from "react-icons/hi2";
import { FaGithub } from "react-icons/fa";

type Category = "all" | "web" | "app" | "plugin";

const projects = [
  { id: 1, key: "project1", category: "app", color: "from-primary/30 to-accent/20", github: "ManagementStockWeb" },
  { id: 2, key: "project2", category: "app", color: "from-accent/20 to-primary/30", github: "School" },
  { id: 3, key: "project3", category: "app", color: "from-primary/20 to-accent/30", github: "Rent-Car" },
  { id: 4, key: "project4", category: "web", color: "from-accent/30 to-primary/20", github: "Sykweb_Site" },
  { id: 5, key: "project5", category: "web", color: "from-primary/30 to-accent/10", github: "Main-Site-Baraka-Idman" },
  { id: 6, key: "project6", category: "plugin", color: "from-accent/20 to-primary/20", github: "portalAddons" },
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
      <section className="bg-secondary py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white">{t("title")}</h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === f.key
                    ? "bg-primary text-secondary"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((project) => {
              const tags = t(`${project.key}_tags`).split(",").map((tag) => tag.trim());
              return (
                <div
                  key={project.id}
                  className="group bg-secondary rounded-2xl overflow-hidden border border-white/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all"
                >
                  <div
                    className={`h-48 bg-gradient-to-br ${project.color} flex items-center justify-center`}
                  >
                    <span className="text-5xl font-bold text-white/10">
                      {t(`${project.key}_title`).charAt(0)}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white">
                      {t(`${project.key}_title`)}
                    </h3>
                    <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                      {t(`${project.key}_desc`)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2.5 py-1 bg-white/5 rounded-full text-gray-300 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <a
                        href={`https://github.com/AyoubKhyat/${project.github}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-gray-400 text-sm font-medium hover:text-primary transition-colors"
                      >
                        <FaGithub className="w-4 h-4" />
                        GitHub
                      </a>
                      <a
                        href={`https://github.com/AyoubKhyat/${project.github}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary text-sm font-medium group-hover:gap-2.5 transition-all"
                      >
                        {t("view_project")}
                        <HiOutlineArrowTopRightOnSquare className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
