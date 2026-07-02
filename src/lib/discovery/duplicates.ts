/**
 * Duplicate detection for AI Discovery candidates against existing Prospects.
 *
 * Signals (strongest first):
 *  - website host match       → EXISTS
 *  - phone digits match       → EXISTS
 *  - email exact match        → EXISTS
 *  - normalized name equals   → EXISTS
 *  - normalized name contains → POSSIBLE
 *
 * A separate existing-prospect duplicate module lives at src/lib/discovery-duplicates.ts
 * for the legacy sector-based sweep. This one is scoped to the AI SDR pipeline
 * (Phase 2.1) and stays self-contained so it can evolve independently.
 */

import { prisma, hasPrisma } from "@/lib/prisma";
import type { DiscoveryCandidate, DiscoveryDuplicateMatch } from "./types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function phoneDigits(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : null;
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

type ProspectLite = {
  id: string;
  name: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
};

async function loadExisting(): Promise<ProspectLite[]> {
  if (!hasPrisma()) return [];
  return prisma.prospect.findMany({
    select: { id: true, name: true, phone: true, email: true, website: true, instagram: true },
    take: 5000,
  });
}

export async function detectDuplicate(candidate: DiscoveryCandidate): Promise<DiscoveryDuplicateMatch> {
  const existing = await loadExisting();
  return classify(candidate, existing);
}

/** Batch variant — one DB round-trip for a whole page of candidates. */
export async function detectDuplicatesBatch(candidates: DiscoveryCandidate[]): Promise<DiscoveryDuplicateMatch[]> {
  const existing = await loadExisting();
  return candidates.map((c) => classify(c, existing));
}

export function classify(candidate: DiscoveryCandidate, existing: ProspectLite[]): DiscoveryDuplicateMatch {
  const candHost = hostOf(candidate.website);
  const candPhone = phoneDigits(candidate.phone);
  const candEmail = candidate.email ? candidate.email.trim().toLowerCase() : null;
  const candName = normalize(candidate.name);
  const candTokens = new Set(candName.split(" ").filter((t) => t.length >= 4));

  for (const p of existing) {
    if (candHost) {
      const eHost = hostOf(p.website);
      if (eHost && eHost === candHost) {
        return { status: "EXISTS", reason: "Same website domain", prospectId: p.id, prospectName: p.name };
      }
    }
    if (candPhone) {
      const eph = phoneDigits(p.phone);
      if (eph && eph === candPhone) {
        return { status: "EXISTS", reason: "Same phone number", prospectId: p.id, prospectName: p.name };
      }
    }
    if (candEmail && p.email) {
      if (p.email.trim().toLowerCase() === candEmail) {
        return { status: "EXISTS", reason: "Same email address", prospectId: p.id, prospectName: p.name };
      }
    }
    if (candName && normalize(p.name) === candName) {
      return { status: "EXISTS", reason: "Same business name", prospectId: p.id, prospectName: p.name };
    }
  }

  if (candTokens.size > 0) {
    for (const p of existing) {
      const pName = normalize(p.name);
      if (!pName) continue;
      if (pName.includes(candName) || candName.includes(pName)) {
        return { status: "POSSIBLE", reason: "Business name substring overlap", prospectId: p.id, prospectName: p.name };
      }
      const pTokens = new Set(pName.split(" ").filter((t) => t.length >= 4));
      const overlap = [...candTokens].filter((t) => pTokens.has(t));
      if (overlap.length >= 2) {
        return { status: "POSSIBLE", reason: "Multiple shared name tokens", prospectId: p.id, prospectName: p.name };
      }
    }
  }

  return { status: "NEW", reason: null, prospectId: null, prospectName: null };
}
