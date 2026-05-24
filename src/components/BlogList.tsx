"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { HiOutlineClock, HiArrowRight } from "react-icons/hi2";
import type { BlogPost } from "@/lib/blog";

interface BlogListProps {
  posts: BlogPost[];
  categories: string[];
  filterAllLabel: string;
  minReadLabel: string;
  readArticleLabel: string;
}

export default function BlogList({
  posts,
  categories,
  filterAllLabel,
  minReadLabel,
  readArticleLabel,
}: BlogListProps) {
  const [active, setActive] = useState<string | null>(null);
  const filtered = active
    ? posts.filter((p) => p.category === active)
    : posts;

  return (
    <>
      {/* Category Filters */}
      <div className="flex flex-wrap gap-3 mb-12">
        <button
          onClick={() => setActive(null)}
          className={`px-5 py-2 rounded-full text-sm font-mono tracking-wider transition-all ${
            active === null
              ? "bg-primary text-white"
              : "border border-line text-text-muted hover:border-primary hover:text-primary"
          }`}
        >
          {filterAllLabel}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`px-5 py-2 rounded-full text-sm font-mono tracking-wider transition-all ${
              active === cat
                ? "bg-primary text-white"
                : "border border-line text-text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="border-t border-line-soft">
        <AnimatePresence mode="popLayout">
          {filtered.map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="border-b border-line-soft"
            >
              <Link
                href={`/blog/${post.slug}`}
                className="grid grid-cols-1 md:grid-cols-[60px_1fr_1.5fr_auto] items-start py-10 gap-4 md:gap-8 group"
              >
                <span className="font-mono text-sm text-primary tracking-[0.12em] hidden md:block pt-2">
                  / {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="pill text-[11px] mb-3">{post.category}</span>
                  <h2 className="mt-3 font-serif text-2xl md:text-3xl text-foreground leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                </div>
                <p className="text-text-muted leading-relaxed">
                  {post.excerpt}
                </p>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="text-xs text-text-muted">{post.date}</span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <HiOutlineClock className="w-3.5 h-3.5" />
                    {post.readTime} {minReadLabel}
                  </span>
                  <span className="mt-2 flex items-center gap-1 font-mono text-[11px] tracking-[0.16em] uppercase text-primary group-hover:gap-2 transition-all">
                    {readArticleLabel} <HiArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
