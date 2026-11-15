/**
 * The private Marrakech list builder, on a tiny invented extract (tests/fixtures/osm-marrakech-mini.raw.json,
 * made by scripts/osm/extract.py from tests/fixtures/osm-marrakech-mini.osm). No network, no database.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RawExtract } from "../src/lib/osm-dataset";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const raw: RawExtract = JSON.parse(fixture("osm-marrakech-mini.raw.json"));

test("the extractor kept only businesses inside the boundary, with names, and no phone, e-mail or address", () => {
  assert.equal(raw.boundary.wikidata, "Q101625", "the same Marrakech boundary the Overpass search used");
  const ids = raw.elements.map((e) => `${e.type}/${e.id}`);
  assert.ok(!ids.includes("node/103"), "outside the boundary");
  assert.ok(!ids.includes("node/104"), "no name");
  const keys = new Set(raw.elements.flatMap((e) => Object.keys(e.tags)));
  for (const k of ["phone", "email", "contact:phone", "contact:email", "opening_hours", "addr:street"]) assert.ok(!keys.has(k), k);
});

test("the app's own sector mapping, one entry per website, explicit links only", async () => {
  const { buildDataset, toCandidate, sectorTags } = await import("../src/lib/osm-dataset");
  const d = buildDataset(raw, "2026-11-11T00:00:00Z");
  assert.deepEqual(d.entries.map((e) => e.id), ["node/101", "node/106", "node/107", "way/201"], "stable order; no-website and shared-site entries left out");
  const riad = d.entries[0];
  assert.deepEqual(riad.sectors, ["RIADS", "GUEST_HOUSES"]);
  assert.equal(riad.website, "https://riad-fixture.example");
  assert.equal(riad.whatsapp, "https://wa.me/212612345678", "from the explicit contact:whatsapp tag");
  assert.deepEqual(d.entries.find((e) => e.id === "node/107")?.sectors, ["HOTELS"], "the riad name filter still applies");
  assert.equal(d.entries.find((e) => e.id === "way/201")?.instagram, "https://www.instagram.com/riadwayfixture");
  assert.equal(d.entries.find((e) => e.id === "node/106")?.whatsapp, undefined, "a phone never becomes a WhatsApp");
  assert.equal(d.sharedWebsites, 1);
  assert.deepEqual(d.sectors.HOTELS, { named: 3, withWebsite: 2 });
  assert.match(d.licence, /OpenStreetMap contributors.*Open Database Licence/);
  for (const e of d.entries) assert.deepEqual(Object.keys(e).filter((k) => !["id", "name", "sectors", "website", "whatsapp", "instagram", "facebook"].includes(k)), []);
  const c = toCandidate(riad, "RIADS");
  assert.deepEqual([c.source, c.phone, c.email, c.mapsUrl], ["OSM", null, null, "https://www.openstreetmap.org/node/101"]);
  assert.ok(sectorTags().some((t) => t.key === "tourism" && t.value === "guest_house"));
});

test("no website: kept only with an explicit WhatsApp or Instagram tag, as website \"\"; never from a phone", async () => {
  const { buildDataset } = await import("../src/lib/osm-dataset");
  const extra: RawExtract = {
    ...raw,
    elements: [
      ...raw.elements,
      { type: "node", id: 301, tags: { tourism: "hotel", name: "Hotel WhatsApp Only", "contact:whatsapp": "+212 612 000 301" } },
      { type: "node", id: 302, tags: { tourism: "hotel", name: "Hotel Instagram Only", "contact:instagram": "https://www.instagram.com/hotel302" } },
      { type: "node", id: 303, tags: { tourism: "hotel", name: "Hotel Facebook Only", "contact:facebook": "https://www.facebook.com/hotel303" } },
      { type: "node", id: 304, tags: { tourism: "hotel", name: "Hotel Phone Only", phone: "+212 612 000 304" } },
    ],
  };
  const d = buildDataset(extra, "2026-11-11T00:00:00Z");
  const byId = Object.fromEntries(d.entries.map((e) => [e.id, e]));
  assert.deepEqual(byId["node/301"], { id: "node/301", name: "Hotel WhatsApp Only", sectors: ["HOTELS"], website: "", whatsapp: "https://wa.me/212612000301" });
  assert.deepEqual(byId["node/302"], { id: "node/302", name: "Hotel Instagram Only", sectors: ["HOTELS"], website: "", instagram: "https://www.instagram.com/hotel302" });
  assert.equal(byId["node/303"], undefined, "a Facebook page alone isn't enough");
  assert.equal(byId["node/304"], undefined, "a phone tag never makes an entry");
  assert.equal(byId["node/102"], undefined, "no website and no contact tag: still left out");
  assert.deepEqual(d.sectors.HOTELS, { named: 7, withWebsite: 2 }, "the website counts P6C shows are unchanged");
});

test("a missing list is reported, never replaced by made-up data", async () => {
  const { loadDataset, DatasetMissingError } = await import("../src/lib/osm-dataset");
  const cwd = process.cwd();
  process.chdir(new URL("./fixtures", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  try {
    await assert.rejects(loadDataset(), DatasetMissingError);
  } finally {
    process.chdir(cwd);
  }
});

/* ───────────────── Loading from private Blob ───────────────── */

const blobCalls: { pathname: string; opts: Record<string, unknown> }[] = [];
let blobReply: { statusCode: number; text?: string } | null = null;
mock.module("@vercel/blob", {
  namedExports: {
    BlobNotFoundError: class extends Error {},
    get: async (pathname: string, opts: Record<string, unknown>) => {
      blobCalls.push({ pathname, opts });
      return blobReply && { statusCode: blobReply.statusCode, stream: blobReply.text === undefined ? null : new Response(blobReply.text).body, blob: {} };
    },
  },
});

const valid = () => JSON.stringify({ version: 1, generatedAt: "2026-11-11T00:00:00Z", osmDataUntil: null, sectors: {}, entries: [{ id: "node/1", name: "Riad A", sectors: ["RIADS"], website: "https://a.ma" }] });

test("source: private Blob when its token is set, the local file off Vercel, otherwise not installed", async () => {
  const { datasetSource } = await import("../src/lib/osm-dataset");
  assert.equal(datasetSource({ OSM_BLOB_READ_WRITE_TOKEN: "t", VERCEL: "1" }), "blob");
  assert.equal(datasetSource({}), "local");
  assert.equal(datasetSource({ VERCEL: "1", BLOB_READ_WRITE_TOKEN: "public-store" }), "none", "the public covers store is never used");
});

test("Blob read: private access, server token, cached for an hour, failures not cached", async () => {
  const { createDatasetLoader } = await import("../src/lib/osm-dataset");
  let t = 0;
  blobCalls.length = 0;
  blobReply = { statusCode: 200, text: valid() };
  const load = createDatasetLoader({ env: { OSM_BLOB_READ_WRITE_TOKEN: "secret", VERCEL: "1" }, now: () => t });
  assert.equal((await load()).entries.length, 1);
  await load();
  assert.equal(blobCalls.length, 1, "served from cache");
  assert.deepEqual([blobCalls[0].pathname, blobCalls[0].opts.access, blobCalls[0].opts.token], ["osm/marrakech-businesses.json", "private", "secret"]);
  t = 61 * 60_000;
  await load();
  assert.equal(blobCalls.length, 2, "re-read after an hour");

  const { DatasetMissingError, DatasetUnavailableError } = await import("../src/lib/osm-dataset");
  blobReply = null;
  const fresh = createDatasetLoader({ env: { OSM_BLOB_READ_WRITE_TOKEN: "secret" } });
  await assert.rejects(fresh(), DatasetMissingError, "not uploaded yet");
  blobReply = { statusCode: 200, text: valid() };
  assert.equal((await fresh()).entries.length, 1, "the failure was not cached");
  blobReply = { statusCode: 500 };
  const broken = createDatasetLoader({ env: { OSM_BLOB_READ_WRITE_TOKEN: "secret" } });
  await assert.rejects(broken(), (err: Error) => err instanceof DatasetUnavailableError && !/secret|blob\.vercel-storage/.test(err.message));
});

test("a malformed or tampered list is refused, not half-used", async () => {
  const { parseDataset, DatasetUnavailableError } = await import("../src/lib/osm-dataset");
  const bad = (patch: object) => JSON.stringify({ ...JSON.parse(valid()), ...patch });
  assert.throws(() => parseDataset("{"), DatasetUnavailableError);
  assert.throws(() => parseDataset(bad({ version: 2 })), DatasetUnavailableError);
  assert.throws(() => parseDataset(bad({ entries: [{ id: "relation/../x", name: "A", sectors: [], website: "https://a.ma" }] })), DatasetUnavailableError);
  assert.throws(() => parseDataset(bad({ entries: [{ id: "node/1", name: "A", sectors: [], website: "https://a.ma", whatsapp: "+212600000000" }] })), DatasetUnavailableError);
  assert.throws(() => parseDataset(bad({ entries: [{ id: "node/1", name: "A", sectors: [], website: "https://a.ma", instagram: "javascript:alert(1)" }] })), DatasetUnavailableError);
  assert.throws(() => parseDataset("x".repeat(2_000_001)), DatasetUnavailableError);
});

test("the Blob token and URL stay on the server", () => {
  const page = readFileSync(new URL("../src/app/admin/batch-discovery/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/admin/batch-discovery/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(page, /osm-dataset"|@vercel\/blob|OSM_BLOB|NEXT_PUBLIC/);
  assert.doesNotMatch(route, /OSM_BLOB|BLOB_PATHNAME|downloadUrl|\.url\b/);
});
