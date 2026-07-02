/**
 * AI Business Development Agent — shared types.
 *
 *   - DiscoveryCandidate: raw shape returned by any provider (search step).
 *   - RepairedCandidate  : after validate + repair (see ./validate.ts).
 *   - DiscoveryScoredResult: full enriched record — audit + score + dedupe.
 *   - DiscoveryResultDTO   : same, plus persistence identifiers, sent to UI.
 */

import type { ProspectSegment } from "@/lib/prospect-segments";
import type { AiProviderName } from "@/lib/ai/types";

export type DiscoveryCandidate = {
  name: string;
  website: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  country: string;
  sector: string;
  sourceUrl: string;
};

export type DiscoveryAudit = {
  aiSummary: string;
  suggestedOffer: string;
  websiteSummary: string;
  opportunityExplanation: string;
};

export type DuplicateStatus = "NEW" | "EXISTS" | "POSSIBLE";

export type DiscoveryDuplicateMatch = {
  status: DuplicateStatus;
  reason: string | null;
  prospectId: string | null;
  prospectName: string | null;
};

export type FieldValidity = {
  website: boolean;
  email: boolean;
  phone: boolean;
  instagram: boolean;
  whatsapp: boolean;
  sourceUrl: boolean;
};

/* ─────────────────────────── Verification model ───────────────────────────
 * Philosophy: never invent contact info. Every contact method carries a
 * verification status — the source of truth for whether the UI may render a
 * click-through. Format checks can only reach UNVERIFIED; real existence checks
 * (added in later steps) reach VERIFIED / UNAVAILABLE.
 *
 *   MISSING     — no value from the source
 *   INVALID     — value present but malformed (failed format)
 *   UNVERIFIED  — format-valid, existence NOT confirmed
 *   VERIFIED    — positively confirmed to exist / be reachable
 *   UNAVAILABLE — positively confirmed NOT usable (dead domain, 404, not on WhatsApp)
 */
export type VerificationStatus =
  | "MISSING"
  | "INVALID"
  | "UNVERIFIED"
  | "VERIFIED"
  | "UNAVAILABLE";

/** How a status was determined. FORMAT is offline; the rest are real checks. */
export type VerificationMethod = "FORMAT" | "DNS" | "HTTP" | "MX" | "API" | "MANUAL";

export type VerifiedContact = {
  value: string;
  status: VerificationStatus;
  method: VerificationMethod | null;
  checkedAt: string | null;
};

export type ContactChannel = "website" | "email" | "phone" | "whatsapp" | "instagram";

export type ContactVerification = Record<ContactChannel, VerifiedContact>;

export type OutreachDrafts = {
  emailSubject: string;
  emailBody: string;
  whatsappBody: string;
};

export type DiscoveryScoredResult = DiscoveryCandidate & DiscoveryAudit & OutreachDrafts & {
  opportunityScore: number; // 0-100
  confidenceScore: number;  // 0-100
  suggestedSegment: ProspectSegment;
  aiProvider: AiProviderName;
  duplicate: DiscoveryDuplicateMatch;
  validity: FieldValidity;            // legacy booleans (back-compat)
  verification: ContactVerification;  // source of truth going forward
  whatsappUrl: string;
  instagramUrl: string;
};

/** Persisted shape returned by the API to the client. */
export type DiscoveryResultDTO = DiscoveryScoredResult & {
  id: string;
  sweepId: string | null;
  importedProspectId: string | null;
  createdAt: string;
};

export type DiscoverySearchInput = {
  query: string;
  limit?: number;
};
