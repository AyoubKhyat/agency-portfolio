"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, EyeOff, Loader2, MessageSquareQuote, ShieldCheck } from "lucide-react";
import {
  TESTIMONIAL_LIMITS,
  TESTIMONIAL_LOCALES,
  approvalProblem,
  type TestimonialLocale,
  type TestimonialState,
} from "@/lib/testimonial-approval";

const LOCALE_LABELS: Record<TestimonialLocale, string> = { fr: "Français", en: "English", ar: "العربية" };

type ApiLocale = { quote: string; role: string; approvedAt: string | null; approvedBy: string | null };
export type TestimonialApiState = {
  author: string;
  consent: string;
  kind: string;
  locales: Partial<Record<TestimonialLocale, ApiLocale>>;
  revoked?: string[];
};
type Draft = { author: string; consent: string; locales: Partial<Record<TestimonialLocale, { quote: string; role: string }>> };

const input =
  "w-full h-11 px-3.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const textarea =
  "w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const lbl = "block text-[13px] font-medium text-[#374151] mb-1.5";
const hint = "text-[11px] text-[#9CA3AF] mt-1";

const draftOf = (s: TestimonialApiState): Draft => ({
  author: s.author,
  consent: s.consent,
  locales: Object.fromEntries(Object.entries(s.locales).map(([l, v]) => [l, { quote: v.quote, role: v.role }])),
});

/** The saved state in the shape lib/testimonial-approval checks (approval needs saved values). */
const asState = (s: TestimonialApiState): TestimonialState => ({
  projectId: "",
  kind: s.kind,
  author: s.author,
  consent: s.consent,
  locales: Object.fromEntries(
    Object.entries(s.locales).map(([l, v]) => [l, { quote: v.quote, role: v.role, approvedAt: v.approvedAt ? new Date(v.approvedAt) : null, approvedBy: v.approvedBy }]),
  ),
});

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// Enter in a single-line field must not submit the surrounding project form.
const noEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") e.preventDefault(); };

/**
 * The project's client testimonial, saved and published separately from the project form
 * (rules: lib/testimonial-approval). Each language is published on its own, by an admin,
 * for the exact saved text; editing it unpublishes it. Nothing is copied between languages.
 */
export default function TestimonialPanel({ projectId, initial }: { projectId?: string; initial?: TestimonialApiState }) {
  const [saved, setSaved] = useState<TestimonialApiState | null>(initial ?? null);
  const [draft, setDraft] = useState<Draft | null>(initial ? draftOf(initial) : null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | TestimonialLocale>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState<Partial<Record<TestimonialLocale, boolean>>>({});

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
    return <Shell><p className="text-[13px] text-[#6B7280]">Save the project first, then add the client&apos;s testimonial here.</p></Shell>;
  }
  if (loadError) return <Shell><p role="alert" className="text-[13px] text-red-700">{loadError}</p></Shell>;
  if (!saved || !draft) {
    return <Shell><Loader2 className="w-4 h-4 animate-spin text-[#8B00FF]" /></Shell>;
  }

  const savedState = asState(saved);
  const localeDirty = (l: TestimonialLocale) => {
    const d = draft.locales[l], s = saved.locales[l];
    return !!d && !!s && (d.quote.trim() !== s.quote || d.role.trim() !== s.role);
  };
  const authorDirty = draft.author.trim() !== saved.author;
  const consentDirty = draft.consent.trim() !== saved.consent;
  const dirty = authorDirty || consentDirty || TESTIMONIAL_LOCALES.some(localeDirty);
  const consentRemoved = saved.consent.trim() !== "" && draft.consent.trim() === "";
  const willUnpublish = (l: TestimonialLocale) => !!saved.locales[l]?.approvedAt && (localeDirty(l) || authorDirty || consentRemoved);

  function setLocale(l: TestimonialLocale, field: "quote" | "role", value: string) {
    setDraft((d) => d && ({ ...d, locales: { ...d.locales, [l]: { ...(d.locales[l] ?? { quote: "", role: "" }), [field]: value } } }));
    setConfirmed((c) => ({ ...c, [l]: false }));
    setNotice("");
  }

  async function call(method: "PUT" | "POST", body: unknown, what: "save" | TestimonialLocale) {
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
      setConfirmed({});
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
    if (!data) return;
    const revoked = (data.revoked ?? []).map((l) => l.toUpperCase());
    setNotice(revoked.length ? `Saved. Unpublished until approved again: ${revoked.join(", ")}.` : "Saved.");
  }

  async function approve(l: TestimonialLocale) {
    const s = saved!.locales[l]!;
    const data = await call("POST", { action: "approve", locale: l, expected: { author: saved!.author, role: s.role, quote: s.quote } }, l);
    if (data) setNotice(`${LOCALE_LABELS[l]}: published on the homepage.`);
  }

  async function revoke(l: TestimonialLocale) {
    if (!confirm(`Hide the ${LOCALE_LABELS[l]} testimonial from the website? The text is kept.`)) return;
    const data = await call("POST", { action: "revoke", locale: l }, l);
    if (data) setNotice(`${LOCALE_LABELS[l]}: hidden from the website.`);
  }

  return (
    <Shell>
      <p className="text-[12px] text-[#6B7280] -mt-1 mb-5">
        Shown on the homepage only in the languages an admin publishes, and only for Client projects. Nothing is
        translated or copied between languages. Editing a published quote, role or author unpublishes it until it is
        approved again.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl} htmlFor="tst-author">Author</label>
          <input
            id="tst-author" className={input} value={draft.author} maxLength={TESTIMONIAL_LIMITS.author}
            onKeyDown={noEnter} onChange={(e) => { setDraft({ ...draft, author: e.target.value }); setConfirmed({}); setNotice(""); }}
            placeholder="Full name, exactly as the client approved it"
          />
          <p className={hint}>The same in every language.</p>
        </div>
        <div>
          <label className={lbl} htmlFor="tst-consent">
            Consent reference <span className="font-normal text-[#9CA3AF]">· private</span>
          </label>
          <input
            id="tst-consent" className={input} value={draft.consent} maxLength={TESTIMONIAL_LIMITS.consent}
            onKeyDown={noEnter} onChange={(e) => { setDraft({ ...draft, consent: e.target.value }); setNotice(""); }}
            placeholder="e.g. WhatsApp from the client, 24 Oct 2026"
          />
          <p className={hint}>Where the client&apos;s written permission is kept. Never shown on the website.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {TESTIMONIAL_LOCALES.map((l) => {
          const s = saved.locales[l];
          const d = draft.locales[l];
          const rtl = l === "ar";
          if (!s || !d) {
            return (
              <div key={l} className="rounded-lg border border-dashed border-[#E5E7EB] p-4 text-[12px] text-[#6B7280]">
                {LOCALE_LABELS[l]}: save the project in this language first.
              </div>
            );
          }
          const published = !!s.approvedAt;
          const ldirty = localeDirty(l) || authorDirty;
          const problem = approvalProblem(savedState, l, { author: saved.author, role: s.role, quote: s.quote });
          return (
            <div key={l} className={`rounded-lg border p-4 ${published ? "border-emerald-200 bg-emerald-50/30" : "border-[#E5E7EB]"}`} data-locale={l}>
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h3 className="text-[13px] font-semibold text-[#111827]">{LOCALE_LABELS[l]}</h3>
                <StatusBadge published={published} dirty={localeDirty(l)} empty={!s.quote.trim() && !s.role.trim()} approvedAt={s.approvedAt} approvedBy={s.approvedBy} />
              </div>
              <div className="space-y-3" dir={rtl ? "rtl" : "ltr"}>
                <div>
                  <label className={lbl} htmlFor={`tst-quote-${l}`}>Quote</label>
                  <textarea
                    id={`tst-quote-${l}`} className={textarea} rows={3} value={d.quote} maxLength={TESTIMONIAL_LIMITS.quote}
                    onChange={(e) => setLocale(l, "quote", e.target.value)}
                    placeholder="The client's words only, verbatim (no name or role here)."
                  />
                  <p className={hint}>{d.quote.trim().length}/{TESTIMONIAL_LIMITS.quote}</p>
                </div>
                <div>
                  <label className={lbl} htmlFor={`tst-role-${l}`}>Author&apos;s role</label>
                  <input
                    id={`tst-role-${l}`} className={input} value={d.role} maxLength={TESTIMONIAL_LIMITS.role}
                    onKeyDown={noEnter} onChange={(e) => setLocale(l, "role", e.target.value)}
                    placeholder={rtl ? "مثلاً: مديرة" : "e.g. Founder"}
                  />
                </div>
              </div>

              {willUnpublish(l) && (
                <p className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  Saving will unpublish this language until it is approved again.
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                {published ? (
                  <button
                    type="button" onClick={() => revoke(l)} disabled={!!busy}
                    className="inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
                  >
                    {busy === l ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />} Hide from website
                  </button>
                ) : ldirty ? (
                  <p className="text-[12px] text-[#6B7280]">Save the testimonial before publishing.</p>
                ) : problem ? (
                  <p className="text-[12px] text-[#6B7280]">Not publishable yet: {problem}</p>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 text-[12px] text-[#374151] cursor-pointer">
                      <input
                        type="checkbox" className="mt-0.5 w-4 h-4 accent-[#8B00FF]" checked={!!confirmed[l]}
                        onChange={(e) => setConfirmed({ ...confirmed, [l]: e.target.checked })}
                      />
                      <span>The client approved this exact quote, name and role for publication in {LOCALE_LABELS[l]}.</span>
                    </label>
                    <button
                      type="button" onClick={() => approve(l)} disabled={!confirmed[l] || !!busy}
                      className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[12px] font-semibold disabled:opacity-50"
                    >
                      {busy === l ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Publish {l.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          type="button" onClick={save} disabled={!dirty || !!busy}
          className="inline-flex items-center gap-2 h-10 px-4 bg-white border border-[#D1D5DB] text-[#111827] rounded-lg text-[13px] font-semibold hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save testimonial
        </button>
        {dirty && !busy && <span className="text-[12px] text-amber-700">Unsaved testimonial changes</span>}
        {notice && <span role="status" className="text-[12px] text-emerald-700">{notice}</span>}
      </div>
      {error && <p role="alert" className="mt-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-xl p-6" aria-labelledby="tst-heading" data-testimonial-panel>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 flex items-center justify-center text-[#8B00FF]">
          <MessageSquareQuote className="w-4 h-4" />
        </div>
        <h2 id="tst-heading" className="text-[15px] font-semibold text-[#111827]">Client testimonial</h2>
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ published, dirty, empty, approvedAt, approvedBy }: { published: boolean; dirty: boolean; empty: boolean; approvedAt: string | null; approvedBy: string | null }) {
  if (published) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full" title={approvedBy ? `Approved by ${approvedBy}` : undefined}>
        <CheckCircle2 className="w-3 h-3" /> Published{approvedAt ? ` · ${formatDate(approvedAt)}` : ""}{approvedBy ? ` · ${approvedBy}` : ""}{dirty ? " · edited" : ""}
      </span>
    );
  }
  if (empty && !dirty) return <span className="text-[11px] font-medium text-[#9CA3AF]">Not added</span>;
  return (
    <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] px-2 py-0.5 rounded-full">
      Draft · not public{dirty ? " · unsaved" : ""}
    </span>
  );
}
