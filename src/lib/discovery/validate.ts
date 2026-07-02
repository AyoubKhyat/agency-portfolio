/**
 * Validation + repair for AI Discovery candidates.
 *
 * Every field surfaced to the UI must be format-valid. This module:
 *   - Repairs where it can (normalize whitespace, add scheme, format phone,
 *     strip @ from IG handles, etc.)
 *   - Rejects where it can't (returns "" for invalid values).
 *   - Emits a per-field validity flag the UI uses to decide whether to render
 *     a click-through button. Broken/absent → no button, no broken link.
 *
 * Nothing here does network calls. Validation is format-only — verifying
 * that a Instagram account actually exists is out of scope for Phase 2.1
 * and belongs to a future "verify" pass.
 */

import type {
  DiscoveryCandidate, ContactVerification, VerificationStatus, VerifiedContact,
} from "./types";

export type FieldValidity = {
  website: boolean;
  email: boolean;
  phone: boolean;
  instagram: boolean;
  whatsapp: boolean;
  sourceUrl: boolean;
};

export type RepairedCandidate = DiscoveryCandidate & {
  whatsappUrl: string;
  instagramUrl: string;
  validity: FieldValidity;            // legacy booleans (back-compat)
  verification: ContactVerification;  // per-field verification status
};

/**
 * Format checks can only ever reach UNVERIFIED — they prove the value is
 * well-formed, never that it exists. Existence checks (later steps) upgrade to
 * VERIFIED or downgrade to UNAVAILABLE.
 */
function formatStatus(raw: string, valid: boolean): VerificationStatus {
  if (!(raw || "").trim()) return "MISSING";
  return valid ? "UNVERIFIED" : "INVALID";
}

function formatContact(value: string, status: VerificationStatus): VerifiedContact {
  return { value, status, method: status === "MISSING" ? null : "FORMAT", checkedAt: null };
}

/* ─────────────────────────── URL / domain ─────────────────────────── */

const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function repairWebsite(raw: string): { url: string; valid: boolean } {
  const v = (raw || "").trim();
  if (!v) return { url: "", valid: false };
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!DOMAIN_RE.test(host)) return { url: "", valid: false };
    if (host.split(".").pop()!.length < 2) return { url: "", valid: false };
    // Normalize: keep scheme, drop trailing slash unless there's a path.
    u.hostname = host;
    return { url: u.toString().replace(/\/$/, ""), valid: true };
  } catch {
    return { url: "", valid: false };
  }
}

/* ─────────────────────────── Email ─────────────────────────── */

// Practical RFC-lite: local@domain.tld, no leading/trailing dots, single @.
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function repairEmail(raw: string): { email: string; valid: boolean } {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return { email: "", valid: false };
  if (!EMAIL_RE.test(v)) return { email: "", valid: false };
  if (v.length > 254) return { email: "", valid: false };
  return { email: v, valid: true };
}

/* ─────────────────────────── Phone / WhatsApp ─────────────────────────── */

/**
 * Repair a phone into E.164 (`+<digits>`, 8–15 digits) and produce the
 * display form. Rules:
 *   - Any input with fewer than 8 digits after cleanup is invalid.
 *   - `00XX` prefix → `+XX`.
 *   - A leading `0` alone (national format) is only accepted when the country
 *     hint tells us which international prefix to add; otherwise invalid.
 *   - No plus, but starts with a plausible country-code digit sequence AND is
 *     10+ digits → accept as +digits.
 */
export function repairPhone(raw: string, countryHint?: string): { phone: string; e164: string; valid: boolean } {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (!cleaned) return { phone: "", e164: "", valid: false };

  let e164 = cleaned;
  if (e164.startsWith("00")) e164 = "+" + e164.slice(2);
  if (!e164.startsWith("+")) {
    // National format → need country hint to lift to international.
    if (e164.startsWith("0") && countryHint) {
      const cc = COUNTRY_DIALING[countryHint.toLowerCase()];
      if (cc) e164 = `+${cc}${e164.slice(1)}`;
      else return { phone: "", e164: "", valid: false };
    } else if (/^\d{10,15}$/.test(e164)) {
      e164 = `+${e164}`;
    } else {
      return { phone: "", e164: "", valid: false };
    }
  }

  const digits = e164.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return { phone: "", e164: "", valid: false };

  return { phone: displayPhone(e164), e164, valid: true };
}

const COUNTRY_DIALING: Record<string, string> = {
  france: "33",
  monaco: "377",
  morocco: "212",
  italy: "39",
  spain: "34",
  "united kingdom": "44",
  "united arab emirates": "971",
  switzerland: "41",
  belgium: "32",
  netherlands: "31",
};

/**
 * Best-effort display formatter — never fabricates digits, only inserts
 * separators. Good enough for UI. E.164 is the canonical stored form.
 */
function displayPhone(e164: string): string {
  const digits = e164.slice(1);
  if (digits.startsWith("33") && digits.length === 11) {
    // +33 X XX XX XX XX
    const d = digits.slice(2);
    return `+33 ${d.slice(0, 1)} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
  }
  if (digits.startsWith("212") && digits.length === 12) {
    // +212 X XX XX XX XX
    const d = digits.slice(3);
    return `+212 ${d.slice(0, 1)} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
  }
  if (digits.startsWith("377") && digits.length === 11) {
    const d = digits.slice(3);
    return `+377 ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)}`;
  }
  if (digits.startsWith("44") && digits.length >= 12) {
    const d = digits.slice(2);
    return `+44 ${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  }
  if (digits.startsWith("971") && digits.length >= 11) {
    const d = digits.slice(3);
    return `+971 ${d.slice(0, 1)} ${d.slice(1, 4)} ${d.slice(4)}`;
  }
  if (digits.startsWith("41") && digits.length >= 11) {
    const d = digits.slice(2);
    return `+41 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  }
  // Generic space grouping
  return `+${digits.replace(/(\d{2,3})(\d{2,3})(\d{2,3})(\d+)/, "$1 $2 $3 $4")}`;
}

/** wa.me links accept international digits without `+`. */
export function buildWhatsAppUrl(e164: string, preFill?: string): string {
  const digits = e164.replace(/\D/g, "");
  if (!digits) return "";
  const q = preFill ? `?text=${encodeURIComponent(preFill)}` : "";
  return `https://wa.me/${digits}${q}`;
}

/* ─────────────────────────── Instagram ─────────────────────────── */

// IG handle: 1–30 chars, letters/numbers/dots/underscores. No leading/trailing dot. No consecutive dots.
const IG_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/i;

export function repairInstagram(raw: string): { handle: string; url: string; valid: boolean } {
  let v = (raw || "").trim();
  if (!v) return { handle: "", url: "", valid: false };

  // Strip URL wrapping if present.
  v = v.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "");
  v = v.replace(/[/?#].*$/, "");
  v = v.replace(/^@/, "");

  if (!IG_RE.test(v)) return { handle: "", url: "", valid: false };

  return {
    handle: v.toLowerCase(),
    url: `https://instagram.com/${v.toLowerCase()}`,
    valid: true,
  };
}

/* ─────────────────────────── Source URL ─────────────────────────── */

export function repairSourceUrl(raw: string): { url: string; valid: boolean } {
  const v = (raw || "").trim();
  if (!v) return { url: "", valid: false };
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { url: "", valid: false };
    return { url: u.toString(), valid: true };
  } catch {
    return { url: "", valid: false };
  }
}

/* ─────────────────────────── Combined ─────────────────────────── */

export function validateAndRepair(candidate: DiscoveryCandidate): RepairedCandidate {
  const website = repairWebsite(candidate.website);
  const email = repairEmail(candidate.email);
  const phone = repairPhone(candidate.phone, candidate.country);
  const instagram = repairInstagram(candidate.instagram);
  const sourceUrl = repairSourceUrl(candidate.sourceUrl);
  const whatsappUrl = phone.valid ? buildWhatsAppUrl(phone.e164) : "";

  // WhatsApp is NEVER derived from the phone being format-valid. Having a phone
  // only makes WhatsApp UNVERIFIED (a candidate to check later); it is never
  // VERIFIED until a real check (or a manual confirmation) says so.
  const whatsappStatus: VerificationStatus = phone.valid ? "UNVERIFIED" : "MISSING";

  const verification: ContactVerification = {
    website: formatContact(website.url, formatStatus(candidate.website, website.valid)),
    email: formatContact(email.email, formatStatus(candidate.email, email.valid)),
    phone: formatContact(phone.phone, formatStatus(candidate.phone, phone.valid)),
    whatsapp: { value: whatsappUrl, status: whatsappStatus, method: null, checkedAt: null },
    instagram: formatContact(instagram.handle, formatStatus(candidate.instagram, instagram.valid)),
  };

  return {
    name: candidate.name.trim(),
    sector: candidate.sector.trim(),
    city: candidate.city.trim(),
    country: candidate.country.trim(),
    website: website.url,
    email: email.email,
    phone: phone.phone,
    instagram: instagram.handle,
    instagramUrl: instagram.url,
    whatsappUrl,
    sourceUrl: sourceUrl.url,
    validity: {
      website: website.valid,
      email: email.valid,
      phone: phone.valid,
      instagram: instagram.valid,
      // Stop deriving WhatsApp from phone — never auto-true anymore.
      whatsapp: false,
      sourceUrl: sourceUrl.valid,
    },
    verification,
  };
}

/**
 * Honesty-first: a named business is worth showing even with zero contact
 * channels — it's surfaced as a lead with unverified/missing contacts (clearly
 * marked in the UI), never dropped and never padded with invented data.
 * Contacts get discovered/verified later; absence is not disqualifying.
 */
export function isPublishable(r: RepairedCandidate): boolean {
  return Boolean(r.name);
}
