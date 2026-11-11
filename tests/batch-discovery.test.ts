/**
 * P6C batch discovery: fake OpenStreetMap, fake websites and an in-memory CRM. No database, no network, no AI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { DiscoveryCandidate } from "../src/lib/discovery-providers";
import type { AuditedCandidate, BatchCandidate } from "../src/lib/batch-discovery";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

let mod: typeof import("../src/lib/batch-discovery");
let rank: typeof import("../src/lib/batch-rank");
test.before(async () => {
  mod = await import("../src/lib/batch-discovery");
  rank = await import("../src/lib/batch-rank");
});

const osm = (i: number, over: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  sourceId: `node/${i}`, source: "OSM", name: `Riad ${i}`, sector: "RIADS", city: "Marrakech", neighborhood: null,
  phone: null, whatsapp: null, website: `https://riad${i}.ma`, email: null, instagram: null, facebook: null,
  mapsUrl: `https://www.openstreetmap.org/node/${i}`, rating: null, reviewCount: null, ...over,
});
const crmRow = (over: Record<string, string>) => ({
  id: "c", name: "", phone: "", email: "", website: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "",
  whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED", ...over,
});

test("search: at most 30 looked at; no website, CRM matches, possible duplicates and repeats left out; at most 10 to check", async () => {
  const found = [
    osm(1, { website: null }),
    osm(2, { website: "https://www.in-crm.ma/fr" }),
    osm(3, { phone: "+212612345678" }),
    osm(4, { name: "Riad Jardin Majorelle", website: "https://jardin.ma" }),
    osm(5, { website: "https://riad6.ma" }), osm(6), // same site twice in the batch
    ...Array.from({ length: 29 }, (_, i) => osm(100 + i)),
  ];
  const crm = [crmRow({ id: "a", name: "Old", website: "https://in-crm.ma" }), crmRow({ id: "b", name: "Phone", phone: "0612345678" }), crmRow({ id: "d", name: "Jardin Majorelle Spa", sector: "RIADS" })];
  const s = await mod.searchBatch("RIADS", { search: async () => found, loadCrm: async () => crm });
  assert.equal(s.found, 30);
  assert.equal(s.candidates.length, 10);
  assert.deepEqual(s.skipped, { noWebsite: 1, inCrm: 2, possibleDuplicate: 1, sameSiteInBatch: 1, overLimit: 15 });
  assert.equal(s.sourceError, null);
  assert.ok(s.candidates.every((c) => /^https:\/\//.test(c.website)));
});

test("search: a failing source gives an honest partial (empty) result; unknown sectors are refused", async () => {
  const osmDown = await mod.searchBatch("RIADS", { search: async () => { throw new Error("429"); }, loadCrm: async () => [] });
  assert.match(osmDown.sourceError ?? "", /OpenStreetMap/);
  assert.equal(osmDown.candidates.length, 0);
  const crmDown = await mod.searchBatch("RIADS", { search: async () => [osm(1)], loadCrm: async () => { throw new Error("db"); } });
  assert.match(crmDown.sourceError ?? "", /CRM/);
  assert.equal(crmDown.candidates.length, 0, "nothing is checked when duplicates can't be ruled out");
  await assert.rejects(mod.searchBatch("NOPE", { search: async () => [], loadCrm: async () => [] }), mod.UnknownSectorError);
});

test("WhatsApp confidence: explicit links only, never a phone; always UNVERIFIED", () => {
  const cand = (over: Partial<DiscoveryCandidate>) => ({ ...osm(1, over), website: "https://riad1.ma" }) as BatchCandidate;
  const site = (link: string) => ({ contacts: [{ channel: "WHATSAPP" as const, value: "", link, note: null, status: "FOUND_ON_SITE" as const, sourceUrl: "https://riad1.ma/", fetchedAt: "x" }] });
  const both = mod.whatsappConfidence(cand({ whatsapp: "https://wa.me/212612345678" }), site("https://wa.me/212612345678"));
  assert.equal(both.confidence, "HIGH");
  assert.equal(both.link, "https://wa.me/212612345678");
  assert.equal(mod.whatsappConfidence(cand({ whatsapp: "https://wa.me/212612345678" }), { contacts: [] }).confidence, "MEDIUM");
  assert.equal(mod.whatsappConfidence(cand({}), site("https://wa.me/212612345678")).confidence, "MEDIUM");
  const conflict = mod.whatsappConfidence(cand({ whatsapp: "https://wa.me/212612345678" }), site("https://wa.me/212699999999"));
  assert.equal(conflict.confidence, "CONFLICT");
  assert.equal(conflict.link, "", "no number is picked when sources disagree");
  const phoneOnly = mod.whatsappConfidence(cand({ phone: "+212612345678" }), { contacts: [] });
  assert.deepEqual([phoneOnly.confidence, phoneOnly.link], ["NONE", ""]);
  assert.ok([both, conflict, phoneOnly].every((w) => w.status === "UNVERIFIED"));
});

test("a customer-facing problem outranks several technical ones", () => {
  const ev = (id: string, observed: string) => ({ id, check: id, observed, sourceUrl: "https://x.ma/", fetchedAt: "t" });
  const business = mod.scoreProblems([ev("E_DESCRIPTION", "None found")]);
  const technical = mod.scoreProblems(["E_HSTS", "E_CANONICAL", "E_SITEMAP", "E_STRUCTURED_DATA", "E_LANG"].map((id) => ev(id, "None found")));
  assert.equal(technical.findings.length, 0);
  assert.ok(business.score > technical.score, `${business.score} > ${technical.score}`);
});

/* ───────────────── Audit chunks with fake websites ───────────────── */

const res = (url: string, body: string, status = 200): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [],
});
const page = (extra: string) => `<!doctype html><html lang="fr"><head><title>Riad</title><meta name="viewport" content="width=device-width">${extra}</head>
  <body><h1>Riad</h1><p>${"Riad à Marrakech. ".repeat(40)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;
const SITES: Record<string, Record<string, string | number>> = {
  "riad1.ma": { "/robots.txt": "User-agent: *\nDisallow:", "/": page("") }, // no description: a customer-facing problem
  "riad2.ma": { "/robots.txt": "User-agent: *\nDisallow: /", "/": page("") }, // asks not to be read
  "riad3.ma": { "/robots.txt": "User-agent: *\nDisallow:", "/": page('<meta name="description" content="x">').replace("</body>", '<a href="https://wa.me/212600000009">WA</a></body>') },
};
const fetcher: SafeFetch = async (url) => {
  const u = new URL(url);
  if (u.protocol === "http:") return { ...res(url, "", 301), headers: { location: url.replace("http:", "https:") } };
  if (u.hostname === "riad4.ma") throw new Error("boom");
  const r = SITES[u.hostname]?.[u.pathname];
  return r === undefined ? res(url, "", 404) : typeof r === "number" ? res(url, "", r) : res(url, r);
};
const bc = (i: number) => ({ ...osm(i), website: `https://riad${i}.ma` }) as BatchCandidate;

test("an audit chunk checks at most three sites; robots.txt, failures and CRM links are reported, not hidden", async () => {
  const crm = async () => [crmRow({ id: "z", name: "Known WA", whatsappLink: "https://wa.me/212600000009" })];
  const out = await mod.auditChunk([bc(1), bc(2), bc(3), bc(4)], { fetcher, loadCrm: crm });
  assert.equal(out.length, 3, "a fourth site waits for the next request");
  const [one, two, three] = out;
  assert.equal(one.outcome, "COMPLETE");
  assert.deepEqual(one.findings.map((f) => f.id), ["E_DESCRIPTION", "E_OPEN_GRAPH"]);
  assert.ok(one.findings.every((f) => f.sourceUrl.startsWith("https://riad1.ma") && f.observed && f.fetchedAt));
  assert.equal(two.outcome, "ROBOTS_DISALLOWED");
  assert.match(three.inCrm ?? "", /Known WA/, "the site links to a WhatsApp already in the CRM");
  const failed = await mod.auditChunk([bc(4), { ...bc(5), website: "https://localhost" }], { fetcher, loadCrm: crm });
  assert.deepEqual(failed.map((f) => f.outcome), ["UNREADABLE", "ERROR"], "a failed fetch and a refused address are reported, the rest go on");
});

test("top 5: read completely, not in the CRM, with a customer-facing problem, best first", () => {
  const a = (i: number, over: Partial<AuditedCandidate>): AuditedCandidate => ({
    candidate: bc(i), outcome: "COMPLETE", finalUrl: `https://riad${i}.ma`, auditedAt: "t",
    findings: [{ id: "E_TITLE", check: "t", observed: "None found", sourceUrl: "s", fetchedAt: "t", sentence: "x" }],
    otherProblems: [], score: i, whatsapp: { link: "", confidence: "NONE", sources: [], status: "UNVERIFIED" }, inCrm: null, ...over,
  });
  const list = [a(1, {}), a(9, {}), a(3, {}), a(7, {}), a(5, {}), a(8, {}), a(20, { outcome: "ROBOTS_DISALLOWED" }), a(30, { inCrm: "Known" }), a(40, { findings: [] })];
  assert.deepEqual(rank.rankTop(list).map((x) => x.candidate.sourceId), ["node/9", "node/8", "node/7", "node/5", "node/3"]);
});

test("no AI, no paid API, no writes, no messages; owner/admin only; bounded steps", () => {
  const lib = read("src/lib/batch-discovery.ts");
  const route = read("src/app/api/admin/batch-discovery/route.ts");
  const pageSrc = read("src/app/admin/batch-discovery/page.tsx");
  for (const src of [lib, route, pageSrc, read("src/lib/batch-rank.ts")]) {
    assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$transaction/, "no database writes");
    assert.doesNotMatch(src, /anthropic|groq|openai|gemini|@\/lib\/ai\b|getAiProvider|GooglePlaces|getDiscoveryProvider|wa\.me\/\$\{/i, "no AI, no Google, no link built from a phone");
  }
  assert.match(lib, /new OsmProvider\(\)/);
  assert.match(route, /requireOwnerOrAdmin\(\)/);
  assert.match(route, /export const maxDuration = 60/);
  assert.match(route, /candidates: z\.array\(candidate\)\.min\(1\)\.max\(AUDIT_CHUNK\)/);
  assert.match(route, /searchGlobal\.check\("all"\)/);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.match(pageSrc, /OpenStreetMap contributors/);
  assert.match(pageSrc, /\/api\/admin\/prospect-discovery\/import/, "import goes through the route that rechecks duplicates");
  assert.match(pageSrc, /UNVERIFIED/);
});
