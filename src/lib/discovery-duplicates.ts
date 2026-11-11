/**
 * Duplicate detection for discovery candidates against existing prospects.
 *
 * EXISTS — exact match on a strong signal (phone, instagram handle, website host, name+city)
 * POSSIBLE — fuzzy match on name within the same city
 * NEW — no match
 */

import type { DiscoveryCandidate } from "./discovery-providers";

export type DuplicateStatus = "EXISTS" | "POSSIBLE" | "NEW";

export type ExistingProspectLite = {
  id: string;
  name: string;
  phone: string;
  instagram: string;
  whatsappLink: string;
  neighborhood: string;
  sector: string;
  /** Optional so older callers still type-check; the import route always loads them. */
  website?: string | null;
  email?: string | null;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function phoneDigits(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : null; // last 9 digits — fine for MA numbers
}

/** Sites many businesses share: there the first path segment is the business (facebook.com/riad-x). */
const SHARED_HOSTS = new Set([
  "facebook.com", "m.facebook.com", "fb.com", "instagram.com", "linktr.ee", "wa.me", "api.whatsapp.com",
  "google.com", "maps.google.com", "goo.gl", "sites.google.com", "youtube.com", "tiktok.com", "linkedin.com",
  "tripadvisor.com", "tripadvisor.fr", "booking.com", "airbnb.com",
]);

/**
 * The business's own site: a normalized domain (no www, lower case). On a shared platform, the domain and the
 * first path segment, so two different Facebook pages never count as one business. Null when there's no site.
 */
export function siteKey(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!host.includes(".")) return null;
    if (!SHARED_HOSTS.has(host)) return host;
    const first = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return first ? `${host}/${first}` : null;
  } catch {
    return null;
  }
}

const emailKey = (s: string | null | undefined) => {
  const e = (s ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};

function instagramHandle(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/instagram\.com\/([^/?#]+)/i) || s.match(/^@?([a-zA-Z0-9._]+)$/);
  return m ? m[1].toLowerCase() : null;
}

export function classify(
  candidate: DiscoveryCandidate,
  existing: ExistingProspectLite[]
): { status: DuplicateStatus; matchedId: string | null; reason: string | null } {
  const candPhone = phoneDigits(candidate.phone);
  const candIg = instagramHandle(candidate.instagram);
  const candSite = siteKey(candidate.website);
  const candEmail = emailKey(candidate.email);
  const candName = normalize(candidate.name);

  for (const p of existing) {
    // Strong signal: phone match
    if (candPhone) {
      const eph = phoneDigits(p.phone) || phoneDigits(p.whatsappLink);
      if (eph && eph === candPhone) {
        return { status: "EXISTS", matchedId: p.id, reason: "Same phone number" };
      }
    }
    // Strong signal: instagram match
    if (candIg && p.instagram) {
      const eIg = instagramHandle(p.instagram);
      if (eIg && eIg === candIg) {
        return { status: "EXISTS", matchedId: p.id, reason: "Same Instagram handle" };
      }
    }
    // Strong signal: the same website (normalized domain)
    if (candSite && siteKey(p.website) === candSite) {
      return { status: "EXISTS", matchedId: p.id, reason: "Same website domain" };
    }

    // Strong signal: the same email address
    if (candEmail && emailKey(p.email) === candEmail) {
      return { status: "EXISTS", matchedId: p.id, reason: "Same email address" };
    }

    // Strong signal: exact business name match
    if (candName && normalize(p.name) === candName) {
      return { status: "EXISTS", matchedId: p.id, reason: "Same business name" };
    }
  }

  // Fuzzy: name contains / contained-in another, OR Levenshtein-like
  // Cheap heuristic: shared significant word + same sector
  const candTokens = new Set(candName.split(" ").filter((t) => t.length >= 4));
  if (candTokens.size > 0) {
    for (const p of existing) {
      const pTokens = new Set(normalize(p.name).split(" ").filter((t) => t.length >= 4));
      const overlap = [...candTokens].filter((t) => pTokens.has(t));
      if (overlap.length > 0 && p.sector === candidate.sector) {
        return { status: "POSSIBLE", matchedId: p.id, reason: `Similar name + same sector` };
      }
    }
  }

  return { status: "NEW", matchedId: null, reason: null };
}
