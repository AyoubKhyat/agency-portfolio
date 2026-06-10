"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";

type Template = {
  id: string;
  key: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  language: string;
  notes: string;
  isActive: boolean;
};

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "EMAIL", "CALL"] as const;
const LANGS = ["fr", "en", "ar"] as const;

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  EMAIL: "Email",
  CALL: "Call",
};

export function TemplatesTab() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/sales-playbook/templates");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => filter === "ALL" ? items : items.filter((t) => t.channel === filter),
    [items, filter]
  );

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/admin/sales-playbook/templates/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleToggleActive(t: Template) {
    const res = await fetch(`/api/admin/sales-playbook/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    }
  }

  async function handleCopy(t: Template) {
    await navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {["ALL", ...CHANNELS].map((c) => (
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
              {c === "ALL" ? "All channels" : CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20 hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          New template
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Plus className="w-7 h-7" />}
          title={items.length === 0 ? "No templates yet" : "No templates in this channel"}
          description="Create reusable outreach copy your whole team can pick from."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#0F172A]">{t.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F1F5F9] rounded text-[#64748B] uppercase tracking-wider">{t.key}</span>
                    <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-[#7C3AED] rounded-full font-medium">
                      {CHANNEL_LABEL[t.channel] || t.channel}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-gray-50 text-[#475569] rounded-full uppercase">{t.language}</span>
                    {!t.isActive && (
                      <span className="text-[11px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full">Inactive</span>
                    )}
                  </div>
                  {t.subject && (
                    <div className="mt-2 text-[12px] text-[#475569]"><span className="font-medium">Subject:</span> {t.subject}</div>
                  )}
                  <pre className="mt-2 text-[12.5px] text-[#0F172A] whitespace-pre-wrap font-sans leading-relaxed">{t.body}</pre>
                  {t.notes && (
                    <div className="mt-2 text-[11px] text-[#64748B] italic">{t.notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleCopy(t)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#8B00FF] hover:bg-purple-50" title="Copy body">
                    {copiedId === t.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleToggleActive(t)} className="text-[11px] font-medium text-[#64748B] px-2 py-1 rounded-md hover:bg-[#F1F5F9]" title="Toggle active">
                    {t.isActive ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => setEditing(t)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg text-[#475569] hover:text-red-600 hover:bg-red-50" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setItems((prev) => editing === "new" ? [t, ...prev] : prev.map((x) => x.id === t.id ? t : x));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Modal ---------------- */
function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: (t: Template) => void;
}) {
  const isNew = !template;
  const [key, setKey] = useState(template?.key || "");
  const [name, setName] = useState(template?.name || "");
  const [channel, setChannel] = useState(template?.channel || "WHATSAPP");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const [language, setLanguage] = useState(template?.language || "fr");
  const [notes, setNotes] = useState(template?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = isNew
        ? "/api/admin/sales-playbook/templates"
        : `/api/admin/sales-playbook/templates/${template!.id}`;
      const method = isNew ? "POST" : "PATCH";
      const payload = isNew
        ? { key: key.toUpperCase(), name, channel, subject, body, language, notes }
        : { name, channel, subject, body, language, notes };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--os-border)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">{isNew ? "New template" : "Edit template"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required placeholder="Website offer (FR)" />
            </div>
            <div>
              <label className={labelCls}>Key {!isNew && <span className="text-[10px] text-[#94A3B8]">(immutable)</span>}</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                className={inputCls}
                placeholder="WEBSITE_OFFER"
                disabled={!isNew}
                required={isNew}
              />
            </div>
            <div>
              <label className={labelCls}>Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
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
            <label className={labelCls}>Subject (optional, for email)</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Body * <span className="text-[10px] text-[#94A3B8]">— use {`{{name}}`}, {`{{sector}}`}, {`{{city}}`} placeholders</span></label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={cn(inputCls, "h-48 resize-none font-mono text-[12.5px]")} required />
          </div>

          <div>
            <label className={labelCls}>Internal notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="When to use this template" />
          </div>

          {error && <div className="text-[12px] text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9]">Cancel</button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !body.trim() || (isNew && !key.trim())}
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
