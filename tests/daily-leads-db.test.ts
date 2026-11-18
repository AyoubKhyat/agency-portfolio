/**
 * Daily Lead Agent store against a REAL, ISOLATED Postgres: the day lock on the primary key, takeover of a
 * crashed run, the guarded finish, Today's view and marking an import.
 *
 * Skipped unless DAILY_LEADS_TEST_DATABASE_URL points at a local database (127.0.0.1 / localhost) that is not
 * the DATABASE_URL of this process or of .env, so it can never touch production. Every test empties only
 * discovery_results and discovery_sweeps rows whose provider is DAILY_AGENT. Schema = `prisma db push` of
 * prisma/schema.prisma into that database.
 */
import { test, mock, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const URL_ = process.env.DAILY_LEADS_TEST_DATABASE_URL ?? "";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
const envFileHost = (() => {
  try {
    return hostOf(/^DATABASE_URL=["']?([^"'\r\n]+)/m.exec(readFileSync(new URL("../.env", import.meta.url), "utf8"))?.[1] ?? "");
  } catch {
    return "";
  }
})();
const host = hostOf(URL_);
const isolated = URL_ !== "" && ["127.0.0.1", "localhost"].includes(host) && URL_ !== process.env.DATABASE_URL && host !== envFileHost;
const skip = isolated ? false : "set DAILY_LEADS_TEST_DATABASE_URL to an isolated local database to run";

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any;
let store: typeof import("../src/lib/daily-leads-store");
let agent: typeof import("../src/lib/daily-leads");

before(async () => {
  if (!isolated) return;
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_ }) });
  mock.module("@/lib/prisma", { namedExports: { prisma: client, hasPrisma: () => true } });
  store = await import("../src/lib/daily-leads-store");
  agent = await import("../src/lib/daily-leads");
});
after(async () => { await client?.$disconnect(); });
beforeEach(async () => {
  if (!isolated) return;
  await client.discoveryResult.deleteMany({ where: { sweep: { provider: "DAILY_AGENT" } } });
  await client.discoverySweep.deleteMany({ where: { provider: "DAILY_AGENT" } });
});

const lead = (i: number, over: Record<string, unknown> = {}) => ({
  kind: "WEBSITE" as const, osmId: `node/${i}`, osmUrl: `https://www.openstreetmap.org/node/${i}`, name: `Biz ${i}`, sector: "HOTELS",
  website: `https://ok-${i}.ma`, finalUrl: `https://ok-${i}.ma/`, outcome: "COMPLETE",
  findings: [{ id: "E_DESCRIPTION", sentence: "no description", observed: "None found", sourceUrl: `https://ok-${i}.ma/`, fetchedAt: "t" }],
  score: 9, contacts: [], whatsappConfidence: "NONE" as const, checkedAt: "2026-11-14T06:01:00.000Z", ...over,
});
const stats = { sectors: ["HOTELS"], checked: 3, outcomes: { COMPLETE: 2, UNREADABLE: 1 }, skipped: { noWebsite: 0, platformOnly: 0, inCrm: 1, possibleDuplicate: 0, sameSiteInBatch: 0, shownBefore: 0 }, noWebsiteWithContact: 0, sectorErrors: [], stoppedEarly: false };

test("the day is claimed once, even by two runs at the same moment", { skip }, async () => {
  const now = new Date("2026-11-14T06:00:00Z");
  const both = await Promise.all([store.prismaDailyStore.claim("2026-11-14", 1, now, { retry: false }), store.prismaDailyStore.claim("2026-11-14", 1, now, { retry: false })]);
  assert.equal(both.filter((c) => c.claimed).length, 1);
  const row = await client.discoverySweep.findUnique({ where: { id: "daily-agent-2026-11-14" } });
  assert.equal(row.status, "RUNNING");
  assert.equal(row.sector, "DAILY_AGENT", "kept out of the legacy per-sector coverage");
});

test("finish saves leads once; a completed day can't be claimed again, even with retry", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c = await s.claim("2026-11-14", 1, new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c.claimed);
  await s.finish("2026-11-14", 1, c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: { HOTELS: 3 } }, stats, leads: [lead(1), lead(2, { kind: "NO_WEBSITE", website: "", outcome: null, contacts: [{ channel: "WHATSAPP", link: "https://wa.me/212612345678", source: "OSM_TAG", sourceUrl: "x" }] })] }, new Date());
  await assert.rejects(s.finish("2026-11-14", 1, c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats, leads: [lead(3)] }, new Date()), agent.LostClaimError);
  assert.deepEqual(await s.claim("2026-11-14", 1, new Date("2026-11-14T09:00:00Z"), { retry: true }), { claimed: false, status: "COMPLETED" });

  const rows = await client.discoveryResult.findMany({ orderBy: { createdAt: "asc" } });
  assert.equal(rows.length, 2);
  const wa = rows.find((r: any) => r.name === "Biz 2");
  assert.deepEqual([wa.website, wa.whatsappUrl, wa.whatsappStatus, wa.websiteStatus, wa.aiProvider, wa.aiSummary, wa.suggestedOffer], ["", "https://wa.me/212612345678", "UNVERIFIED", "NOT_LISTED", "NONE", "", ""]);
  assert.deepEqual(await s.lastState(), { v: 1, cursors: { HOTELS: 3 } });
  const shown = await s.shown();
  assert.ok(shown.osmIds.has("node/1") && shown.osmIds.has("node/2") && shown.sites.has("ok-1.ma"));

  const view = await store.getTodayLeads("2026-11-14");
  assert.equal(view.run?.status, "COMPLETED");
  assert.deepEqual(view.leads.map((l) => l.name), ["Biz 1", "Biz 2"]);
  assert.equal(view.leads[0].findings[0].observed, "None found", "the evidence comes back with the lead");
});

test("evidence grades, their notes and the rejected counts are saved and come back in Today's view", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c = await s.claim("2026-11-14", 1, new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c.claimed);
  const findings = [
    { id: "E_VIEWPORT", sentence: "no viewport", observed: "None found", sourceUrl: "https://ok-1.ma/", fetchedAt: "t", evidence: "FIRM" },
    { id: "E_RESPONSE_TIME", sentence: "slow", observed: "4400 ms", sourceUrl: "https://ok-1.ma/", fetchedAt: "t", evidence: "UNCERTAIN", note: "A second check took about 0.6 s." },
  ];
  const rejected = { seoOnly: 2, uncertainOnly: 1, competitor: 1 };
  await s.finish("2026-11-14", 1, c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats: { ...stats, rejected }, leads: [lead(1, { findings })] }, new Date());
  const view = await store.getTodayLeads("2026-11-14");
  assert.deepEqual(view.leads[0].findings.map((f) => [f.evidence, f.note ?? null]), [["FIRM", null], ["UNCERTAIN", "A second check took about 0.6 s."]]);
  assert.deepEqual(view.run?.stats?.rejected, rejected);
});

test("a FAILED day keeps the previous cursors and can be retried only on request; a crashed RUNNING one can be taken over", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c1 = await s.claim("2026-11-13", 1, new Date("2026-11-13T06:00:00Z"), { retry: false });
  assert.ok(c1.claimed);
  await s.finish("2026-11-13", 1, c1.startedAt, { status: "COMPLETED", state: { v: 1, cursors: { HOTELS: 7 } }, stats, leads: [] }, new Date());
  const c2 = await s.claim("2026-11-14", 1, new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c2.claimed);
  await s.finish("2026-11-14", 1, c2.startedAt, { status: "FAILED", state: await s.lastState(), stats: null, error: "The CRM couldn't be read" }, new Date());
  assert.deepEqual(await s.lastState(), { v: 1, cursors: { HOTELS: 7 } });
  assert.deepEqual(await s.claim("2026-11-14", 1, new Date("2026-11-14T06:30:00Z"), { retry: false }), { claimed: false, status: "FAILED" });
  const retried = await s.claim("2026-11-14", 1, new Date("2026-11-14T08:00:00Z"), { retry: true });
  assert.ok(retried.claimed);
  assert.deepEqual(await s.claim("2026-11-14", 1, new Date("2026-11-14T08:02:00Z"), { retry: true }), { claimed: false, status: "RUNNING" }, "a live run isn't taken over");
  const takeover = await s.claim("2026-11-14", 1, new Date("2026-11-14T08:30:00Z"), { retry: false });
  assert.ok(takeover.claimed, "still RUNNING after the limit: crashed, taken over");
  await assert.rejects(s.finish("2026-11-14", 1, retried.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats, leads: [lead(1)] }, new Date()), agent.LostClaimError, "the crashed run can't save afterwards");
});

test("marking an import links the lead once and counts it on the day", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c = await s.claim("2026-11-14", 1, new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c.claimed);
  await s.finish("2026-11-14", 1, c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats, leads: [lead(1)] }, new Date());
  const [row] = await client.discoveryResult.findMany({});
  const by = { userId: "u1", fullName: "Tester" };
  assert.equal(await store.markImported(row.id, "p-1", by), true);
  assert.equal(await store.markImported(row.id, "p-2", by), false, "only once");
  const after = await client.discoveryResult.findUnique({ where: { id: row.id } });
  assert.equal(after.importedProspectId, "p-1");
  assert.equal((await client.discoverySweep.findUnique({ where: { id: "daily-agent-2026-11-14" } })).importedCount, 1);
  assert.equal((await store.getTodayLeads("2026-11-14")).leads[0].importedProspectId, "p-1");
  const cand = store.importCandidate((await store.getTodayLeads("2026-11-14")).leads[0]);
  assert.deepEqual([cand.source, cand.phone, cand.email, cand.city], ["OSM", null, null, "Marrakech"], "no phone or e-mail is ever invented");
});

test("rounds: each round is its own row and lock; Today shows every round's leads and whether another round can run", { skip }, async () => {
  const s = store.prismaDailyStore;
  const day = "2026-11-14";
  const c1 = await s.claim(day, 1, new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c1.claimed);
  // A round 1 saved before rounds existed: no `evaluated` list, no round in its stats.
  await s.finish(day, 1, c1.startedAt, { status: "COMPLETED", state: { v: 1, cursors: { HOTELS: 10 } }, stats, leads: [lead(1)] }, new Date());
  const both = await Promise.all([s.claim(day, 2, new Date("2026-11-14T06:20:00Z"), { retry: false }), s.claim(day, 2, new Date("2026-11-14T06:20:00Z"), { retry: false })]);
  assert.equal(both.filter((c) => c.claimed).length, 1, "round 2 is claimed once");
  const c2 = both.find((c) => c.claimed)!;
  assert.ok(c2.claimed);
  await s.finish(day, 2, c2.startedAt, {
    status: "COMPLETED", state: { v: 1, cursors: { HOTELS: 20 } }, stats: { ...stats, round: 2, exhausted: false },
    leads: [lead(11)], evaluated: { osmIds: ["node/11", "node/12"], sites: ["ok-11.ma", "ok-12.ma"] },
  }, new Date());

  const row2 = await client.discoverySweep.findUnique({ where: { id: "daily-agent-2026-11-14-r2" } });
  assert.deepEqual([row2.status, row2.query, row2.sector, row2.resultCount], ["COMPLETED", "DAILY_AGENT:2026-11-14:r2", "DAILY_AGENT", 1]);
  const rounds = await s.dayRounds(day);
  assert.deepEqual(rounds.map((r) => [r.round, r.status, r.leads, r.evaluated.osmIds.length]), [[1, "COMPLETED", 1, 0], [2, "COMPLETED", 1, 2]]);
  assert.deepEqual(await s.lastState(), { v: 1, cursors: { HOTELS: 20 } }, "the latest round's cursors carry on");
  assert.ok((await s.shown()).osmIds.has("node/11"));

  const view = await store.getTodayLeads(day);
  assert.deepEqual(view.leads.map((l) => l.name), ["Biz 1", "Biz 11"], "round by round");
  assert.deepEqual(view.rounds.map((r) => [r.round, r.leads]), [[1, 1], [2, 1]]);
  assert.equal(view.run?.round, 2);
  assert.deepEqual(view.continuation, { roundsUsed: 2, maxRounds: 3, leads: 2, canContinue: true, stopReason: null });
  // Another day's rounds are separate.
  assert.deepEqual(await s.dayRounds("2026-11-15"), []);
});

test("two simultaneous Continues through the real store: one round 2 row, no lead saved twice", { skip }, async () => {
  // Fake list and sites (no network): ok-* have a firm problem (no viewport), minor-* only SEO details.
  const html = (viewport: boolean) => `<!doctype html><html lang="fr"><head><title>Biz</title>${viewport ? `<meta name="viewport" content="width=device-width">` : ""}</head>
    <body><h1>Biz</h1><p>${"Une entreprise à Marrakech. ".repeat(40)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;
  // Barrier: once armed, every site fetch waits until both Continues have tried to lock round 2, so the round
  // that won the lock is still running when the other one tries (fake sites otherwise answer in a few ms).
  let gate: Promise<void> | null = null;
  let release = () => {};
  let roundTwoClaims = 0;
  const fetcher = async (url: string) => {
    if (gate) await gate;
    const u = new URL(url);
    const body = u.pathname === "/robots.txt" ? "User-agent: *\nDisallow:" : u.pathname === "/" ? html(u.hostname.startsWith("minor-")) : "";
    return { requestedUrl: url, finalUrl: url, status: body ? 200 : 404, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [] };
  };
  const entries = Array.from({ length: 40 }, (_, i) => i + 1).map((id) => ({
    id: `node/${id}`, name: `Biz ${id}`, sectors: ["HOTELS"], website: `https://${[5, 15, 16].includes(id) ? "ok" : "minor"}-${id}.ma`,
  }));
  const dataset = async () => ({
    version: 1, city: "Marrakech", source: "test", licence: "test", boundary: { wikidata: "Q101625", relation: 1, name: "Marrakesh" },
    osmDataUntil: null, generatedAt: "t", sectors: {}, sharedWebsites: 0, entries,
  }) as any;
  // The real Prisma store, only observed: each round-2 lock attempt is counted after it returns.
  const real = store.prismaDailyStore;
  const observed = {
    ...real,
    claim: async (...args: Parameters<typeof real.claim>) => {
      const result = await real.claim(...args);
      if (args[1] === 2 && ++roundTwoClaims === 2) release();
      return result;
    },
  };
  const base = { store: observed, dataset, loadCrm: async () => [], fetcher: fetcher as any };
  const day = "2026-11-14";

  const r1 = await agent.runDailyLeads({ ...base, now: () => new Date("2026-11-14T06:05:00Z") });
  assert.deepEqual([r1.result, r1.leads], ["COMPLETED", 1]);
  gate = new Promise<void>((resolve) => { release = resolve; });
  // Safety net so a broken barrier fails the assertions below instead of hanging the job.
  const fallback = setTimeout(() => release(), 30_000);
  const cont = { ...base, now: () => new Date("2026-11-14T06:20:00Z"), retry: true, continueRound: true, expectDay: day };
  const [a, b] = await Promise.all([agent.runDailyLeads(cont), agent.runDailyLeads(cont)]);
  clearTimeout(fallback);
  assert.equal(roundTwoClaims, 2, "both Continues tried to lock round 2");
  assert.deepEqual([a.result, b.result].sort(), ["ALREADY_RUNNING", "COMPLETED"], "exactly one Continue runs");

  const sweeps = await client.discoverySweep.findMany({ where: { provider: "DAILY_AGENT" }, orderBy: { id: "asc" } });
  assert.deepEqual(sweeps.map((x: any) => [x.id, x.status]), [["daily-agent-2026-11-14", "COMPLETED"], ["daily-agent-2026-11-14-r2", "COMPLETED"]], "no round 3, no second round 2");
  const rows = await client.discoveryResult.findMany({ where: { sweep: { provider: "DAILY_AGENT" } } });
  const urls = rows.map((r: any) => r.sourceUrl);
  assert.equal(new Set(urls).size, urls.length, "no lead saved twice");
  assert.deepEqual(urls.sort(), ["https://www.openstreetmap.org/node/15", "https://www.openstreetmap.org/node/16", "https://www.openstreetmap.org/node/5"]);
  const view = await store.getTodayLeads(day);
  assert.deepEqual([view.leads.length, view.continuation.roundsUsed, view.continuation.canContinue], [3, 2, true]);
});
