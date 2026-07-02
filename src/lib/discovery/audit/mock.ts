/**
 * Mock AI audit — Phase 2.1.
 *
 * Produces a one-paragraph summary and a suggested-offer line for each
 * candidate. No LLM call — just structured templating driven by sector +
 * completeness of the record. When Phase 2.2 wires a real LLM, this module
 * gets swapped for an anthropic-backed implementation with the same signature.
 */

import type { DiscoveryAudit, DiscoveryCandidate } from "../types";

const OFFER_BY_SECTOR: Record<string, string> = {
  "Luxury Hotels": "Cinematic property site + direct-booking flow (bypass OTAs on brand traffic).",
  "Hotels": "Direct-booking website + Instagram-linked storytelling to reduce OTA dependency.",
  "Web Agencies": "White-label partnership — we handle premium overflow, you keep the client.",
  "Architecture Studios": "Portfolio site engineered for RFPs — case-study depth, no template feel.",
  "Interior Design Studios": "Portfolio + project intake flow that filters out low-fit briefs.",
  "Premium Restaurants": "Reservation-first site with brand-grade photography and menu system.",
  "Jewelry Houses": "Editorial e-commerce with private-appointment booking.",
  "Real Estate": "Listing platform + WhatsApp-linked qualification funnel.",
  "Wineries": "Domain-story site + direct e-commerce for allocations.",
  "Yacht Brokers": "Fleet showcase with charter enquiry qualification.",
  "Law Firms": "Practice-area site engineered for referral traffic + LinkedIn.",
  "Spa & Wellness": "Booking-first site with treatment library and reviews block.",
};

function offerFor(sector: string): string {
  return OFFER_BY_SECTOR[sector] ?? "Premium redesign + direct-booking / lead flow tailored to the sector.";
}

function summaryFor(c: DiscoveryCandidate): string {
  const parts: string[] = [];
  const where = [c.city, c.country].filter(Boolean).join(", ");
  parts.push(`${c.name}${where ? " — " + where : ""}.`);

  const missing: string[] = [];
  if (!c.website) missing.push("no website");
  if (!c.email) missing.push("no public email");
  if (!c.instagram) missing.push("no Instagram");

  if (missing.length >= 2) {
    parts.push(`Weak digital footprint (${missing.join(", ")}) — open runway for a first-mover premium redesign.`);
  } else if (missing.length === 1) {
    parts.push(`Has some digital presence but ${missing[0]} — clear upside on conversion + brand consistency.`);
  } else {
    parts.push("Solid digital footprint — angle is premium positioning + conversion depth, not a rebuild-from-zero pitch.");
  }

  parts.push(`Sector fit: ${c.sector.toLowerCase()}, aligned with Ibda3's cinematic / immersive niche.`);
  return parts.join(" ");
}

export async function mockAudit(candidate: DiscoveryCandidate): Promise<DiscoveryAudit> {
  return {
    aiSummary: summaryFor(candidate),
    suggestedOffer: offerFor(candidate.sector),
  };
}
