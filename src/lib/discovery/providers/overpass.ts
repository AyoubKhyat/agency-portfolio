/**
 * Overpass / OpenStreetMap — the first REAL lead source for AI Discovery.
 *
 * Replaces the mock provider as the default. Returns real businesses mapped
 * onto the strict DiscoveryCandidate shape, with every unknown field left
 * EMPTY (never fabricated). Downstream stays identical:
 *
 *   Lead Source (here) → Normalize (validate) → Verify → AI Audit → …
 *
 * It reuses the battle-tested Overpass client in `@/lib/discovery-providers`
 * (endpoints, polite User-Agent, typed error handling, mirror fallback) so we
 * don't duplicate the network layer. This module's only job is:
 *   free-text query → { city, sector } → OSM search → strict candidate shape.
 *
 * Honesty guarantees:
 *   - WhatsApp is never derived from a phone (the OSM layer only emits it from
 *     an explicit contact:whatsapp tag), so `whatsapp` is not part of the
 *     candidate — it stays MISSING until a manual confirmation.
 *   - If the query can't be resolved to BOTH a known city and a known sector,
 *     we refuse to run (an unbounded Overpass query is over-broad and returns
 *     junk) and return [] — no results beats fake results.
 *   - Any Overpass error degrades to [] and never throws to the pipeline.
 */

import {
  OsmProvider,
  CITIES,
  SECTORS,
  type DiscoveryCandidate as OsmCandidate,
  type SectorDef,
} from "@/lib/discovery-providers";
import type { DiscoveryCandidate, DiscoverySearchInput } from "../types";

type CityDef = (typeof CITIES)[number];

/** Common alternate spellings → canonical city key. */
const CITY_ALIASES: Record<string, string> = {
  marrakesh: "MARRAKECH",
  marrakech: "MARRAKECH",
  tangier: "TANGER",
  tanger: "TANGER",
  fez: "FES",
  fes: "FES",
};

function resolveCity(query: string): CityDef | null {
  const lower = query.toLowerCase();
  for (const c of CITIES) {
    if (lower.includes(c.label.toLowerCase()) || lower.includes(c.key.toLowerCase())) return c;
  }
  for (const [alt, key] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alt)) {
      const hit = CITIES.find((c) => c.key === key);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Resolve a sector by scoring the query against each sector's label + query
 * keywords; the longest matched term wins (so "interior design" beats a stray
 * "design" match). Terms shorter than 3 chars are ignored to avoid noise.
 */
function resolveSector(query: string): SectorDef | null {
  const haystack = ` ${query.toLowerCase()} `;
  let best: { def: SectorDef; score: number } | null = null;

  for (const def of SECTORS) {
    const terms = new Set<string>();
    terms.add(def.label.toLowerCase());
    terms.add(def.label.toLowerCase().replace(/s$/, "")); // singular
    for (const w of def.googleQuery.toLowerCase().split(/\s+/)) {
      if (w.length >= 4) terms.add(w);
    }
    for (const term of terms) {
      if (term.length >= 3 && haystack.includes(term)) {
        if (!best || term.length > best.score) best = { def, score: term.length };
      }
    }
  }
  return best?.def ?? null;
}

/** True when the pipeline can resolve this query to a real Overpass search. */
export function canResolveOverpassQuery(query: string): boolean {
  return Boolean(resolveCity(query) && resolveSector(query));
}

export async function overpassDiscoverySearch(
  { query, limit = 8 }: DiscoverySearchInput,
): Promise<DiscoveryCandidate[]> {
  const city = resolveCity(query);
  const sector = resolveSector(query);
  if (!city || !sector) return []; // unbounded → refuse; no junk

  let raw: OsmCandidate[];
  try {
    raw = await new OsmProvider().search({
      city: city.key,
      sector: sector.key,
      neighborhood: null,
      keyword: null,
    });
  } catch {
    // OverpassError / network failure → degrade to empty, never crash pipeline.
    return [];
  }

  const size = Math.max(3, Math.min(limit, 12));
  return raw.slice(0, size).map((c): DiscoveryCandidate => ({
    name: c.name,
    website: c.website ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    instagram: c.instagram ?? "",
    city: c.city,
    country: "Morocco", // CITIES are all Moroccan
    sector: sector.label,
    sourceUrl: c.mapsUrl ?? "",
  }));
}
