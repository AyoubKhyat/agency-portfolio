"use client";

import { useState } from "react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { CHECK_TEXT, contactOpenUrl, type ContactChannel, type ContactCheckStatus } from "@/lib/contact-check";

type LastCheck = { userName: string; at: string } | null;

const BADGE: Record<ContactCheckStatus, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNAVAILABLE: "bg-red-50 text-red-600 border-red-200",
  UNVERIFIED: "bg-gray-50 text-gray-500 border-gray-200",
};

/**
 * One contact, checked by a person: open it, then say what you saw. Nothing is checked automatically.
 * `value` is the stored WhatsApp link or Instagram handle; a phone number alone is never turned into a link.
 */
export function ContactCheck({ channel, value, status, lastCheck, onSet }: {
  channel: ContactChannel;
  value: string;
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
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-[13px] font-medium text-gray-800">{label}</span>
        <span className="text-[13px] text-gray-500 break-all">{value || "—"}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${BADGE[current]}`}>{current} · {CHECK_TEXT[current]}</span>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        {lastCheck ? `Last checked by ${lastCheck.userName}, ${new Date(lastCheck.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : current === "UNVERIFIED" ? "No one has checked it yet." : "Who set this isn't in the recent activity (older change or a bulk cleanup)."}
      </p>
      {value && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {open ? (
            <a href={open} target="_blank" rel="noopener noreferrer nofollow" className="text-[12px] font-medium text-violet-600 hover:underline">
              Open link ↗
            </a>
          ) : (
            <span className="text-[12px] text-gray-400">No link to open</span>
          )}
          <button type="button" disabled={saving || current === "VERIFIED"} onClick={() => set("VERIFIED")}
            className="px-2.5 py-1 rounded-lg border border-emerald-200 text-[12px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">
            Opened, matches the business
          </button>
          <button type="button" disabled={saving || current === "UNAVAILABLE"} onClick={() => set("UNAVAILABLE")}
            className="px-2.5 py-1 rounded-lg border border-red-200 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-40">
            Opened, not usable
          </button>
          {current !== "UNVERIFIED" && (
            <button type="button" disabled={saving} onClick={() => set("UNVERIFIED")} className="text-[12px] text-gray-400 hover:text-gray-600 underline">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
