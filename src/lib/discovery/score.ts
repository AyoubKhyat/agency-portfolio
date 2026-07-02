/**
 * Opportunity + confidence scoring for AI Discovery candidates.
 *
 * opportunityScore (0-100) — how attractive is this business as a client?
 *   Weights: sector fit, contactability, missing-digital-footprint upside.
 *
 * confidenceScore (0-100) — how sure are we that the data we surfaced is real
 * and usable? Purely data-completeness at Phase 2.1; when real providers come
 * online this folds in source rating, freshness, etc.
 *
 * suggestSegment maps sector heuristics → the ProspectSegment enum so the
 * import step can pre-tag correctly.
 */

import type { DiscoveryCandidate } from "./types";
import type { ProspectSegment } from "@/lib/prospect-segments";

export function opportunityScore(c: DiscoveryCandidate): number {
  let s = 40;

  // Sector fit for the Ibda3 pivot (cinematic + immersive niche).
  const highFit = ["Luxury Hotels", "Architecture Studios", "Interior Design Studios", "Premium Restaurants", "Jewelry Houses", "Wineries", "Yacht Brokers"];
  const mediumFit = ["Hotels", "Web Agencies", "Real Estate", "Spa & Wellness"];
  if (highFit.includes(c.sector)) s += 30;
  else if (mediumFit.includes(c.sector)) s += 15;

  // Contactability — more channels = easier to reach.
  if (c.phone) s += 5;
  if (c.email) s += 5;
  if (c.instagram) s += 5;

  // Digital footprint gap = upside.
  if (!c.website) s += 10;

  // Country premium — EU/high-purchasing-power markets score higher.
  const premiumCountries = ["France", "Monaco", "Switzerland", "United Kingdom", "United Arab Emirates", "Italy"];
  if (premiumCountries.includes(c.country)) s += 5;

  return Math.max(0, Math.min(100, s));
}

export function confidenceScore(c: DiscoveryCandidate): number {
  let s = 30;
  if (c.name) s += 15;
  if (c.website) s += 15;
  if (c.phone) s += 15;
  if (c.email) s += 10;
  if (c.instagram) s += 5;
  if (c.city) s += 5;
  if (c.country) s += 5;
  return Math.max(0, Math.min(100, s));
}

/** HOT ≥ 70, WARM ≥ 45, else COLD — matches existing prospect qualityLabel scheme. */
export function qualityLabelFromScore(score: number): "HOT" | "WARM" | "COLD" {
  if (score >= 70) return "HOT";
  if (score >= 45) return "WARM";
  return "COLD";
}

export function suggestSegment(c: DiscoveryCandidate): ProspectSegment {
  const luxury = ["Luxury Hotels", "Jewelry Houses", "Yacht Brokers", "Wineries", "Premium Restaurants", "Architecture Studios", "Interior Design Studios"];
  if (luxury.includes(c.sector)) return "LUXURY_BRAND";
  if (c.sector === "Web Agencies") return "AGENCY_EU";
  // Default AI-discovered targets to LUXURY_BRAND for the premium tier, else AGENCY_EU;
  // fall back to LEGACY_COLD only for outright generic sectors.
  return "LEGACY_COLD";
}
