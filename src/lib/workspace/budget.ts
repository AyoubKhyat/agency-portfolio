/**
 * Project-size estimation — deterministic, no DB, no AI, no stored field.
 *
 * We deliberately avoid fake precision (never "12,437 MAD"). Instead we bucket
 * into Small / Medium / Large / Enterprise and attach a rough internal range.
 * Derived from segment (buying power) + sector (project complexity), with the
 * recommended service nudging the floor. Always labelled an internal estimate.
 */

import type { ProspectSegment } from "@/lib/prospect-segments";
import type { ProjectSize, WorkspaceBudget } from "@/lib/workspace/types";

/** Rough internal MAD ranges per bucket. Ballpark only — not a quote. */
const SIZE_RANGE: Record<ProjectSize, string> = {
  Small: "≈ 5k–12k MAD",
  Medium: "≈ 12k–25k MAD",
  Large: "≈ 25k–60k MAD",
  Enterprise: "≈ 60k+ MAD",
};

/** Buying-power weight per segment. */
const SEGMENT_WEIGHT: Record<ProspectSegment, number> = {
  LUXURY_BRAND: 3,
  AGENCY_EU: 2,
  REFERRAL: 1,
  WARM_NETWORK: 1,
  LEGACY_COLD: 0,
};

/** Sectors that typically carry larger, more complex builds. */
const HIGH_VALUE_SECTOR = /luxe|luxury|hotel|hôtel|riad|resort|immob|real\s?estate|architect|villa|jewel|bijou|clinic|clinique|law|avocat|finance|automob|car|yacht/i;
const MID_VALUE_SECTOR = /restaurant|caf[ée]|spa|hammam|beauty|beaut[ée]|salon|boutique|retail|e-?commerce|shop|store|gym|fitness|dental|dentist/i;

/** Services that imply a bigger engagement, nudging the size up a notch. */
const HEAVY_SERVICE = /e-?commerce|platform|plateforme|app|application|crm|booking|r[ée]servation|erp|marketplace|automat/i;

function sectorWeight(sector: string): number {
  if (!sector) return 0;
  if (HIGH_VALUE_SECTOR.test(sector)) return 2;
  if (MID_VALUE_SECTOR.test(sector)) return 1;
  return 0;
}

/**
 * Map a segment + sector (+ optional recommended service) to a coarse project
 * size and rough range. Pure and deterministic.
 */
export function deriveProjectSize(
  segment: ProspectSegment,
  sector: string,
  service?: string,
): WorkspaceBudget {
  let points = SEGMENT_WEIGHT[segment] ?? 0;
  points += sectorWeight(sector);
  if (service && HEAVY_SERVICE.test(service)) points += 1;

  let size: ProjectSize;
  if (points >= 5) size = "Enterprise";
  else if (points >= 3) size = "Large";
  else if (points >= 1) size = "Medium";
  else size = "Small";

  return {
    size,
    rangeLabel: SIZE_RANGE[size],
    basis: "Rough internal estimate from segment + sector — not a quote.",
  };
}
