"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { HiOutlineArrowTopRightOnSquare } from "react-icons/hi2";
import { FaGithub } from "react-icons/fa";

type Category = "all" | "web" | "app" | "plugin";

const projects = [
  { id: 1, key: "project1", category: "app", github: "ManagementStockWeb", og: "7b0cc63b4492ad5d6d69e2be5aba26f51fb9a43f22949eda1a5929109c57f294" },
  { id: 2, key: "project2", category: "app", github: "School", og: "c9eb563c2d914c701c536473c339515b5c8ffdf3bbc508ec21303ed5c9ca83f5" },
  { id: 3, key: "project3", category: "app", github: "Rent-Car", og: "570d2c2440f47d994401dc86fbf19abb8db5d953cee7dd1125797c842732027a" },
  { id: 4, key: "project4", category: "web", github: "Sykweb_Site", og: "3aaf66b9b94f8446a993f15b885630d63f706becfafe506e7c5a725304eb4d92" },
  { id: 5, key: "project5", category: "web", github: "Main-Site-Baraka-Idman", og: "16e7e1c37c3434fa7dfc4afb1b35b18a56420bff01d4f8118861086835f42b8c" },
  { id: 6, key: "project6", category: "plugin", github: "portalAddons", og: "9a9b70d6c25a909623c0ccf6b95c54667d988ac1378bb68b9d60a68fff471eff" },
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
                  <div className="relative h-48 bg-secondary overflow-hidden">
                    <Image
                      src={`https://opengraph.githubassets.com/${project.og}/AyoubKhyat/${project.github}`}
                      alt={t(`${project.key}_title`)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
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
