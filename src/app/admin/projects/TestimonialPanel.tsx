"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, EyeOff, Loader2, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { TESTIMONIAL_LIMITS, approvalProblem, type TestimonialState } from "@/lib/testimonial-approval";

export type TestimonialApiState = {
  author: string;
  consent: string;
  kind: string;
  quote: string;
  role: string;
  approvedAt: string | null;
  approvedBy: string | null;
  hasCanonicalRow: boolean;
  unpublished?: boolean;
};
type Draft = { author: string; consent: string; quote: string; role: string };

const input =
  "w-full h-11 px-3.5 bg-[var(--os-control-bg)] border border-[#D1D5DB] os-dark:border-[var(--os-control-border)] rounded-lg text-[14px] text-[#111827] os-dark:text-[var(--os-text)] placeholder:text-[#9CA3AF] os-dark:placeholder:text-[var(--os-text-soft)] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const textarea =
  "w-full px-3.5 py-2.5 bg-[var(--os-control-bg)] border border-[#D1D5DB] os-dark:border-[var(--os-control-border)] rounded-lg text-[14px] leading-relaxed text-[#111827] os-dark:text-[var(--os-text)] placeholder:text-[#9CA3AF] os-dark:placeholder:text-[var(--os-text-soft)] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const lbl = "block text-[13px] font-medium text-[#374151] os-dark:text-[var(--os-text)] mb-1.5";
const hint = "text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] mt-1";

const draftOf = (s: TestimonialApiState): Draft => ({ author: s.author, consent: s.consent, quote: s.quote, role: s.role });

/** The saved state in the shape lib/testimonial-approval checks (publishing needs saved values). */
const asState = (s: TestimonialApiState): TestimonialState => ({
  projectId: "",
  kind: s.kind,
  author: s.author,
  consent: s.consent,
  quote: s.quote,
  role: s.role,
  approvedAt: s.approvedAt ? new Date(s.approvedAt) : null,
  approvedBy: s.approvedBy,
  hasCanonicalRow: s.hasCanonicalRow,
});

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// Enter in a single-line field must not submit the surrounding project form.
const noEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") e.preventDefault(); };

/**
 * The project's client testimonial: one quote, author, role and consent reference, published on
 * the FR, EN and AR homepages as written (nothing is translated). Saved and published separately
 * from the project form (rules: lib/testimonial-approval). Only an admin publishes, for the exact
 * saved text; editing the quote, role or author unpublishes it.
 */
export default function TestimonialPanel({ projectId, initial }: { projectId?: string; initial?: TestimonialApiState }) {
  const [saved, setSaved] = useState<TestimonialApiState | null>(initial ?? null);
  const [draft, setDraft] = useState<Draft | null>(initial ? draftOf(initial) : null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "publish">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!projectId || initial) return;
    let cancelled = false;
    fetch(`/api/admin/projects/${projectId}/testimonial`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok || !data) { setLoadError(data?.error ?? "Could not load the testimonial."); return; }
        setSaved(data);
        setDraft(draftOf(data));
      })
      .catch(() => { if (!cancelled) setLoadError("Could not load the testimonial."); });
    return () => { cancelled = true; };
  }, [projectId, initial]);

  if (!projectId) {
    return <Shell><p className="text-[13px] text-[#6B7280] os-dark:text-[var(--os-text)]">Save the project first, then add the client&apos;s testimonial here.</p></Shell>;
  }
  if (loadError) return <Shell><p role="alert" className="text-[13px] text-red-700 os-dark:text-red-300">{loadError}</p></Shell>;
  if (!saved || !draft) {
    return <Shell><Loader2 className="w-4 h-4 animate-spin text-[#8B00FF] os-dark:text-[var(--os-purple)]" /></Shell>;
  }

  const textDirty = draft.quote.trim() !== saved.quote || draft.role.trim() !== saved.role;
  const authorDirty = draft.author.trim() !== saved.author;
  const consentDirty = draft.consent.trim() !== saved.consent;
  const dirty = textDirty || authorDirty || consentDirty;
  const consentRemoved = saved.consent.trim() !== "" && draft.consent.trim() === "";
  const published = !!saved.approvedAt;
  const willUnpublish = published && (textDirty || authorDirty || consentRemoved);
  const empty = !saved.quote.trim() && !saved.role.trim();
  const problem = approvalProblem(asState(saved), { author: saved.author, role: saved.role, quote: saved.quote });

  function edit(field: keyof Draft, value: string) {
    setDraft((d) => d && { ...d, [field]: value });
    if (field !== "consent") setConfirmed(false);
    setNotice("");
  }

  async function call(method: "PUT" | "POST", body: unknown, what: "save" | "publish") {
    setBusy(what);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/testimonial`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : `Something went wrong (error ${res.status}).`);
        return null;
      }
      setSaved(data);
      setDraft(draftOf(data));
      setConfirmed(false);
      return data as TestimonialApiState;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function save() {
    const data = await call("PUT", draft, "save");
    if (data) setNotice(data.unpublished ? "Saved. Unpublished on every language until it is published again." : "Saved.");
  }

  async function publish() {
    const data = await call("POST", { action: "approve", expected: { author: saved!.author, role: saved!.role, quote: saved!.quote } }, "publish");
    if (data) setNotice("Published on the FR, EN and AR homepages.");
  }

  async function hide() {
    if (!confirm("Hide this testimonial from the website (all languages)? The text is kept.")) return;
    const data = await call("POST", { action: "revoke" }, "publish");
    if (data) setNotice("Hidden from the website.");
  }

  return (
    <Shell>
      <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)] -mt-1 mb-5">
        One testimonial per project, shown exactly as written on the French, English and Arabic homepages (nothing is
        translated), and only for Client projects. Editing a published quote, role or author unpublishes it until it is
        published again.
      </p>

      <div className={`rounded-lg border p-4 ${published ? "border-emerald-200 os-dark:border-emerald-500/30 bg-emerald-50/30 os-dark:bg-emerald-500/10" : "border-[var(--os-border)]"}`} data-testimonial>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-[13px] font-semibold text-[#111827] os-dark:text-[var(--os-text)]">Testimonial · all languages</h3>
          <StatusBadge published={published} dirty={dirty} empty={empty} approvedAt={saved.approvedAt} approvedBy={saved.approvedBy} />
        </div>

        <div className="space-y-3">
          <div>
            <label className={lbl} htmlFor="tst-quote">Quote</label>
            <textarea
              id="tst-quote" dir="auto" className={textarea} rows={4} value={draft.quote} maxLength={TESTIMONIAL_LIMITS.quote}
              onChange={(e) => edit("quote", e.target.value)}
              placeholder="The client's words only, verbatim (no name or role here)."
            />
            <p className={hint}>{draft.quote.trim().length}/{TESTIMONIAL_LIMITS.quote}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl} htmlFor="tst-author">Author</label>
              <input
                id="tst-author" dir="auto" className={input} value={draft.author} maxLength={TESTIMONIAL_LIMITS.author}
                onKeyDown={noEnter} onChange={(e) => edit("author", e.target.value)}
                placeholder="Full name, exactly as the client approved it"
              />
            </div>
            <div>
              <label className={lbl} htmlFor="tst-role">Author&apos;s role</label>
              <input
                id="tst-role" dir="auto" className={input} value={draft.role} maxLength={TESTIMONIAL_LIMITS.role}
                onKeyDown={noEnter} onChange={(e) => edit("role", e.target.value)}
                placeholder="e.g. Founder"
              />
            </div>
          </div>
          <div>
            <label className={lbl} htmlFor="tst-consent">
              Consent reference <span className="font-normal text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">· private</span>
            </label>
            <input
              id="tst-consent" className={input} value={draft.consent} maxLength={TESTIMONIAL_LIMITS.consent}
              onKeyDown={noEnter} onChange={(e) => edit("consent", e.target.value)}
              placeholder="e.g. WhatsApp from the client, 24 Oct 2026"
            />
            <p className={hint}>Where the client&apos;s written permission is kept. Never shown on the website. Required to publish.</p>
          </div>
        </div>

        {willUnpublish && (
          <p className="mt-3 text-[12px] text-amber-800 os-dark:text-amber-300 bg-amber-50 os-dark:bg-amber-500/10 border border-amber-100 os-dark:border-amber-500/30 rounded-md px-3 py-2">
            Saving will unpublish this testimonial on every language until it is published again.
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-[#F3F4F6] os-dark:border-[var(--os-border)]">
          {published ? (
            <button
              type="button" onClick={hide} disabled={!!busy}
              className="inline-flex items-center gap-1.5 h-9 px-3 bg-[var(--os-surface)] border border-[#D1D5DB] os-dark:border-[var(--os-control-border)] rounded-lg text-[12px] font-medium text-[#374151] os-dark:text-[var(--os-text)] hover:bg-[#F9FAFB] os-dark:hover:bg-[var(--os-hover)] disabled:opacity-60"
            >
              {busy === "publish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />} Hide from website
            </button>
          ) : dirty ? (
            <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)]">Save the testimonial before publishing.</p>
          ) : problem ? (
            <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)]">Not publishable yet: {problem}</p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-[12px] text-[#374151] os-dark:text-[var(--os-text)] cursor-pointer">
                <input
                  type="checkbox" className="mt-0.5 w-4 h-4 accent-[#8B00FF]" checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>The client approved this exact quote, name and role for publication on the website, in every language.</span>
              </label>
              <button
                type="button" onClick={publish} disabled={!confirmed || !!busy}
                className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[12px] font-semibold disabled:opacity-50"
              >
                {busy === "publish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Publish
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          type="button" onClick={save} disabled={!dirty || !!busy}
          className="inline-flex items-center gap-2 h-10 px-4 bg-[var(--os-surface)] border border-[#D1D5DB] os-dark:border-[var(--os-control-border)] text-[#111827] os-dark:text-[var(--os-text)] rounded-lg text-[13px] font-semibold hover:bg-[#F9FAFB] os-dark:hover:bg-[var(--os-hover)] disabled:opacity-50"
        >
          {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save testimonial
        </button>
        {dirty && !busy && <span className="text-[12px] text-amber-700 os-dark:text-amber-300">Unsaved testimonial changes</span>}
        {notice && <span role="status" className="text-[12px] text-emerald-700 os-dark:text-emerald-300">{notice}</span>}
      </div>
      {error && <p role="alert" className="mt-3 text-[12px] text-red-700 os-dark:text-red-300 bg-red-50 os-dark:bg-red-500/10 border border-red-200 os-dark:border-red-500/30 rounded-md px-3 py-2">{error}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-[var(--os-surface)] border border-[var(--os-border)] rounded-xl p-6" aria-labelledby="tst-heading" data-testimonial-panel>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 flex items-center justify-center text-[#8B00FF] os-dark:text-[var(--os-purple)]">
          <MessageSquareQuote className="w-4 h-4" />
        </div>
        <h2 id="tst-heading" className="text-[15px] font-semibold text-[#111827] os-dark:text-[var(--os-text)]">Client testimonial</h2>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ published, dirty, empty, approvedAt, approvedBy }: { published: boolean; dirty: boolean; empty: boolean; approvedAt: string | null; approvedBy: string | null }) {
  if (published) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 os-dark:text-emerald-300 bg-emerald-50 os-dark:bg-emerald-500/10 border border-emerald-100 os-dark:border-emerald-500/30 px-2 py-0.5 rounded-full" title={approvedBy ? `Published by ${approvedBy}` : undefined}>
        <CheckCircle2 className="w-3 h-3" /> Published{approvedAt ? ` · ${formatDate(approvedAt)}` : ""}{approvedBy ? ` · ${approvedBy}` : ""}{dirty ? " · edited" : ""}
      </span>
    );
  }
  if (empty && !dirty) return <span className="text-[11px] font-medium text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">Not added</span>;
  return (
    <span className="text-[11px] font-semibold text-[#6B7280] os-dark:text-[var(--os-text)] bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] border border-[var(--os-border)] px-2 py-0.5 rounded-full">
      Draft · not public{dirty ? " · unsaved" : ""}
    </span>
  );
}
