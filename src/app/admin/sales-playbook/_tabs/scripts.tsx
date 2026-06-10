"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";

type Script = {
  id: string;
  category: string;
  title: string;
  body: string;
  tags: string;
  language: string;
  isActive: boolean;
};

const CATEGORIES = ["WHATSAPP", "INSTAGRAM_DM", "CALL", "OBJECTION_HANDLING"] as const;
const LANGS = ["fr", "en", "ar"] as const;

const CATEGORY_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM_DM: "Instagram DM",
  CALL: "Call",
  OBJECTION_HANDLING: "Objections",
};

export function ScriptsTab() {
  const [items, setItems] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Script | "new" | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/sales-playbook/scripts");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const filtered = filter === "ALL" ? items : items.filter((s) => s.category === filter);
    const map: Record<string, Script[]> = {};
    for (const s of filtered) {
      (map[s.category] = map[s.category] || []).push(s);
    }
    return map;
  }, [items, filter]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this script?")) return;
    const res = await fetch(`/api/admin/sales-playbook/scripts/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleCopy(s: Script) {
    await navigator.clipboard.writeText(s.body);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {["ALL", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "text-[12px] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all",
                filter === c
                  ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#7C3AED] border border-purple-200"
                  : "text-[#475569] hover:bg-[#F1F5F9] border border-transparent"
              )}
            >
              {c === "ALL" ? "All categories" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20 hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          New script
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-2xl" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={<Plus className="w-7 h-7" />}
          title="No scripts yet"
          description="Save the messages and objection-handling lines that work."
        />
      ) : (
        <div className="space-y-6">
          {CATEGORIES.filter((c) => grouped[c]?.length).map((cat) => (
            <div key={cat}>
              <h3 className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-2">
                {CATEGORY_LABEL[cat]} <span className="text-[#94A3B8]">({grouped[cat].length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped[cat].map((s) => (
                  <div key={s.id} className="rounded-2xl border border-[var(--os-border)] bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-[#0F172A]">{s.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-[#475569] rounded uppercase">{s.language}</span>
                          {!s.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">Inactive</span>}
                        </div>
                        {s.tags && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-[#7C3AED] rounded">{tag}</span>
                            ))}
                          </div>
                        )}
                        <pre className="mt-2 text-[12px] text-[#475569] whitespace-pre-wrap font-sans leading-relaxed">{s.body}</pre>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => handleCopy(s)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#8B00FF] hover:bg-purple-50">
                          {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setEditing(s)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-[#475569] hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ScriptModal
          script={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setItems((prev) => editing === "new" ? [s, ...prev] : prev.map((x) => x.id === s.id ? s : x));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ScriptModal({
  script,
  onClose,
  onSaved,
}: {
  script: Script | null;
  onClose: () => void;
  onSaved: (s: Script) => void;
}) {
  const isNew = !script;
  const [category, setCategory] = useState(script?.category || "WHATSAPP");
  const [title, setTitle] = useState(script?.title || "");
  const [body, setBody] = useState(script?.body || "");
  const [tags, setTags] = useState(script?.tags || "");
  const [language, setLanguage] = useState(script?.language || "fr");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = isNew ? "/api/admin/sales-playbook/scripts" : `/api/admin/sales-playbook/scripts/${script!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, body, tags, language }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      onSaved(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300";
  const labelCls = "block text-[12px] font-medium text-[#475569] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--os-border)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">{isNew ? "New script" : "Edit script"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} required placeholder="Trop cher" />
          </div>

          <div>
            <label className={labelCls}>Tags (comma separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="too_expensive, price, budget" />
          </div>

          <div>
            <label className={labelCls}>Body *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={cn(inputCls, "h-44 resize-none font-mono text-[12.5px]")} required />
          </div>

          {error && <div className="text-[12px] text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9]">Cancel</button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className={cn(
                "px-5 py-2 rounded-xl text-[13px] font-medium text-white shadow-md transition-all",
                submitting ? "bg-gray-400" : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:shadow-lg"
              )}
            >
              {submitting ? "Saving..." : isNew ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
