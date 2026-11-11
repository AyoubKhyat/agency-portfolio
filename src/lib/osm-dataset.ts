/**
 * The private Marrakech business list behind batch discovery, cut from the official Geofabrik Morocco
 * OpenStreetMap file by scripts/osm/build-marrakech-dataset.ts (no live Overpass call at request time).
 *
 * Each entry holds only what discovery needs: the OSM id, a name, its sectors, its website and any contact link
 * the mapper tagged explicitly (WhatsApp, Instagram, Facebook). No phone numbers or e-mail addresses.
 * Only businesses with a usable website are kept, and one entry per website.
 *
 * The file lives outside Git (data/osm/, ignored) because the repository is public.
 * Data © OpenStreetMap contributors, ODbL 1.0.
 */
import { SECTORS, CITIES, normalizePhoneMA, type DiscoveryCandidate } from "@/lib/discovery-providers";
import { siteKey } from "@/lib/discovery-duplicates";
import { normalizeSiteUrl } from "@/lib/diagnosis";
import { explicitWhatsAppLink } from "@/lib/contact-check";

export const DATASET_FILE = "data/osm/marrakech-businesses.json";
export const DATASET_CITY = "MARRAKECH";
export const LICENCE = "Data © OpenStreetMap contributors, Open Database Licence 1.0 (https://www.openstreetmap.org/copyright)";

export type OsmEntry = {
  /** "node/123" or "way/456". */
  id: string;
  name: string;
  sectors: string[];
  website: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
};

export type SectorStats = { named: number; withWebsite: number };

export type OsmDataset = {
  version: 1;
  city: string;
  source: string;
  licence: string;
  boundary: { wikidata: string; relation: number | null; name: string | null };
  osmDataUntil: string | null;
  generatedAt: string;
  /** Named businesses per sector inside the boundary, and how many of them made it into the list. */
  sectors: Record<string, SectorStats>;
  /** Entries left out because another business in the list already uses the same website. */
  sharedWebsites: number;
  entries: OsmEntry[];
};

export type RawExtract = {
  boundary: { wikidata?: string; relation?: number; name?: string | null };
  osmDataUntil: string | null;
  elements: { type: "node" | "way"; id: number; tags: Record<string, string> }[];
};

/** Every (key, value) tag the sector mapping looks for: what the extractor has to keep. */
export function sectorTags(): { key: string; value: string }[] {
  const seen = new Map<string, { key: string; value: string }>();
  for (const s of SECTORS) for (const t of s.osmTags) seen.set(`${t.key}=${t.value}`, t);
  return [...seen.values()];
}

/** A WhatsApp the mapper tagged explicitly: a wa.me link, or a number in a contact:whatsapp tag. Never a phone tag. */
function taggedWhatsApp(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const link = explicitWhatsAppLink(raw);
  if (link) return link;
  const n = normalizePhoneMA(raw);
  return n ? explicitWhatsAppLink(`https://wa.me/${n.replace(/\D/g, "")}`) || undefined : undefined;
}

const httpsOnly = (raw: string | undefined) => (raw && /^https:\/\//i.test(raw) ? raw.slice(0, 300) : undefined);

/**
 * Applies the app's own sector mapping (the same tags and name filters the Overpass search used) to an extract,
 * keeps businesses with a usable website, one per website, in a stable order.
 */
export function buildDataset(raw: RawExtract, generatedAt = new Date().toISOString()): OsmDataset {
  const city = CITIES.find((c) => c.key === DATASET_CITY)!;
  const stats: Record<string, SectorStats> = Object.fromEntries(SECTORS.map((s) => [s.key, { named: 0, withWebsite: 0 }]));
  const bySite = new Set<string>();
  const entries: OsmEntry[] = [];
  let sharedWebsites = 0;

  const sorted = [...raw.elements].sort((a, b) => (a.type === b.type ? a.id - b.id : a.type < b.type ? -1 : 1));
  for (const el of sorted) {
    const t = el.tags;
    const name = (t["name"] || t["brand"] || t["operator"] || "").trim().slice(0, 200);
    if (!name) continue;
    const sectors = SECTORS.filter((s) => s.osmTags.some((x) => t[x.key] === x.value) && (!s.osmNameFilter || s.osmNameFilter.test(name))).map((s) => s.key);
    if (sectors.length === 0) continue;
    for (const s of sectors) stats[s].named++;

    const website = normalizeSiteUrl(t["website"] || t["contact:website"] || "");
    const key = website ? siteKey(website) : null;
    if (!website || !key) continue;
    if (bySite.has(key)) { sharedWebsites++; continue; }
    bySite.add(key);
    for (const s of sectors) stats[s].withWebsite++;

    const entry: OsmEntry = { id: `${el.type}/${el.id}`, name, sectors, website };
    const whatsapp = taggedWhatsApp(t["contact:whatsapp"] || t["whatsapp"]);
    const instagram = httpsOnly(t["contact:instagram"] || t["instagram"]);
    const facebook = httpsOnly(t["contact:facebook"]);
    if (whatsapp) entry.whatsapp = whatsapp;
    if (instagram) entry.instagram = instagram;
    if (facebook) entry.facebook = facebook;
    entries.push(entry);
  }

  return {
    version: 1, city: city.label, source: "Geofabrik morocco-latest.osm.pbf (https://download.geofabrik.de/africa/morocco.html)",
    licence: LICENCE,
    boundary: { wikidata: raw.boundary.wikidata ?? city.wikidata, relation: raw.boundary.relation ?? null, name: raw.boundary.name ?? null },
    osmDataUntil: raw.osmDataUntil, generatedAt, sectors: stats, sharedWebsites, entries,
  };
}

/** The candidate shape the rest of discovery already uses (duplicate checks, audit, import). */
export function toCandidate(e: OsmEntry, sector: string): DiscoveryCandidate {
  return {
    sourceId: e.id, source: "OSM", name: e.name, sector, city: "Marrakech", neighborhood: null,
    phone: null, whatsapp: e.whatsapp ?? null, website: e.website, email: null,
    instagram: e.instagram ?? null, facebook: e.facebook ?? null,
    mapsUrl: `https://www.openstreetmap.org/${e.id}`, rating: null, reviewCount: null,
  };
}

export class DatasetMissingError extends Error {}

let cached: Promise<OsmDataset> | null = null;

/** Reads the list once per server instance. Missing or malformed → DatasetMissingError, never made-up data. */
export function loadDataset(): Promise<OsmDataset> {
  cached ??= (async () => {
    const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    let data: OsmDataset;
    try {
      // A static path, so the build traces only this file (see DATASET_FILE).
      data = JSON.parse(await readFile(path.join(process.cwd(), "data", "osm", "marrakech-businesses.json"), "utf8"));
    } catch {
      throw new DatasetMissingError(DATASET_FILE);
    }
    if (data?.version !== 1 || !Array.isArray(data.entries)) throw new DatasetMissingError(DATASET_FILE);
    return data;
  })().catch((err) => { cached = null; throw err; });
  return cached;
}
