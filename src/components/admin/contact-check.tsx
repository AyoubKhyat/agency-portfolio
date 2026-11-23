"use client";

import { useState } from "react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { CHECK_TEXT, contactOpenUrl, type ContactChannel, type ContactCheckStatus } from "@/lib/contact-check";
import { CONFIDENCE_TEXT, sourceText, type EvidenceItem, type WhatsAppConfidence } from "@/lib/contact-evidence";

type LastCheck = { userName: string; at: string } | null;
/** Public evidence saved when the prospect was imported from Today (null: none, e.g. another source). */
export type CheckEvidence = { items: EvidenceItem[]; otherValue: boolean; confidence?: WhatsAppConfidence; checkedAt?: string | null } | null;

/** "site.ma/contact": the page, short enough for a phone. */
const shortUrl = (url: string) => { try { const u = new URL(url); return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, ""); } catch { return url; } };

/** Where the contact was published, as saved at import. Information only: it is never a check. */
function EvidenceList({ channel, evidence }: { channel: ContactChannel; evidence: NonNullable<CheckEvidence> }) {
  const what = channel === "WHATSAPP" ? "number" : "account";
  if (evidence.otherValue) {
    return <p className="text-[11px] text-amber-700 os-dark:text-amber-300 mt-1">The public evidence saved at import was for a different {what}; it doesn&apos;t apply to the one saved now.</p>;
  }
  return (
    <div className="mt-1.5 rounded-lg bg-gray-50 os-dark:bg-[var(--os-surface-2)] px-2.5 py-1.5" data-evidence={channel}>
      <p className="text-[11px] font-medium text-gray-600 os-dark:text-[var(--os-text-muted)]">
        Public evidence{evidence.checkedAt ? `, seen ${new Date(evidence.checkedAt).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "Africa/Casablanca" })}` : ""} · not a check
      </p>
      <ul className="mt-0.5 space-y-0.5">
        {evidence.items.map((i) => (
          <li key={i.source + i.link + i.sourceUrl} className="text-[11px] text-gray-500 os-dark:text-[var(--os-text-soft)] break-all">
            {i.source === "OSM_TAG" ? "OpenStreetMap tag" : "Website"}:{" "}
            {i.sourceUrl
              ? <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-violet-600 os-dark:text-violet-400 hover:underline">{shortUrl(i.sourceUrl)}</a>
              : <span>{sourceText(i)}</span>}
          </li>
        ))}
      </ul>
      {channel === "WHATSAPP" && evidence.confidence && evidence.confidence !== "NONE" && (
        <p className={`text-[11px] mt-0.5 ${evidence.confidence === "CONFLICT" ? "text-red-600 os-dark:text-red-400" : "text-gray-500 os-dark:text-[var(--os-text-soft)]"}`}>
          Confidence {evidence.confidence}: {CONFIDENCE_TEXT[evidence.confidence]}
        </p>
      )}
    </div>
  );
}

const BADGE: Record<ContactCheckStatus, string> = {
  VERIFIED: "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border-emerald-200 os-dark:border-emerald-500/30",
  UNAVAILABLE: "bg-red-50 os-dark:bg-red-500/10 text-red-600 os-dark:text-red-400 border-red-200 os-dark:border-red-500/30",
  UNVERIFIED: "bg-gray-50 os-dark:bg-[var(--os-surface-2)] text-gray-500 os-dark:text-[var(--os-text-soft)] border-gray-200 os-dark:border-[var(--os-border)]",
};

/**
 * One contact, checked by a person: open it, then say what you saw. Nothing is checked automatically.
 * `value` is the stored WhatsApp link or Instagram handle; a phone number alone is never turned into a link.
 */
export function ContactCheck({ channel, value, phone = "", status, lastCheck, onSet, evidence = null }: {
  channel: ContactChannel;
  /** Where this contact was published, saved at import (Today leads). Shown, never used as a check. */
  evidence?: CheckEvidence;
  value: string;
  /** WhatsApp only: the saved phone, shown (never linked) when no WhatsApp link is saved. */
  phone?: string;
  status: string;
  lastCheck: LastCheck;
  onSet: (next: ContactCheckStatus) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const current: ContactCheckStatus = status === "VERIFIED" || status === "UNAVAILABLE" ? status : "UNVERIFIED";
  const open = value ? contactOpenUrl(channel, value) : null;
  const Icon = channel === "WHATSAPP" ? FaWhatsapp : FaInstagram;
  const label = channel === "WHATSAPP" ? "WhatsApp" : "Instagram";

  async function set(next: ContactCheckStatus) {
    setSaving(true);
    try { await onSet(next); } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-gray-100 os-dark:border-[var(--os-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500 os-dark:text-[var(--os-text-soft)]" />
        <span className="text-[13px] font-medium text-gray-800 os-dark:text-[var(--os-text)]">{label}</span>
        <span className="text-[13px] text-gray-500 os-dark:text-[var(--os-text-soft)] break-all">{value || phone || "—"}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${BADGE[current]}`}>{current} · {CHECK_TEXT[current]}</span>
      </div>
      <p className="text-[11px] text-gray-400 os-dark:text-[var(--os-text-faint)] mt-1">
        {lastCheck ? `Last checked by ${lastCheck.userName}, ${new Date(lastCheck.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : current === "UNVERIFIED" ? "No one has checked it yet." : "Who set this isn't in the recent activity (older change or a bulk cleanup)."}
      </p>
      {evidence && (evidence.otherValue || evidence.items.length > 0) && <EvidenceList channel={channel} evidence={evidence} />}
      {(value || phone) && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {open ? (
            <a href={open} target="_blank" rel="noopener noreferrer nofollow" className="text-[12px] font-medium text-violet-600 os-dark:text-violet-400 hover:underline">
              Open link ↗
            </a>
          ) : (
            <span className="text-[12px] text-gray-400 os-dark:text-[var(--os-text-faint)]">{value ? "No link to open" : "No WhatsApp link saved: look the number up in WhatsApp yourself"}</span>
          )}
          <button type="button" disabled={saving || current === "VERIFIED"} onClick={() => set("VERIFIED")}
            className="px-2.5 py-1 rounded-lg border border-emerald-200 os-dark:border-emerald-500/30 text-[12px] text-emerald-700 os-dark:text-emerald-300 hover:bg-emerald-50 os-dark:hover:bg-emerald-500/10 disabled:opacity-40">
            Opened, matches the business
          </button>
          <button type="button" disabled={saving || current === "UNAVAILABLE"} onClick={() => set("UNAVAILABLE")}
            className="px-2.5 py-1 rounded-lg border border-red-200 os-dark:border-red-500/30 text-[12px] text-red-600 os-dark:text-red-400 hover:bg-red-50 os-dark:hover:bg-red-500/10 disabled:opacity-40">
            Opened, not usable
          </button>
          {current !== "UNVERIFIED" && (
            <button type="button" disabled={saving} onClick={() => set("UNVERIFIED")} className="text-[12px] text-gray-400 os-dark:text-[var(--os-text-faint)] hover:text-gray-600 os-dark:hover:text-[var(--os-text-muted)] underline">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
