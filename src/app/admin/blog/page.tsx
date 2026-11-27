"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, PenLine, FileText } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/admin/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

type BlogPost = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: number;
  author: string;
  image: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

const LOCALE_LABELS: Record<string, string> = { fr: "FR", en: "EN", ar: "AR" };
const LOCALE_VARIANTS: Record<string, "purple" | "blue" | "amber"> = { fr: "purple", en: "blue", ar: "amber" };

export default function BlogAdminPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [localeFilter, setLocaleFilter] = useState("ALL");

  useEffect(() => {
    fetchPosts();
  }, []);

  function fetchPosts() {
    setLoading(true);
    fetch("/api/admin/blog")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data && Array.isArray(data)) setPosts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function handleTogglePublished(post: BlogPost) {
    const res = await fetch(`/api/admin/blog/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this blog post? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = localeFilter === "ALL" ? posts : posts.filter((p) => p.locale === localeFilter);
  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.filter((p) => !p.published).length;

  if (loading) {
    return (
      <div>
        <PageHeader title="Blog" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Blog"
        subtitle="Manage blog posts across all locales"
        count={posts.length}
        actions={
          <Link
            href="/admin/blog/new"
            className="flex items-center gap-1.5 px-3 py-2 os-btn-primary rounded-lg text-xs sm:text-sm font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> New Post
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={posts.length} label="Total Posts" icon={<FileText className="w-5 h-5" />} index={0} />
        <StatCard value={publishedCount} label="Published" icon={<Eye className="w-5 h-5" />} accent index={1} />
        <StatCard value={draftCount} label="Drafts" icon={<EyeOff className="w-5 h-5" />} index={2} />
        <StatCard value={new Set(posts.map((p) => p.category)).size} label="Categories" icon={<PenLine className="w-5 h-5" />} index={3} />
      </div>

      {/* Locale filter */}
      <div className="flex items-center gap-2 mb-4">
        {["ALL", "fr", "en", "ar"].map((loc) => (
          <button
            key={loc}
            onClick={() => setLocaleFilter(loc)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              localeFilter === loc
                ? "bg-[var(--os-surface)] text-[var(--os-text)] border-[var(--os-border-hover)] shadow-sm shadow-slate-900/[0.04]"
                : "bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] border-[var(--os-border)] hover:border-purple-200 os-dark:hover:border-purple-500/30 hover:text-[#0F172A] os-dark:hover:text-[var(--os-text)]"
            )}
          >
            {loc === "ALL" ? "All" : LOCALE_LABELS[loc]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<PenLine className="w-6 h-6" />}
          title="No blog posts yet"
          description={localeFilter !== "ALL" ? `No posts for locale "${LOCALE_LABELS[localeFilter]}". Create one!` : "Create your first blog post."}
          action={
            <Link href="/admin/blog/new" className="text-sm text-purple-600 os-dark:text-purple-400 hover:text-purple-500">
              Create post
            </Link>
          }
        />
      ) : (
        <>
        <ul className="md:hidden space-y-3">
          {filtered.map((post) => (
            <li key={post.id} className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4">
              <div className="text-[14px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)] break-words">{post.title}</div>
              <div className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mt-0.5 line-clamp-2">{post.excerpt}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <Badge variant={LOCALE_VARIANTS[post.locale] || "default"} size="sm">
                  {LOCALE_LABELS[post.locale] || post.locale}
                </Badge>
                <Badge variant="default" size="sm">{post.category}</Badge>
                <button onClick={() => handleTogglePublished(post)} className="rounded-md" aria-label={post.published ? "Unpublish post" : "Publish post"}>
                  {post.published ? (
                    <Badge variant="green" size="sm" dot>Published</Badge>
                  ) : (
                    <Badge variant="default" size="sm" dot>Draft</Badge>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--os-border)]">
                <span className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
                  {new Date(post.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <div className="flex items-center gap-1">
                  <a
                    href={`/${post.locale}/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Preview post"
                    className="p-2.5 rounded-lg hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] text-[#475569] os-dark:text-[var(--os-text)]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    aria-label="Edit post"
                    className="p-2.5 rounded-lg hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] text-[#475569] os-dark:text-[var(--os-text)]"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    aria-label="Delete post"
                    className="p-2.5 rounded-lg hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] text-[#475569] os-dark:text-[var(--os-text)] hover:text-red-600 os-dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden md:block border border-[var(--os-border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50/80 os-dark:bg-[var(--os-surface-2)]">
                  <th className="text-left px-4 py-3 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-xs">Title</th>
                  <th className="text-left px-4 py-3 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-xs">Locale</th>
                  <th className="text-left px-4 py-3 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-xs">Category</th>
                  <th className="text-left px-4 py-3 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-xs">Status</th>
                  <th className="text-left px-4 py-3 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-xs">Date</th>
                  <th className="text-right px-4 py-3 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((post, i) => (
                  <motion.tr
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="border-b border-[var(--os-border)] hover:bg-gray-50 os-dark:hover:bg-[var(--os-hover)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)] truncate max-w-[280px]">{post.title}</div>
                        <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] truncate max-w-[280px] mt-0.5">{post.excerpt.slice(0, 60)}{post.excerpt.length > 60 ? "..." : ""}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={LOCALE_VARIANTS[post.locale] || "default"} size="sm">
                        {LOCALE_LABELS[post.locale] || post.locale}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default" size="sm">{post.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleTogglePublished(post)} className="transition-colors">
                        {post.published ? (
                          <Badge variant="green" size="sm" dot>Published</Badge>
                        ) : (
                          <Badge variant="default" size="sm" dot>Draft</Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
                      {new Date(post.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/${post.locale}/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] text-[#475569] os-dark:text-[var(--os-text)] hover:text-blue-600 os-dark:hover:text-blue-400 transition-colors"
                          title="Preview"
                          aria-label="Preview post"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          href={`/admin/blog/${post.id}/edit`}
                          className="p-1.5 rounded-lg hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] text-[#475569] os-dark:text-[var(--os-text)] hover:text-purple-600 os-dark:hover:text-purple-400 transition-colors"
                          title="Edit"
                          aria-label="Edit post"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] text-[#475569] os-dark:text-[var(--os-text)] hover:text-red-600 os-dark:hover:text-red-400 transition-colors"
                          title="Delete"
                          aria-label="Delete post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
