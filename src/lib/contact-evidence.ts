/**
 * Public contact evidence of a Daily Lead Agent lead, kept when the lead becomes a prospect.
 *
 * Only what the run saved: explicit links found on the business's own site or tagged in OpenStreetMap, each with
 * the page or OSM object it came from. Nothing here is verified, opened, inferred or completed: a person still
 * opens each WhatsApp or Instagram contact on the prospect page and records VERIFIED or UNAVAILABLE. No phone
 * numbers are collected. Values came from websites, so everything is cleaned and capped before it is written.
 *
 * Pure and client-safe (no database, no server imports).
 */
import { explicitWhatsAppLink } from "@/lib/contact-check";

export type EvidenceChannel = "WHATSAPP" | "INSTAGRAM" | "EMAIL" | "FACEBOOK";
export type EvidenceItem = {
  channel: EvidenceChannel;
  /** "+212 6…", "@handle" or the e-mail address when the link shows it; "" otherwise. */
  value: string;
  link: string;
  source: "OSM_TAG" | "WEBSITE";
  /** The page or OSM object it was found on; "" when the run didn't record one (older leads). */
  sourceUrl: string;
};
export type WhatsAppConfidence = "HIGH" | "MEDIUM" | "CONFLICT" | "NONE";
export type ContactEvidence = { checkedAt: string | null; whatsappConfidence: WhatsAppConfidence; items: EvidenceItem[] };

/** The lead fields this module reads; anything may be missing on leads saved by older runs. */
export type EvidenceLead = {
  contacts?: readonly Partial<{ channel: string; value: string; link: string; source: string; sourceUrl: string }>[] | null;
  whatsappConfidence?: string | null;
  checkedAt?: string | null;
};

export const MAX_EVIDENCE_ITEMS = 12;
const CHANNELS: readonly EvidenceChannel[] = ["WHATSAPP", "INSTAGRAM", "EMAIL", "FACEBOOK"];
const CONFIDENCE: readonly WhatsAppConfidence[] = ["HIGH", "MEDIUM", "CONFLICT", "NONE"];
const LABEL: Record<EvidenceChannel, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", EMAIL: "E-mail", FACEBOOK: "Facebook" };

/** Control characters, including the Unicode line and paragraph separators. */
const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029]+", "g");

/** One line of plain text: control characters and line breaks removed, trimmed, capped. */
function clean(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.replace(CONTROL, " ").trim().slice(0, max) : "";
}

/** An https/http address without credentials, or "". */
function webUrl(raw: unknown): string {
  const s = clean(raw, 500);
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password ? s : "";
  } catch {
    return "";
  }
}

/** The link a contact may keep: web links for social channels, mailto: for e-mail, an explicit wa.me link for WhatsApp. */
function contactLink(channel: EvidenceChannel, raw: unknown): string {
  if (channel === "WHATSAPP") return explicitWhatsAppLink(clean(raw, 300));
  if (channel === "EMAIL") {
    const s = clean(raw, 300);
    return /^mailto:[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/i.test(s) ? s : "";
  }
  return webUrl(raw);
}

/** The saved lead's contacts as evidence, cleaned; invalid entries are dropped, never repaired or guessed. */
export function evidenceOf(lead: EvidenceLead | null | undefined): ContactEvidence {
  const items: EvidenceItem[] = [];
  for (const c of lead?.contacts ?? []) {
    const channel = CHANNELS.find((k) => k === c?.channel);
    if (!channel) continue;
    const link = contactLink(channel, c.link);
    if (!link) continue;
    const source = c.source === "OSM_TAG" ? "OSM_TAG" : c.source === "WEBSITE" ? "WEBSITE" : null;
    if (!source) continue;
    if (items.some((x) => x.channel === channel && x.link === link && x.source === source)) continue;
    items.push({ channel, value: clean(c.value, 120), link, source, sourceUrl: webUrl(c.sourceUrl) });
    if (items.length >= MAX_EVIDENCE_ITEMS) break;
  }
  const conf = CONFIDENCE.find((k) => k === lead?.whatsappConfidence) ?? "NONE";
  const checkedAt = clean(lead?.checkedAt, 40);
  return { checkedAt: checkedAt && !Number.isNaN(Date.parse(checkedAt)) ? checkedAt : null, whatsappConfidence: conf, items };
}

const digits = (s: string) => s.replace(/\D/g, "");
/** An Instagram handle from a profile link or a saved handle, lower case, without "@"; "" when none. */
export function instagramHandle(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  let h = s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://instagram.com/${s.replace(/^@/, "")}`);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return "";
    h = u.pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
  h = h.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : "";
}

/**
 * The evidence for the contact a prospect has saved now. Evidence belongs to the exact number or account it was
 * found for: after an edit to another number or handle, it no longer applies (`otherValue` says so).
 */
export function evidenceForSaved(evidence: ContactEvidence | null | undefined, channel: "WHATSAPP" | "INSTAGRAM", saved: string | null | undefined): { items: EvidenceItem[]; otherValue: boolean } {
  const all = (evidence?.items ?? []).filter((i) => i.channel === channel);
  if (all.length === 0) return { items: [], otherValue: false };
  const key = channel === "WHATSAPP" ? digits(explicitWhatsAppLink(saved ?? "")) : instagramHandle(saved);
  const match = (i: EvidenceItem) => (channel === "WHATSAPP" ? digits(i.link) : instagramHandle(i.link));
  const items = key ? all.filter((i) => match(i) === key) : [];
  return { items, otherValue: items.length === 0 };
}

/** WhatsApp and Instagram contacts saved on a prospect that no one has checked yet (e-mail has no check). */
export function contactsToCheck(p: { whatsappLink?: string | null; whatsappStatus?: string | null; instagram?: string | null; instagramStatus?: string | null }): number {
  const unchecked = (s: string | null | undefined) => s !== "VERIFIED" && s !== "UNAVAILABLE";
  return (p.whatsappLink && unchecked(p.whatsappStatus) ? 1 : 0) + (p.instagram && unchecked(p.instagramStatus) ? 1 : 0);
}

export const sourceText = (i: Pick<EvidenceItem, "source" | "sourceUrl">) =>
  i.source === "OSM_TAG" ? `from the OpenStreetMap tag${i.sourceUrl ? ` (${i.sourceUrl})` : ""}` : i.sourceUrl ? `found on ${i.sourceUrl}` : "found on the website (page not recorded)";

export const CONFIDENCE_TEXT: Record<WhatsAppConfidence, string> = {
  HIGH: "the same number in OpenStreetMap and on the website",
  MEDIUM: "one source only",
  CONFLICT: "different numbers in different places: check which is current",
  NONE: "no WhatsApp link found",
};

const casablancaDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** The dated CRM note for a lead's public contact evidence. Always a note: "nothing found" is worth keeping too. */
export function buildContactEvidenceNote(lead: EvidenceLead | null | undefined, now = new Date()): string {
  const ev = evidenceOf(lead);
  const day = casablancaDay(ev.checkedAt ?? now.toISOString());
  const lines = [`Public contact evidence from the Daily Lead Agent, dated ${day} (Casablanca). Nothing here was opened or verified: check each contact on this page before using it.`];
  for (const i of ev.items) lines.push(`• ${LABEL[i.channel]}${i.value ? ` ${i.value}` : ""}: ${i.link}, ${sourceText(i)}`);
  const wa = ev.items.filter((i) => i.channel === "WHATSAPP");
  if (wa.length > 0) {
    const numbers = [...new Set(wa.map((i) => `+${digits(i.link)}`))];
    lines.push(`• WhatsApp confidence: ${ev.whatsappConfidence}, ${CONFIDENCE_TEXT[ev.whatsappConfidence]}${numbers.length > 1 ? ` (${numbers.join(", ")})` : ""}.`);
  }
  const missing = (["WHATSAPP", "INSTAGRAM", "EMAIL"] as const).filter((k) => !ev.items.some((i) => i.channel === k)).map((k) => LABEL[k]);
  if (missing.length === 3) lines.push("No public WhatsApp, Instagram or e-mail link was found on the website or in OpenStreetMap.");
  else if (missing.length > 0) lines.push(`Not found: ${missing.join(", ")}.`);
  return lines.join("\n");
}
