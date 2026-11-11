"use client";

import { useState } from "react";
import { analyzeMessage, hasBlockingError } from "@/lib/message-quality";
import { whatsappUrl, instagramUrl, type SendChannel } from "@/lib/next-action";
import { recordConfirmedSend, browserToday } from "@/lib/lead-actions";
import type { DraftLanguage, DraftResult } from "@/lib/prospect-outreach-draft";

type Prospect = { id: string; name: string; sector: string; neighborhood: string; instagram: string; whatsappLink: string; phone: string };
type Ok = Extract<DraftResult, { ok: true }>;

const LANGS: [DraftLanguage, string][] = [["fr", "FR"], ["en", "EN"], ["ar", "AR"]];

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * A first message written by code from a fresh check of the prospect's website. Nothing is sent from here:
 * the person opens WhatsApp or Instagram, sends it themselves, then says so, which records it as before.
 */
export function OutreachDraftPanel({ prospect, onRecorded }: { prospect: Prospect; onRecorded: () => void }) {
  const [language, setLanguage] = useState<DraftLanguage>("fr");
  const [channel, setChannel] = useState<SendChannel | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Ok | null>(null);
  const [body, setBody] = useState("");
  const [problem, setProblem] = useState<string[] | null>(null);
  const [opened, setOpened] = useState<SendChannel | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function makeDraft(nextChannel = channel) {
    setBusy(true); setProblem(null); setDraft(null); setOpened(null); setSaveError(null);
    try {
      const res = await fetch(`/api/admin/prospecting/${prospect.id}/outreach-draft`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextChannel ? { language, channel: nextChannel } : { language }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) { setDraft(data); setBody(data.body); setChannel(data.channel); }
      else if (data?.blockers) setProblem(data.blockers.map((b: { message: string }) => b.message));
      else setProblem([data?.error ?? "The draft failed. Try again."]);
    } finally {
      setBusy(false);
    }
  }

  const warnings = analyzeMessage(body, { name: prospect.name, sector: prospect.sector, neighborhood: prospect.neighborhood, instagram: prospect.instagram });
  const blocked = !body.trim() || hasBlockingError(warnings);

  /** Opens the app with the text ready. The person still presses send there; nothing is recorded yet. */
  function openChannel() {
    if (!draft || blocked) return;
    navigator.clipboard.writeText(body).catch(() => {});
    const url = draft.channel === "WHATSAPP" ? whatsappUrl(prospect, body) : instagramUrl(prospect.instagram);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setOpened(draft.channel);
  }

  async function confirmSent() {
    if (!opened) return;
    const result = await recordConfirmedSend(fetch.bind(window), { kind: "first", prospectId: prospect.id, channel: opened, body, today: browserToday() });
    if (!result.ok && !result.recorded) { setSaveError(result.error); return; }
    if (!result.ok) alert(result.error);
    setDraft(null); setOpened(null); setSaveError(null);
    onRecorded();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-[13px] font-semibold text-gray-800 mr-auto">First message from the website check</p>
        {LANGS.map(([code, label]) => (
          <button key={code} type="button" onClick={() => setLanguage(code)} aria-pressed={language === code}
            className={`px-2 py-1 rounded-lg text-[12px] border ${language === code ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500"}`}>
            {label}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => makeDraft()}
          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-medium disabled:opacity-50">
          {busy ? "Checking the website…" : draft ? "Check again" : "Draft from website"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Written by code from what the check found, no AI. Only for a first message, to a contact a person marked VERIFIED. Nothing is sent from here.
      </p>

      {problem && (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 space-y-1">
          {problem.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}

      {draft && (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">What the message says, and the proof</p>
            <ul className="space-y-1.5">
              {draft.findings.map((f) => (
                <li key={f.id} className="text-[12px] text-gray-600">
                  <span className="text-gray-800">{f.check}</span>: seen &quot;{f.observed}&quot;
                  <span className="block text-[11px] text-gray-400 break-all">Source: {f.sourceUrl} · <span className="whitespace-nowrap">read {when(f.fetchedAt)}</span></span>
                </li>
              ))}
            </ul>
          </div>

          {draft.channels.length > 1 && (
            <div className="flex gap-2 text-[12px]">
              {draft.channels.map((c) => (
                <button key={c} type="button" onClick={() => { setChannel(c); setDraft({ ...draft, channel: c }); setOpened(null); }} aria-pressed={draft.channel === c}
                  className={`px-2 py-1 rounded-lg border ${draft.channel === c ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500"}`}>
                  {c === "WHATSAPP" ? "WhatsApp" : "Instagram"} (verified)
                </button>
              ))}
            </div>
          )}

          <textarea value={body} onChange={(e) => { setBody(e.target.value); setOpened(null); }} rows={9} dir={draft.language === "ar" ? "rtl" : "ltr"}
            aria-label="Message draft" className="w-full rounded-xl border border-gray-200 p-3 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20" />

          {warnings.length > 0 && (
            <ul className="space-y-1">
              {warnings.map((w) => (
                <li key={w.kind} className={`text-[12px] ${w.severity === "error" ? "text-red-600" : "text-amber-700"}`}>
                  {w.label}{w.detail ? `: ${w.detail}` : ""}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={blocked} onClick={openChannel}
              className="px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 text-[12px] font-medium hover:bg-violet-50 disabled:opacity-40">
              Copy and open {draft.channel === "WHATSAPP" ? "WhatsApp" : "Instagram"}
            </button>
            {opened && (
              <>
                <span className="text-[12px] text-gray-600">Did you send it?</span>
                <button type="button" onClick={confirmSent} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-medium">Yes, sent</button>
                <button type="button" onClick={() => setOpened(null)} className="text-[12px] text-gray-500 underline">Not sent</button>
              </>
            )}
          </div>
          {saveError && <p className="text-[12px] text-red-600">{saveError}</p>}
        </div>
      )}
    </div>
  );
}
