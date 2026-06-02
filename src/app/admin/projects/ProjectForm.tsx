"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown, ChevronLeft, Upload, X, Loader2, Eye, EyeOff,
  ExternalLink, ImageIcon, Sparkles,
} from "lucide-react";
import {
  PROJECT_STATUSES, ProjectStatusBadge,
} from "@/components/admin/project-status-badge";

const CATEGORIES = ["web", "app", "plugin", "ecommerce"];
const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function relativeDate(iso: string | undefined | null): string {
  if (!iso) return "Not saved yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

type Fields = {
  title: string; desc: string; tags: string; tagline: string; metaDesc: string;
  client: string; industry: string; challenge: string; solution: string;
  step1Title: string; step1Desc: string; step2Title: string; step2Desc: string;
  step3Title: string; step3Desc: string; features: string; tech: string;
  result1Value: string; result1Label: string; result2Value: string; result2Label: string;
  result3Value: string; result3Label: string;
  results: string; testimonial: string;
};

const emptyFields: Fields = {
  title: "", desc: "", tags: "", tagline: "", metaDesc: "", client: "",
  industry: "", challenge: "", solution: "", step1Title: "", step1Desc: "",
  step2Title: "", step2Desc: "", step3Title: "", step3Desc: "", features: "",
  tech: "", result1Value: "", result1Label: "", result2Value: "", result2Label: "",
  result3Value: "", result3Label: "", results: "", testimonial: "",
};

type InitialData = {
  id?: string;
  slug: string;
  category: string;
  url: string;
  image: string;
  tag: string;
  visible: boolean;
  status?: string;
  updatedAt?: string;
  translations: (Fields & { locale: string })[];
};

const input =
  "w-full h-11 px-3.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const textarea =
  "w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const lbl = "block text-[13px] font-medium text-[#374151] mb-1.5";

export default function ProjectForm({
  initial,
  mode,
}: {
  initial?: InitialData;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCaseStudy, setShowCaseStudy] = useState(false);

  // Always start editing in French when available
  const initialLang = (() => {
    if (!initial) return "fr";
    if (initial.translations.some((t) => t.locale === "fr")) return "fr";
    return initial.translations[0]?.locale ?? "fr";
  })();
  const [lang, setLang] = useState(initialLang);
  const [category, setCategory] = useState(initial?.category ?? "web");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [status, setStatus] = useState<string>(initial?.status ?? "DRAFT");
  const [lastUpdated, setLastUpdated] = useState(initial?.updatedAt);

  const initialFields =
    initial?.translations.find((t) => t.locale === initialLang) ??
    initial?.translations[0] ??
    { ...emptyFields };
  const [fields, setFields] = useState<Fields>({ ...emptyFields, ...initialFields });

  const slug = initial?.slug ?? slugify(fields.title);
  const isRtl = lang === "ar";

  const markDirty = () => { if (!dirty) setDirty(true); };

  function set<K extends keyof Fields>(field: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [field]: value }));
    markDirty();
  }

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slug", slug || slugify(fields.title) || file.name.replace(/\.[^.]+$/, ""));
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setImage(data.path);
        markDirty();
      } else {
        setError("Image upload failed.");
      }
    } catch {
      setError("Image upload failed.");
    } finally {
      setUploading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, fields.title]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fields.title.trim() || !fields.desc.trim()) {
      setError("Title and description are required.");
      return;
    }

    setSaving(true);
    const allLocales = ["fr", "en", "ar"];
    const translations = allLocales.map((locale) => {
      if (locale === lang) return { locale, ...fields };
      const existing = initial?.translations.find((t) => t.locale === locale);
      if (existing && existing.title) return { ...emptyFields, ...existing };
      return { locale, ...fields };
    });

    const body = {
      slug: slug || slugify(fields.title),
      category, url, image, tag, visible, status, translations,
    };

    const endpoint = mode === "create" ? "/api/admin/projects" : `/api/admin/projects/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved = await res.json().catch(() => null);
        setDirty(false);
        if (saved?.updatedAt) setLastUpdated(saved.updatedAt);
        if (mode === "create") router.push("/admin/projects");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
      }
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const tagsList = fields.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const previewTitle = fields.title || "Project title";
  const cleanUrl = url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const previewHref = slug ? `/fr/portfolio/${slug}` : null;

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* STICKY TOP ACTION BAR */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-[#F7F4FF]/90 backdrop-blur border-b border-[#E5E7EB] mb-6">
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6B7280] hover:text-[#111827] mb-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to projects
          </Link>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[22px] sm:text-[24px] font-bold text-[#111827] tracking-tight leading-tight">
                  {mode === "create" ? "New project" : "Edit project"}
                </h1>
                {mode === "edit" && <ProjectStatusBadge status={status} />}
              </div>
              <p className="text-[13px] text-[#6B7280] mt-1">
                {mode === "create"
                  ? "Add a project to the portfolio."
                  : "Project metadata, content and portfolio settings."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {dirty && !saving && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved
                </span>
              )}
              {mode === "edit" && previewHref && (
                <Link
                  href={previewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-10 px-4 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-[13px] font-medium hover:bg-[#F9FAFB]"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  if (dirty && !confirm("Discard unsaved changes?")) return;
                  router.push("/admin/projects");
                }}
                className="hidden sm:inline-flex items-center justify-center h-10 px-4 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-[13px] font-medium hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[13px] font-semibold disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving..." : mode === "create" ? "Create project" : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
          {/* LEFT */}
          <div className="space-y-6 min-w-0">
            <section className="bg-white border border-[#E5E7EB] rounded-xl p-6">
              <div className="flex items-center gap-3 flex-wrap mb-5">
                <span className="text-[12px] font-medium text-[#6B7280]">Editing in</span>
                <div className="flex gap-1">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => {
                        const next = initial?.translations.find((t) => t.locale === l.value);
                        setLang(l.value);
                        if (next) setFields({ ...emptyFields, ...next });
                      }}
                      className={`h-8 px-3 rounded-md text-[12px] font-medium transition-colors ${
                        lang === l.value
                          ? "bg-[#8B00FF] text-white"
                          : "bg-white border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-[#9CA3AF] ml-auto">Other locales auto-filled if empty.</span>
              </div>

              <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
                <div>
                  <label className={lbl}>Title <span className="text-red-500">*</span></label>
                  <input
                    value={fields.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="Luxury Copro"
                    required
                    className={input}
                  />
                </div>

                <div>
                  <label className={lbl}>Description <span className="text-red-500">*</span></label>
                  <textarea
                    value={fields.desc}
                    onChange={(e) => set("desc", e.target.value)}
                    placeholder="Short paragraph shown on the portfolio card."
                    rows={3}
                    required
                    className={textarea}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Live URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); markDirty(); }}
                      placeholder="https://luxurycopro.webyms.com"
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Slug (auto)</label>
                    <div className="w-full h-11 px-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex items-center text-[14px] text-[#6B7280] font-mono">
                      {slug || "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); markDirty(); }}
                      className={input}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Primary tag</label>
                    <input
                      value={tag}
                      onChange={(e) => { setTag(e.target.value); markDirty(); }}
                      placeholder="Immobilier"
                      className={input}
                    />
                  </div>
                </div>

                <div>
                  <label className={lbl}>Tags (comma separated)</label>
                  <input
                    value={fields.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    placeholder="NextJS, WordPress, React"
                    className={input}
                  />
                </div>
              </div>
            </section>

            {/* Case study */}
            <section className="bg-white border border-[#E5E7EB] rounded-xl">
              <button
                type="button"
                onClick={() => setShowCaseStudy((s) => !s)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 flex items-center justify-center text-[#8B00FF]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-[#111827]">Case study</h2>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">
                      Reusable content for the project page, portfolio, and client success stories.
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#6B7280] transition-transform shrink-0 ${showCaseStudy ? "rotate-180" : ""}`} />
              </button>

              {showCaseStudy && (
                <div className="px-6 pb-6 border-t border-[#E5E7EB] pt-5 space-y-5" dir={isRtl ? "rtl" : "ltr"}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Client</label>
                      <input value={fields.client} onChange={(e) => set("client", e.target.value)} placeholder="Luxury Copro SARL" className={input} />
                    </div>
                    <div>
                      <label className={lbl}>Industry</label>
                      <input value={fields.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Real estate" className={input} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>Tagline</label>
                    <input
                      value={fields.tagline}
                      onChange={(e) => set("tagline", e.target.value)}
                      placeholder="Premium real-estate, beautifully managed."
                      className={input}
                    />
                    <p className="text-[11px] text-[#9CA3AF] mt-1">One-line subtitle shown on the case study hero.</p>
                  </div>

                  <div>
                    <label className={lbl}>Challenge</label>
                    <textarea
                      value={fields.challenge}
                      onChange={(e) => set("challenge", e.target.value)}
                      rows={3}
                      placeholder="What problem did the client face?"
                      className={textarea}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Solution</label>
                    <textarea
                      value={fields.solution}
                      onChange={(e) => set("solution", e.target.value)}
                      rows={3}
                      placeholder="How did we solve it?"
                      className={textarea}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Technologies used</label>
                    <textarea
                      value={fields.tech}
                      onChange={(e) => set("tech", e.target.value)}
                      rows={2}
                      placeholder="Next.js, Tailwind CSS, Prisma, PostgreSQL..."
                      className={textarea}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Results</label>
                    <textarea
                      value={fields.results}
                      onChange={(e) => set("results", e.target.value)}
                      rows={3}
                      placeholder="What did the client gain? Use numbers when you can — sales lift, traffic, page speed..."
                      className={textarea}
                    />
                  </div>

                  <div>
                    <label className={lbl}>Client testimonial</label>
                    <textarea
                      value={fields.testimonial}
                      onChange={(e) => set("testimonial", e.target.value)}
                      rows={3}
                      placeholder="Verbatim quote from the client, plus their name and role."
                      className={textarea}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT — sticky */}
          <aside className="space-y-5 min-w-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
            {/* Project Status */}
            <section className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="text-[14px] font-semibold text-[#111827]">Project status</h2>
                <ProjectStatusBadge status={status} size="sm" />
              </div>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); markDirty(); }}
                className={input}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-[#9CA3AF] mt-2">
                Workflow phase. Separate from public visibility below.
              </p>
            </section>

            {/* Live preview */}
            <section className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Live preview</span>
                <div className="flex items-center gap-1.5">
                  {visible ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                      <Eye className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] px-1.5 py-0.5 rounded-full">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
              </div>
              <div className="relative aspect-[16/10] bg-[#F3F4F6]">
                {image && image.startsWith("/") ? (
                  <Image src={image} alt="" fill sizes="340px" className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#9CA3AF]">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ProjectStatusBadge status={status} size="sm" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B00FF] bg-[#8B00FF]/10 px-2 py-0.5 rounded">
                    {category}
                  </span>
                  {tag && (
                    <span className="text-[10px] font-medium text-[#374151] bg-[#F3F4F6] px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  )}
                </div>
                <h3 className="text-[15px] font-semibold text-[#111827] leading-snug truncate">{previewTitle}</h3>
                {cleanUrl ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-[#8B00FF] hover:underline truncate max-w-full"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{cleanUrl}</span>
                  </a>
                ) : (
                  <p className="text-[12px] text-[#9CA3AF]">No URL set</p>
                )}
                {tagsList.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tagsList.slice(0, 6).map((t) => (
                      <span key={t} className="text-[10px] text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-[#9CA3AF] pt-2 border-t border-[#F3F4F6] mt-2">
                  Last updated · {relativeDate(lastUpdated)}
                </p>
              </div>
            </section>

            {/* Cover image */}
            <section className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h2 className="text-[14px] font-semibold text-[#111827] mb-1">Cover image</h2>
              <p className="text-[12px] text-[#6B7280] mb-3">1280×800 recommended, auto-converted to WebP.</p>
              {image && image.startsWith("/") ? (
                <div className="space-y-2">
                  <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#F9FAFB]">
                    <Image src={image} alt="Project cover" fill sizes="280px" className="object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[12px] font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-60"
                    >
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading ? "Uploading..." : "Replace"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImage(""); markDirty(); }}
                      className="inline-flex items-center justify-center h-9 px-3 border border-[#E5E7EB] rounded-lg text-[12px] text-[#6B7280] hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full aspect-[16/10] border-2 border-dashed border-[#D1D5DB] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] hover:border-[#9CA3AF] flex flex-col items-center justify-center gap-1 text-[12px] text-[#6B7280]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-[#8B00FF]" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Click to upload</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </section>

            {/* Visibility */}
            <section className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h2 className="text-[14px] font-semibold text-[#111827] mb-3">Visibility</h2>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => { setVisible(e.target.checked); markDirty(); }}
                  className="mt-0.5 w-4 h-4 rounded border-[#D1D5DB] accent-[#8B00FF]"
                />
                <div>
                  <p className="text-[13px] font-medium text-[#111827]">Public on site</p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    {visible ? "Listed on the portfolio page." : "Hidden — only admins can see it."}
                  </p>
                </div>
              </label>
            </section>

            {/* SEO */}
            <section className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h2 className="text-[14px] font-semibold text-[#111827] mb-1">SEO</h2>
              <p className="text-[12px] text-[#6B7280] mb-3">Shown in search engines and social shares.</p>
              <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
                <div>
                  <label className={lbl}>Meta description</label>
                  <textarea
                    value={fields.metaDesc}
                    onChange={(e) => set("metaDesc", e.target.value)}
                    placeholder="150 characters max."
                    rows={3}
                    maxLength={180}
                    className={textarea}
                  />
                </div>
              </div>
            </section>
          </aside>
        </div>

        {error && (
          <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}
