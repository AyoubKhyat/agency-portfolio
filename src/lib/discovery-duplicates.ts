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

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

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
  const candHost = hostOf(candidate.website);
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

  // Website host match (mid signal)
  if (candHost) {
    // we don't have website field on Prospect — skip
  }

  return { status: "NEW", matchedId: null, reason: null };
}
