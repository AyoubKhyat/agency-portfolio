"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Undo2, X } from "lucide-react";
import { Field, FormButton, FormError, Input, Select, Textarea } from "@/components/admin/form";
import {
  CAPTION_MAX,
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  CONTENT_METRICS,
  CONTENT_METRIC_LABELS,
  CONTENT_STATUS_LABELS,
  PRE_PUBLISH_STATUSES,
  readinessProblems,
  type ContentMetric,
  type ContentPostDTO,
} from "@/lib/content-posts";

/* ---------- date helpers (datetime-local works in the browser's time zone) ---------- */

export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

/* ---------- form ---------- */

type FormState = {
  title: string;
  format: string;
  status: string;
  plannedAt: string;
  pillar: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  media: string;
  nextAction: string;
  notes: string;
};

function initialState(post: ContentPostDTO | null, defaultDate: string | null): FormState {
  return {
    title: post?.title ?? "",
    format: post?.format ?? "REEL",
    status: post?.status ?? "IDEA",
    plannedAt: post ? toLocalInput(post.plannedAt) : defaultDate ? `${defaultDate}T18:00` : "",
    pillar: post?.pillar ?? "",
    hook: post?.hook ?? "",
    caption: post?.caption ?? "",
    hashtags: post?.hashtags ?? "",
    cta: post?.cta ?? "",
    media: (post?.mediaPaths ?? []).join("\n"),
    nextAction: post?.nextAction ?? "",
    notes: post?.notes ?? "",
  };
}

const mediaList = (s: string) => s.split("\n").map((m) => m.trim()).filter(Boolean);

type Props = {
  post: ContentPostDTO | null;
  /** Prefills the planned date when creating from a calendar day (YYYY-MM-DD). */
  defaultDate?: string | null;
  onClose: () => void;
  /** "metrics": saved from the Published panel; the form stays open on the fresh row. */
  onSaved: (post: ContentPostDTO, mode: "created" | "updated" | "metrics") => void;
};

export function ContentPostForm({ post, defaultDate = null, onClose, onSaved }: Props) {
  const [initial] = useState(() => initialState(post, defaultDate));
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = post?.status === "PUBLISHED";
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const problems = useMemo(
    () =>
      isPublished
        ? []
        : readinessProblems({
            title: form.title,
            format: form.format,
            status: form.status,
            plannedAt: form.plannedAt ? new Date(form.plannedAt) : null,
            caption: form.caption,
            mediaPaths: mediaList(form.media),
            publishedUrl: "",
            publishedAt: null,
          }),
    [form, isPublished],
  );

  async function send(method: "POST" | "PATCH", body: Record<string, unknown>): Promise<ContentPostDTO | null> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(post ? `/api/admin/content/${post.id}` : "/api/admin/content", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      return data as ContentPostDTO;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length) return;
    const body: Record<string, unknown> = {
      title: form.title,
      format: form.format,
      plannedAt: fromLocalInput(form.plannedAt),
      pillar: form.pillar,
      hook: form.hook,
      caption: form.caption,
      hashtags: form.hashtags,
      cta: form.cta,
      mediaPaths: mediaList(form.media),
      nextAction: form.nextAction,
      notes: form.notes,
    };
    if (!isPublished) body.status = form.status;
    const saved = await send(post ? "PATCH" : "POST", body);
    if (saved) onSaved(saved, post ? "updated" : "created");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-[15px] font-semibold text-[#0F172A]">{post ? "Edit post" : "New post"}</h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                {post?.sourceKey ? `Imported · ${post.sourceKey}` : "Instagram content plan — publishing stays manual"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 sm:px-6 py-5 space-y-4">
            <FormError message={error} />

            <Field label="Title" htmlFor="cp-title" required>
              <Input id="cp-title" value={form.title} onChange={set("title")} maxLength={200} placeholder="What is this post about?" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Format" htmlFor="cp-format">
                <Select id="cp-format" value={form.format} onChange={set("format")}>
                  {CONTENT_FORMATS.map((f) => <option key={f} value={f}>{CONTENT_FORMAT_LABELS[f]}</option>)}
                </Select>
              </Field>
              <Field label="Status" htmlFor="cp-status" hint={isPublished ? "Use the panel below to move it out of Published." : undefined}>
                {isPublished ? (
                  <Input id="cp-status" value="Published" disabled />
                ) : (
                  <Select id="cp-status" value={form.status} onChange={set("status")}>
                    {PRE_PUBLISH_STATUSES.map((s) => <option key={s} value={s}>{CONTENT_STATUS_LABELS[s]}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Planned date" htmlFor="cp-planned">
                <Input id="cp-planned" type="datetime-local" value={form.plannedAt} onChange={set("plannedAt")} />
              </Field>
            </div>

            {problems.length > 0 && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-[13px] text-amber-800">
                <p className="font-medium mb-1">Before it can be {CONTENT_STATUS_LABELS[form.status as keyof typeof CONTENT_STATUS_LABELS]?.toLowerCase() ?? "saved"}:</p>
                <ul className="list-disc pl-5 space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Pillar / theme" htmlFor="cp-pillar">
                <Input id="cp-pillar" value={form.pillar} onChange={set("pillar")} maxLength={100} placeholder="Portfolio, education, behind the scenes…" />
              </Field>
              <Field label="Call to action" htmlFor="cp-cta">
                <Input id="cp-cta" value={form.cta} onChange={set("cta")} maxLength={300} placeholder="Message us on WhatsApp" />
              </Field>
            </div>

            <Field label="Hook" htmlFor="cp-hook">
              <Input id="cp-hook" value={form.hook} onChange={set("hook")} maxLength={500} placeholder="First line or first second" />
            </Field>

            <Field
              label="Caption"
              htmlFor="cp-caption"
              hint={`${form.caption.length} / ${CAPTION_MAX}${form.format === "STORY" ? " · optional for Stories" : ""}`}
              error={form.caption.length > CAPTION_MAX ? `Instagram allows ${CAPTION_MAX} characters.` : null}
            >
              <Textarea id="cp-caption" rows={6} value={form.caption} onChange={set("caption")} />
            </Field>

            <Field label="Hashtags" htmlFor="cp-hashtags">
              <Input id="cp-hashtags" value={form.hashtags} onChange={set("hashtags")} maxLength={1000} placeholder="#ibda3digital #marrakech" />
            </Field>

            <Field
              label="Media paths"
              htmlFor="cp-media"
              hint={form.format === "CAROUSEL" ? "One per line, in slide order." : "One per line (file path or link)."}
            >
              <Textarea id="cp-media" rows={3} value={form.media} onChange={set("media")} className="font-mono text-[12.5px] min-h-[72px]" />
            </Field>

            <Field label="Next action" htmlFor="cp-next" hint="Shown in the daily follow-up list until the post is published.">
              <Input id="cp-next" value={form.nextAction} onChange={set("nextAction")} maxLength={300} placeholder="Record the voiceover, export slides…" />
            </Field>

            <Field label="Notes" htmlFor="cp-notes">
              <Textarea id="cp-notes" rows={3} value={form.notes} onChange={set("notes")} className="min-h-[72px]" />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
            <FormButton type="button" variant="ghost" onClick={onClose}>Cancel</FormButton>
            <FormButton type="submit" loading={saving} disabled={problems.length > 0 || (!!post && !dirty)}>
              {post ? "Save changes" : "Create post"}
            </FormButton>
          </div>
        </form>

        {post && !isPublished && (post.status === "READY" || post.status === "SCHEDULED") && (
          <PublishPanel post={post} dirty={dirty} saving={saving} send={send} onSaved={onSaved} />
        )}
        {post && isPublished && <PublishedPanel post={post} dirty={dirty} saving={saving} send={send} onSaved={onSaved} />}
      </div>
    </div>
  );
}

/* ---------- mark as published (explicit confirmation) ---------- */

type PanelProps = {
  post: ContentPostDTO;
  saving: boolean;
  send: (method: "PATCH", body: Record<string, unknown>) => Promise<ContentPostDTO | null>;
  onSaved: Props["onSaved"];
};

function PublishPanel({ post, dirty, saving, send, onSaved }: PanelProps & { dirty: boolean }) {
  const [url, setUrl] = useState("");
  const [at, setAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [confirmed, setConfirmed] = useState(false);

  async function publish() {
    const saved = await send("PATCH", {
      status: "PUBLISHED",
      publishedUrl: url.trim(),
      publishedAt: fromLocalInput(at),
      confirmPublished: true,
    });
    if (saved) onSaved(saved, "updated");
  }

  return (
    <div className="px-5 sm:px-6 py-5 border-t border-[#E2E8F0] space-y-3">
      <h3 className="text-[14px] font-semibold text-[#0F172A]">Mark as published</h3>
      <p className="text-[12.5px] text-[#64748B]">Only once the post is live on Instagram. The link and date are recorded.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
        <Field label="Instagram link" htmlFor="cp-pub-url">
          <Input id="cp-pub-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" />
        </Field>
        <Field label="Published on" htmlFor="cp-pub-at">
          <Input id="cp-pub-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-[13px] text-[#334155]">
        <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I confirm “{post.title}” is live on Instagram.
      </label>
      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-[12px] text-amber-700">Save your changes first.</span>}
        <FormButton
          type="button"
          variant="secondary"
          icon={<CheckCircle2 className="w-4 h-4" />}
          loading={saving}
          disabled={!confirmed || !url.trim() || !at || dirty}
          onClick={publish}
        >
          Mark as published
        </FormButton>
      </div>
    </div>
  );
}

/* ---------- published: link, metrics, move back ---------- */

function PublishedPanel({ post, dirty, saving, send, onSaved }: PanelProps & { dirty: boolean }) {
  const [metrics, setMetrics] = useState<Record<ContentMetric, string>>(
    () => Object.fromEntries(CONTENT_METRICS.map((m) => [m, post[m] == null ? "" : String(post[m])])) as Record<ContentMetric, string>,
  );
  const [confirmBack, setConfirmBack] = useState(false);

  async function saveMetrics() {
    const body: Record<string, number | null> = {};
    for (const m of CONTENT_METRICS) body[m] = metrics[m].trim() === "" ? null : Math.max(0, Math.round(Number(metrics[m])));
    const saved = await send("PATCH", body);
    if (saved) onSaved(saved, "metrics");
  }

  async function moveBack() {
    const saved = await send("PATCH", { status: "READY", confirmUnpublish: true });
    if (saved) onSaved(saved, "updated");
  }

  const invalid = CONTENT_METRICS.some((m) => metrics[m].trim() !== "" && !(Number(metrics[m]) >= 0));

  return (
    <div className="px-5 sm:px-6 py-5 border-t border-[#E2E8F0] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-[#0F172A]">Published</h3>
        <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-[#7C3AED] hover:underline">
          View on Instagram <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-[12.5px] text-[#64748B]">
        {post.publishedAt ? `Published ${new Date(post.publishedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : ""}
        {post.metricsUpdatedAt ? ` · metrics updated ${new Date(post.metricsUpdatedAt).toLocaleDateString("fr-FR")}` : ""}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CONTENT_METRICS.map((m) => (
          <Field key={m} label={CONTENT_METRIC_LABELS[m]} htmlFor={`cp-m-${m}`}>
            <Input
              id={`cp-m-${m}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={metrics[m]}
              onChange={(e) => setMetrics((s) => ({ ...s, [m]: e.target.value }))}
              placeholder="—"
              className="h-10"
            />
          </Field>
        ))}
      </div>
      <div className="flex justify-end">
        <FormButton type="button" variant="secondary" size="sm" loading={saving} disabled={invalid} onClick={saveMetrics}>
          Save metrics
        </FormButton>
      </div>

      <div className="pt-3 border-t border-dashed border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-start gap-2 text-[12.5px] text-[#475569]">
          <input type="checkbox" className="mt-0.5" checked={confirmBack} onChange={(e) => setConfirmBack(e.target.checked)} />
          Move back to Ready (the link and metrics are kept).
        </label>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-[12px] text-amber-700">Save your changes first.</span>}
          <FormButton type="button" variant="ghost" size="sm" icon={<Undo2 className="w-4 h-4" />} disabled={!confirmBack || saving || dirty} onClick={moveBack}>
            Move out of Published
          </FormButton>
        </div>
      </div>
    </div>
  );
}
