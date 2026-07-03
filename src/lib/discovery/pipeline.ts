/**
 * Phase 2.1 pipeline — end-to-end enrichment for AI Discovery.
 *
 *   query → mock provider → validate + repair → skip unpublishable
 *         → audit (via AI provider) + outreach previews (via AI provider)
 *         → duplicate check (batch, single DB round-trip)
 *         → score → return
 *
 * Order matters:
 *   validate/repair BEFORE audit — so the audit knows which contact channels
 *     are actually present (not what the provider naively returned).
 *   audit + dedupe run concurrently — they don't depend on each other.
 *   outreach previews run last — they depend on the audit's suggestedOffer.
 *
 * Nothing here calls the network in a way that can crash the caller. AI
 * providers gracefully fall back to Mock on error; DB dedupe returns empty
 * on outage; the whole thing degrades to "still shows results" every time.
 */

import { mockDiscoverySearch } from "./providers/mock";
import { overpassDiscoverySearch } from "./providers/overpass";
import { auditCandidate } from "./audit/mock";
import { opportunityScore, confidenceScore, suggestSegment } from "./score";
import { detectDuplicatesBatch } from "./duplicates";
import { validateAndRepair, isPublishable, type RepairedCandidate } from "./validate";
import { verifyContacts } from "./verify";
import { getAiProvider } from "@/lib/ai";
import type { DiscoverySearchInput, DiscoveryDebug, DiscoveryRunResult } from "./types";

/**
 * Which lead source is active. Overpass/OSM (real businesses) is the default;
 * the mock is a dev-only fallback, gated behind DISCOVERY_USE_MOCK=1 so it can
 * never silently fabricate data in production.
 */
export function activeLeadSource(): "OSM" | "MOCK" {
  return process.env.DISCOVERY_USE_MOCK === "1" ? "MOCK" : "OSM";
}

export async function runDiscovery(input: DiscoverySearchInput): Promise<DiscoveryRunResult> {
  const source = activeLeadSource();

  // Lead Source — real Overpass by default (with its own debug trace); mock is
  // dev-only and reports a minimal trace so the panel behaves identically.
  let rawCandidates;
  const debug: DiscoveryDebug = {
    source, query: input.query,
    sector: "", city: "", country: "", resolved: true, unsupportedReason: null,
    endpoint: null, overpassQuery: null, httpStatus: null, attempts: 0, error: null,
    elementCount: 0, rawCount: 0, normalizedCount: 0, verifiedCount: 0, dedupeCount: 0, finalCount: 0,
  };

  if (source === "MOCK") {
    rawCandidates = await mockDiscoverySearch(input);
    debug.endpoint = "MOCK";
    debug.elementCount = rawCandidates.length;
    debug.rawCount = rawCandidates.length;
  } else {
    const r = await overpassDiscoverySearch(input);
    rawCandidates = r.candidates;
    Object.assign(debug, r.debug); // merge provider-stage fields into the trace
  }

  if (rawCandidates.length === 0) return { results: [], debug };

  // 1. Normalize — validate + repair; drop anything unpublishable (no name).
  const repaired: RepairedCandidate[] = rawCandidates
    .map(validateAndRepair)
    .filter(isPublishable);
  debug.normalizedCount = repaired.length;
  if (repaired.length === 0) return { results: [], debug };

  // 2. Audit + dedupe + verify concurrently (no shared dependency).
  //    Verify runs offline reachability/MX checks; contactless candidates
  //    (e.g. mock) trigger zero network calls and pass through unchanged.
  const provider = getAiProvider();
  const [audits, duplicates, verifications] = await Promise.all([
    Promise.all(repaired.map((r) => auditCandidate(r))),
    detectDuplicatesBatch(repaired),
    Promise.all(repaired.map((r) => verifyContacts(r.verification))),
  ]);
  debug.verifiedCount = verifications.length;
  debug.dedupeCount = duplicates.filter((d) => d.status !== "EXISTS").length;

  // 3. Outreach previews depend on the audit's suggestedOffer.
  const outreachPromises = repaired.map((r, i) => {
    const offer = audits[i].suggestedOffer;
    const lang: "fr" | "en" = r.country === "France" || r.country === "Monaco" || r.country === "Belgium" ? "fr" : "en";
    return Promise.all([
      provider.generateOutreachEmail({ businessName: r.name, sector: r.sector, city: r.city, country: r.country, language: lang, suggestedOffer: offer }),
      provider.generateOutreachWhatsApp({ businessName: r.name, sector: r.sector, city: r.city, country: r.country, language: lang, suggestedOffer: offer }),
    ]);
  });
  const outreach = await Promise.all(outreachPromises);

  // 4. Score + assemble the final scored records.
  const results = repaired.map((r, i) => {
    const bareCandidate = {
      name: r.name, website: r.website, phone: r.phone, email: r.email,
      instagram: r.instagram, city: r.city, country: r.country,
      sector: r.sector, sourceUrl: r.sourceUrl,
    };
    return {
      ...bareCandidate,
      ...audits[i],
      emailSubject: outreach[i][0].subject,
      emailBody: outreach[i][0].body,
      whatsappBody: outreach[i][1],
      opportunityScore: opportunityScore(bareCandidate),
      confidenceScore: confidenceScore(bareCandidate),
      suggestedSegment: suggestSegment(bareCandidate),
      aiProvider: provider.name,
      duplicate: duplicates[i],
      validity: r.validity,
      verification: verifications[i],
      whatsappUrl: r.whatsappUrl,
      instagramUrl: r.instagramUrl,
    };
  });

  debug.finalCount = results.length;
  return { results, debug };
}
