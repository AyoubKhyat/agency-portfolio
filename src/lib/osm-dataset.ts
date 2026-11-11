/**
 * The private Marrakech business list behind batch discovery, cut from the official Geofabrik Morocco
 * OpenStreetMap file by scripts/osm/build-marrakech-dataset.ts (no live Overpass call at request time).
 *
 * Each entry holds only what discovery needs: the OSM id, a name, its sectors, its website and any contact link
 * the mapper tagged explicitly (WhatsApp, Instagram, Facebook). No phone numbers or e-mail addresses.
 * Only businesses with a usable website are kept, and one entry per website.
 *
 * It lives outside Git (data/osm/ is ignored, the repository is public): in a private Vercel Blob store in
 * production, or the local file for development. See "Loading" below.
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

/* ───────────────── Loading (server only) ─────────────────
 * Where the list comes from:
 *   - OSM_BLOB_READ_WRITE_TOKEN set → the private Vercel Blob store, pathname BLOB_PATHNAME (server-side only;
 *     the token and the blob URL never reach the browser, and a private blob URL is useless without the token).
 *   - otherwise, off Vercel (local dev, smoke tests) → data/osm/marrakech-businesses.json.
 *   - otherwise → not installed. Never made-up data.
 * Upload: scripts/osm/upload-marrakech-dataset.ts (manual, dry run unless --apply).
 */
export const BLOB_PATHNAME = "osm/marrakech-businesses.json";
export const BLOB_TOKEN_ENV = "OSM_BLOB_READ_WRITE_TOKEN";
/** Re-read at most hourly per server instance, so a fresh upload shows up without a redeploy. */
export const CACHE_MS = 60 * 60_000;
const MAX_BYTES = 2_000_000;

/** The list isn't configured or hasn't been uploaded. */
export class DatasetMissingError extends Error {}
/** The list exists but couldn't be read or isn't valid. */
export class DatasetUnavailableError extends Error {}

export type DatasetSource = "blob" | "local" | "none";

export function datasetSource(env: Record<string, string | undefined> = process.env): DatasetSource {
  if (env[BLOB_TOKEN_ENV]) return "blob";
  if (!env.VERCEL) return "local";
  return "none";
}

const ENTRY_ID = /^(node|way)\/\d{1,15}$/;
const optLink = (v: unknown) => v === undefined || (typeof v === "string" && /^https:\/\//.test(v) && v.length <= 300);

/** Checks the shape before anything uses it: a broken or tampered file is refused, not half-used. */
export function parseDataset(text: string): OsmDataset {
  if (text.length > MAX_BYTES) throw new DatasetUnavailableError("too large");
  let d: OsmDataset;
  try { d = JSON.parse(text); } catch { throw new DatasetUnavailableError("not JSON"); }
  const ok = d?.version === 1 && Array.isArray(d.entries) && typeof d.generatedAt === "string" && d.entries.every((e) =>
    typeof e?.id === "string" && ENTRY_ID.test(e.id) && typeof e.name === "string" && e.name.length > 0 && e.name.length <= 200
    && Array.isArray(e.sectors) && e.sectors.every((x) => typeof x === "string") && typeof e.website === "string" && e.website.length <= 2048
    && (e.whatsapp === undefined || explicitWhatsAppLink(e.whatsapp) === e.whatsapp) && optLink(e.instagram) && optLink(e.facebook));
  if (!ok) throw new DatasetUnavailableError("unexpected shape");
  return d;
}

export type LoaderDeps = {
  env?: Record<string, string | undefined>;
  /** The blob's text, or null when it doesn't exist. */
  getBlob?: (pathname: string, token: string) => Promise<string | null>;
  /** The local file's text, or null when it doesn't exist. */
  readLocal?: () => Promise<string | null>;
  now?: () => number;
};

async function getPrivateBlob(pathname: string, token: string): Promise<string | null> {
  const { get, BlobNotFoundError } = await import("@vercel/blob");
  try {
    const r = await get(pathname, { access: "private", token });
    if (!r) return null;
    if (r.statusCode !== 200 || !r.stream) throw new DatasetUnavailableError(`status ${r.statusCode}`);
    return await new Response(r.stream).text();
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    if (err instanceof DatasetUnavailableError) throw err;
    throw new DatasetUnavailableError(err instanceof Error ? err.name : "blob error"); // never the token or URL
  }
}

async function readLocalFile(): Promise<string | null> {
  const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  try {
    // A static path, so the build traces only this file (see DATASET_FILE).
    return await readFile(path.join(process.cwd(), "data", "osm", "marrakech-businesses.json"), "utf8");
  } catch {
    return null;
  }
}

/** A loader with its own cache. Failures are never cached, so the next search tries again. */
export function createDatasetLoader(deps: LoaderDeps = {}): () => Promise<OsmDataset> {
  let cache: { data: OsmDataset; at: number } | null = null;
  let inFlight: Promise<OsmDataset> | null = null;
  const now = deps.now ?? Date.now;
  return () => {
    if (cache && now() - cache.at < CACHE_MS) return Promise.resolve(cache.data);
    inFlight ??= (async () => {
      const env = deps.env ?? process.env;
      const source = datasetSource(env);
      if (source === "none") throw new DatasetMissingError("not configured");
      const text = source === "blob"
        ? await (deps.getBlob ?? getPrivateBlob)(BLOB_PATHNAME, env[BLOB_TOKEN_ENV]!)
        : await (deps.readLocal ?? readLocalFile)();
      if (text === null) throw new DatasetMissingError(source === "blob" ? "not uploaded" : DATASET_FILE);
      const data = parseDataset(text);
      cache = { data, at: now() };
      return data;
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export const loadDataset = createDatasetLoader();
