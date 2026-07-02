/**
 * AI Business Development Agent — Phase 2.1 shared types.
 *
 * A "candidate" is the raw shape returned by a provider (search step).
 * A "result" is the enriched shape returned by the agent after audit + score +
 * duplicate check — that's what the UI renders and what gets persisted as
 * DiscoveryResult.
 */

import type { ProspectSegment } from "@/lib/prospect-segments";

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
};

export type DuplicateStatus = "NEW" | "EXISTS" | "POSSIBLE";

export type DiscoveryDuplicateMatch = {
  status: DuplicateStatus;
  reason: string | null;
  prospectId: string | null;
  prospectName: string | null;
};

export type DiscoveryScoredResult = DiscoveryCandidate & DiscoveryAudit & {
  opportunityScore: number; // 0-100
  confidenceScore: number;  // 0-100
  suggestedSegment: ProspectSegment;
  duplicate: DiscoveryDuplicateMatch;
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
