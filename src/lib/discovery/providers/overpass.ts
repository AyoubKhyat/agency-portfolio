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
  CITIES,
  SECTORS,
  normalizePhoneMA,
  osmFetchWithMeta,
  type SectorDef,
} from "@/lib/discovery-providers";
import type { DiscoveryCandidate, DiscoverySearchInput } from "../types";

type CityDef = (typeof CITIES)[number];

/** Provider-stage slice of the debug trace (pipeline fills the rest). */
export type OverpassDebug = {
  sector: string;
  city: string;
  country: string;
  resolved: boolean;
  unsupportedReason: string | null;
  endpoint: string | null;
  overpassQuery: string | null;
  httpStatus: number | null;
  attempts: number;
  error: string | null;
  elementCount: number;
  rawCount: number;
};

export type OverpassSearchResult = {
  candidates: DiscoveryCandidate[];
  debug: OverpassDebug;
};

const EUROPE_SOON = "European cities are coming soon. Current OSM discovery supports Morocco first.";
const NO_SECTOR = "Couldn't identify a business type — try e.g. \"hotels in Marrakech\" or \"dentists in Marrakech\".";
const UNPARSEABLE = "Couldn't understand that query — try a type + Moroccan city, e.g. \"hotels in Marrakech\".";

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

/** Build the bounded Overpass QL for a city (by wikidata area) + sector tags. */
function buildOverpassQuery(wikidata: string, sector: SectorDef): string {
  const tagClauses = sector.osmTags
    .flatMap((t) => [`node["${t.key}"="${t.value}"](area.s);`, `way["${t.key}"="${t.value}"](area.s);`])
    .join("\n  ");
  return `[out:json][timeout:25];\narea["wikidata"="${wikidata}"]->.s;\n(\n  ${tagClauses}\n);\nout tags center 60;`;
}

export async function overpassDiscoverySearch(
  { query, limit = 8 }: DiscoverySearchInput,
): Promise<OverpassSearchResult> {
  const city = resolveCity(query);
  const sector = resolveSector(query);

  const debug: OverpassDebug = {
    sector: sector?.label ?? "",
    city: city?.label ?? "",
    country: city ? "Morocco" : "",
    resolved: Boolean(city && sector),
    unsupportedReason: null,
    endpoint: null,
    overpassQuery: null,
    httpStatus: null,
    attempts: 0,
    error: null,
    elementCount: 0,
    rawCount: 0,
  };

  // Refuse unbounded searches — but say WHY (never a silent empty).
  if (!city || !sector) {
    // A recognized business type + an unknown city ⇒ almost always a non-Morocco
    // city (Nice/Paris/…). Neither recognized ⇒ the query itself is unparseable.
    debug.unsupportedReason = !city && !sector ? UNPARSEABLE : !city ? EUROPE_SOON : NO_SECTOR;
    return { candidates: [], debug };
  }

  const overpassQuery = buildOverpassQuery(city.wikidata, sector);
  debug.overpassQuery = overpassQuery;

  const meta = await osmFetchWithMeta(overpassQuery, { retries: 2 });
  debug.endpoint = meta.endpoint;
  debug.httpStatus = meta.status;
  debug.attempts = meta.attempts;
  debug.error = meta.error;
  debug.elementCount = meta.elements.length;

  const candidates: DiscoveryCandidate[] = [];
  for (const el of meta.elements) {
    const tags = el.tags || {};
    const name = tags["name"] || tags["brand"] || tags["operator"];
    if (!name) continue; // skip unnamed
    if (sector.osmNameFilter && !sector.osmNameFilter.test(name)) continue;

    const phoneRaw = tags["phone"] || tags["contact:phone"] || tags["telephone"] || null;
    candidates.push({
      name,
      website: tags["website"] || tags["contact:website"] || "",
      email: tags["email"] || tags["contact:email"] || "",
      phone: normalizePhoneMA(phoneRaw) || "",
      instagram: tags["contact:instagram"] || tags["instagram"] || "",
      city: city.label,
      country: "Morocco", // CITIES are all Moroccan
      sector: sector.label,
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    });
  }

  const sliced = candidates.slice(0, Math.max(3, Math.min(limit, 12)));
  debug.rawCount = sliced.length;
  return { candidates: sliced, debug };
}
