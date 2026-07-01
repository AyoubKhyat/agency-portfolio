/**
 * Prospect segmentation — the strategic dimension that drives the pivot from
 * "mass cold outreach" to "warm network + curated targets + AI Discovery".
 * Keep in sync with the ProspectSegment enum in prisma/schema.prisma.
 */

export const PROSPECT_SEGMENTS = [
  "WARM_NETWORK",
  "REFERRAL",
  "AGENCY_EU",
  "LUXURY_BRAND",
  "LEGACY_COLD",
] as const;

export type ProspectSegment = (typeof PROSPECT_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<ProspectSegment, string> = {
  WARM_NETWORK: "Warm Network",
  REFERRAL: "Referrals",
  AGENCY_EU: "Agencies EU",
  LUXURY_BRAND: "Luxury Brands",
  LEGACY_COLD: "Legacy Cold",
};

/** Short subtitle shown in the segment picker to disambiguate. */
export const SEGMENT_HINTS: Record<ProspectSegment, string> = {
  WARM_NETWORK: "Past clients, partners, close referrers",
  REFERRAL: "Introduced by someone in your network",
  AGENCY_EU: "European agencies — white-label partnerships",
  LUXURY_BRAND: "Luxury, architecture, hospitality, real estate",
  LEGACY_COLD: "Original 343 cold-outreach cohort",
};

export function isProspectSegment(v: unknown): v is ProspectSegment {
  return typeof v === "string" && (PROSPECT_SEGMENTS as readonly string[]).includes(v);
}

/**
 * Visual tokens per segment — muted, tone-on-tone, Apple/Vercel/Linear feel.
 * Never use saturated brand colors. Chips read as identity, not alerts.
 */
export type SegmentTokens = {
  chipBg: string;
  chipText: string;
  chipBorder: string;
  dot: string;
  softBg: string; // for cards / hovered tabs
};

export const SEGMENT_TOKENS: Record<ProspectSegment, SegmentTokens> = {
  WARM_NETWORK: {
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
    chipBorder: "border-emerald-100",
    dot: "bg-emerald-500",
    softBg: "bg-emerald-50/40",
  },
  REFERRAL: {
    chipBg: "bg-sky-50",
    chipText: "text-sky-700",
    chipBorder: "border-sky-100",
    dot: "bg-sky-500",
    softBg: "bg-sky-50/40",
  },
  AGENCY_EU: {
    chipBg: "bg-indigo-50",
    chipText: "text-indigo-700",
    chipBorder: "border-indigo-100",
    dot: "bg-indigo-500",
    softBg: "bg-indigo-50/40",
  },
  LUXURY_BRAND: {
    chipBg: "bg-amber-50",
    chipText: "text-amber-800",
    chipBorder: "border-amber-100",
    dot: "bg-amber-500",
    softBg: "bg-amber-50/40",
  },
  LEGACY_COLD: {
    chipBg: "bg-slate-100",
    chipText: "text-slate-600",
    chipBorder: "border-slate-200",
    dot: "bg-slate-400",
    softBg: "bg-slate-50/40",
  },
};

/**
 * Relationship strength: 0-100, purely derived from existing signals — no schema change.
 * Weighted by segment (warmth base), status (engagement), and recency of last activity.
 */
export function calcRelationshipStrength(p: {
  segment: ProspectSegment;
  status: string;
  lastActionAt: string | null;
}): number {
  let score = 0;
  switch (p.segment) {
    case "WARM_NETWORK": score += 45; break;
    case "REFERRAL":     score += 35; break;
    case "AGENCY_EU":    score += 25; break;
    case "LUXURY_BRAND": score += 25; break;
    case "LEGACY_COLD":  score += 5;  break;
  }
  const engaged = ["REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION"];
  if (engaged.includes(p.status)) score += 25;
  if (p.status === "CONVERTI" || p.status === "CLIENT") score += 35;
  if (p.lastActionAt) {
    const days = (Date.now() - new Date(p.lastActionAt).getTime()) / 86_400_000;
    if (days < 7)       score += 15;
    else if (days < 30) score += 8;
    else if (days > 90) score -= 10;
  } else {
    score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}
