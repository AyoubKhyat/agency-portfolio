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
  validity: FieldValidity;
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
