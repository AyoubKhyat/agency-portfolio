"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BlogPostData = {
  id?: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  readTime: number;
  author: string;
  image: string;
  published: boolean;
};

type BlogPostFormProps = {
  mode: "create" | "edit";
  initial?: BlogPostData;
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
}

const CATEGORIES = [
  "Web Development",
  "E-Commerce",
  "Mobile Apps",
  "SEO",
  "Design",
  "Marketing",
  "Technology",
  "Business",
  "Tutorial",
];

export default function BlogPostForm({ mode, initial }: BlogPostFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugManual, setSlugManual] = useState(false);

  const [form, setForm] = useState<BlogPostData>({
    slug: initial?.slug ?? "",
    locale: initial?.locale ?? "fr",
    title: initial?.title ?? "",
    excerpt: initial?.excerpt ?? "",
    content: initial?.content ?? "",
    category: initial?.category ?? CATEGORIES[0],
    readTime: initial?.readTime ?? 5,
    author: initial?.author ?? "Ibda3 Digital",
    image: initial?.image ?? "",
    published: initial?.published ?? false,
  });

  // Auto-generate slug from title (only if user hasn't manually edited slug)
  useEffect(() => {
    if (mode === "create" && !slugManual && form.title) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.title) }));
    }
  }, [form.title, mode, slugManual]);

  function updateField<K extends keyof BlogPostData>(key: K, value: BlogPostData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const url = mode === "create" ? "/api/admin/blog" : `/api/admin/blog/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSaving(false);
        return;
      }

      router.push("/admin/blog");
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[var(--os-border)] bg-white text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20 focus:border-[#8B00FF]/40 transition-all";
  const labelClass = "block text-[12px] font-semibold text-[#475569] uppercase tracking-wider mb-1.5";

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/blog"
            className="p-2 rounded-xl border border-[var(--os-border)] bg-white text-[#475569] hover:text-[#0F172A] hover:border-purple-200 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[#0F172A]">
              {mode === "create" ? "New Blog Post" : "Edit Blog Post"}
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {mode === "create" ? "Write a new article" : `Editing: ${initial?.title}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && initial?.slug && (
            <a
              href={`/${form.locale}/blog/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[#475569] hover:text-blue-600 hover:border-blue-200 text-xs font-medium transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </a>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:opacity-90 text-white rounded-lg text-xs sm:text-sm font-medium transition-all shadow-md shadow-purple-500/20 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Title */}
            <div className="bg-white rounded-2xl border border-[var(--os-border)] p-5 space-y-4">
              <div>
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Enter blog post title..."
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    updateField("slug", e.target.value);
                  }}
                  placeholder="auto-generated-from-title"
                  className={inputClass}
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">Auto-generated from title. Edit manually if needed.</p>
              </div>

              <div>
                <label className={labelClass}>Excerpt</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => updateField("excerpt", e.target.value)}
                  placeholder="Brief summary of the post..."
                  className={cn(inputClass, "h-20 resize-none")}
                  required
                />
              </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-[var(--os-border)] p-5">
              <label className={labelClass}>Content (Markdown)</label>
              <textarea
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                placeholder="Write your blog post content in Markdown..."
                className={cn(inputClass, "min-h-[400px] font-mono text-[13px] resize-y")}
                required
              />
              <p className="text-[11px] text-[#94A3B8] mt-1.5">
                Supports Markdown: **bold**, *italic*, ## headings, - lists, [links](url), etc.
              </p>
            </div>
          </div>

          {/* Sidebar column */}
          <div className="space-y-5">
            {/* Publish settings */}
            <div className="bg-white rounded-2xl border border-[var(--os-border)] p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Publish Settings</h3>

              {/* Published toggle */}
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-[#475569]">Published</label>
                <button
                  type="button"
                  onClick={() => updateField("published", !form.published)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.published ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3]" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                      form.published ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {/* Locale */}
              <div>
                <label className={labelClass}>Locale</label>
                <select
                  value={form.locale}
                  onChange={(e) => updateField("locale", e.target.value)}
                  className={inputClass}
                >
                  <option value="fr">French (FR)</option>
                  <option value="en">English (EN)</option>
                  <option value="ar">Arabic (AR)</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className={inputClass}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meta */}
            <div className="bg-white rounded-2xl border border-[var(--os-border)] p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Meta</h3>

              <div>
                <label className={labelClass}>Author</label>
                <input
                  type="text"
                  value={form.author}
                  onChange={(e) => updateField("author", e.target.value)}
                  placeholder="Ibda3 Digital"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Read Time (minutes)</label>
                <input
                  type="number"
                  value={form.readTime}
                  onChange={(e) => updateField("readTime", parseInt(e.target.value) || 5)}
                  min={1}
                  max={60}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Cover Image URL</label>
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) => updateField("image", e.target.value)}
                  placeholder="/blog/my-image.webp"
                  className={inputClass}
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">Path to image in /public or full URL</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
