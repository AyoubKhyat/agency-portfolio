"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HiOutlineChevronDown, HiOutlinePhoto, HiOutlineXMark } from "react-icons/hi2";

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

type Fields = {
  title: string;
  desc: string;
  tags: string;
  tagline: string;
  metaDesc: string;
  client: string;
  industry: string;
  challenge: string;
  solution: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  features: string;
  tech: string;
  result1Value: string;
  result1Label: string;
  result2Value: string;
  result2Label: string;
  result3Value: string;
  result3Label: string;
};

const emptyFields: Fields = {
  title: "", desc: "", tags: "", tagline: "", metaDesc: "", client: "",
  industry: "", challenge: "", solution: "", step1Title: "", step1Desc: "",
  step2Title: "", step2Desc: "", step3Title: "", step3Desc: "", features: "",
  tech: "", result1Value: "", result1Label: "", result2Value: "", result2Label: "",
  result3Value: "", result3Label: "",
};

type InitialData = {
  id?: string;
  slug: string;
  category: string;
  url: string;
  image: string;
  tag: string;
  visible: boolean;
  translations: (Fields & { locale: string })[];
};

export default function ProjectForm({
  initial,
  mode,
}: {
  initial?: InitialData;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCaseStudy, setShowCaseStudy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [lang, setLang] = useState(initial ? (initial.translations[0]?.locale ?? "fr") : "fr");
  const [category, setCategory] = useState(initial?.category ?? "web");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [visible, setVisible] = useState(initial?.visible ?? true);

  const existingFields = initial?.translations.find((t) => t.locale === lang);
  const [fields, setFields] = useState<Fields>(existingFields ?? initial?.translations[0] ?? { ...emptyFields });

  const slug = initial?.slug ?? slugify(fields.title);

  function set(field: keyof Fields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slug", slug || slugify(fields.title) || file.name.replace(/\.[^.]+$/, ""));
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setImage(data.path);
    }
    setUploading(false);
  }, [slug, fields.title]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fields.title.trim() || !fields.desc.trim()) {
      setError("Title and description are required");
      return;
    }

    setSaving(true);

    const allLocales = ["fr", "en", "ar"];
    const translations = allLocales.map((locale) => {
      if (locale === lang) return { locale, ...fields };
      const existing = initial?.translations.find((t) => t.locale === locale);
      if (existing && existing.title) return existing;
      return { locale, ...fields };
    });

    const body = {
      slug: slug || slugify(fields.title),
      category,
      url,
      image,
      tag,
      visible,
      translations,
    };

    const endpoint = mode === "create" ? "/api/admin/projects" : `/api/admin/projects/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (res.ok) {
      router.push("/admin/projects");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Something went wrong");
    }
    setSaving(false);
  }

  const input = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500 transition-colors";
  const lbl = "block text-xs text-gray-400 mb-1.5 uppercase tracking-wider";
  const isRtl = lang === "ar";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Language + Category row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={lbl}>Write in</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className={input}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <p className="text-[10px] text-gray-600 mt-1">Other languages auto-filled</p>
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Tag</label>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Laravel, PHP" className={input} />
        </div>
      </div>

      {/* URL + slug preview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={input} />
        </div>
        <div>
          <label className={lbl}>Slug (auto)</label>
          <div className="px-3 py-2 bg-white/5 border border-white/5 rounded-lg text-sm text-gray-500 font-mono">
            {slug || "—"}
          </div>
        </div>
      </div>

      {/* Image upload */}
      <div>
        <label className={lbl}>Image</label>
        {image && image.startsWith("/") ? (
          <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-white/10 group">
            <Image src={image} alt="" width={400} height={250} className="w-full h-auto object-cover" />
            <button
              type="button"
              onClick={() => setImage("")}
              className="absolute top-2 right-2 p-1 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <HiOutlineXMark className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragging
                ? "border-violet-500 bg-violet-500/10"
                : "border-white/10 hover:border-white/20 bg-white/5"
            }`}
          >
            {uploading ? (
              <p className="text-sm text-gray-400 animate-pulse">Uploading...</p>
            ) : (
              <>
                <HiOutlinePhoto className="w-8 h-8 text-gray-600" />
                <p className="text-sm text-gray-400">
                  Drag & drop an image here, or <span className="text-violet-400">click to browse</span>
                </p>
                <p className="text-[10px] text-gray-600">Auto-converted to WebP</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500" />
        <span className="text-sm text-gray-300">Visible on public site</span>
      </label>

      {/* Content fields */}
      <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
        <div>
          <label className={lbl}>Title *</label>
          <input value={fields.title} onChange={(e) => set("title", e.target.value)} required className={input} />
        </div>
        <div>
          <label className={lbl}>Description *</label>
          <textarea value={fields.desc} onChange={(e) => set("desc", e.target.value)} required rows={2} className={input} />
        </div>
        <div>
          <label className={lbl}>Tags (comma separated)</label>
          <input value={fields.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Design, Development" className={input} />
        </div>
      </div>

      {/* Case study — collapsible */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCaseStudy(!showCaseStudy)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span>Case Study Details (optional)</span>
          <HiOutlineChevronDown className={`w-4 h-4 transition-transform ${showCaseStudy ? "rotate-180" : ""}`} />
        </button>

        {showCaseStudy && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-4" dir={isRtl ? "rtl" : "ltr"}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tagline</label>
                <input value={fields.tagline} onChange={(e) => set("tagline", e.target.value)} className={input} />
              </div>
              <div>
                <label className={lbl}>Meta Description</label>
                <input value={fields.metaDesc} onChange={(e) => set("metaDesc", e.target.value)} className={input} />
              </div>
              <div>
                <label className={lbl}>Client</label>
                <input value={fields.client} onChange={(e) => set("client", e.target.value)} className={input} />
              </div>
              <div>
                <label className={lbl}>Industry</label>
                <input value={fields.industry} onChange={(e) => set("industry", e.target.value)} className={input} />
              </div>
            </div>
            <div>
              <label className={lbl}>Challenge</label>
              <textarea value={fields.challenge} onChange={(e) => set("challenge", e.target.value)} rows={2} className={input} />
            </div>
            <div>
              <label className={lbl}>Solution</label>
              <textarea value={fields.solution} onChange={(e) => set("solution", e.target.value)} rows={2} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([1, 2, 3] as const).map((n) => (
                <div key={n} className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Step {n} Title</label>
                    <input value={fields[`step${n}Title`]} onChange={(e) => set(`step${n}Title`, e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Step {n} Desc</label>
                    <input value={fields[`step${n}Desc`]} onChange={(e) => set(`step${n}Desc`, e.target.value)} className={input} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className={lbl}>Features (comma separated)</label>
              <input value={fields.features} onChange={(e) => set("features", e.target.value)} className={input} />
            </div>
            <div>
              <label className={lbl}>Technologies (comma separated)</label>
              <input value={fields.tech} onChange={(e) => set("tech", e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([1, 2, 3] as const).map((n) => (
                <div key={n} className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>Result {n}</label>
                    <input value={fields[`result${n}Value`]} onChange={(e) => set(`result${n}Value`, e.target.value)} placeholder="95%" className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Label</label>
                    <input value={fields[`result${n}Label`]} onChange={(e) => set(`result${n}Label`, e.target.value)} className={input} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? "Saving..." : mode === "create" ? "Create Project" : "Save Changes"}
        </button>
        <button type="button" onClick={() => router.push("/admin/projects")}
          className="px-6 py-2.5 border border-white/10 text-gray-400 hover:text-gray-200 rounded-lg text-sm transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
