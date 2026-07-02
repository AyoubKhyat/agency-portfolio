/**
 * Phase 2.1 pipeline: query → mock provider → mock audit → score → dedup.
 *
 * Everything here is provider-abstracted. Later phases swap the mock provider
 * for a real one (Google Places or an LLM web-crawl agent) and the mock audit
 * for an anthropic-backed one — no other module has to change.
 */

import { mockDiscoverySearch } from "./providers/mock";
import { mockAudit } from "./audit/mock";
import { opportunityScore, confidenceScore, suggestSegment } from "./score";
import { detectDuplicatesBatch } from "./duplicates";
import type { DiscoveryScoredResult, DiscoverySearchInput } from "./types";

export async function runDiscovery(input: DiscoverySearchInput): Promise<DiscoveryScoredResult[]> {
  const candidates = await mockDiscoverySearch(input);
  if (candidates.length === 0) return [];

  const [audits, duplicates] = await Promise.all([
    Promise.all(candidates.map((c) => mockAudit(c))),
    detectDuplicatesBatch(candidates),
  ]);

  return candidates.map((c, i) => ({
    ...c,
    ...audits[i],
    opportunityScore: opportunityScore(c),
    confidenceScore: confidenceScore(c),
    suggestedSegment: suggestSegment(c),
    duplicate: duplicates[i],
  }));
}
