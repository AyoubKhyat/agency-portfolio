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
  const both = await Promise.all([store.prismaDailyStore.claim("2026-11-14", now, { retry: false }), store.prismaDailyStore.claim("2026-11-14", now, { retry: false })]);
  assert.equal(both.filter((c) => c.claimed).length, 1);
  const row = await client.discoverySweep.findUnique({ where: { id: "daily-agent-2026-11-14" } });
  assert.equal(row.status, "RUNNING");
  assert.equal(row.sector, "DAILY_AGENT", "kept out of the legacy per-sector coverage");
});

test("finish saves leads once; a completed day can't be claimed again, even with retry", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c = await s.claim("2026-11-14", new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c.claimed);
  await s.finish("2026-11-14", c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: { HOTELS: 3 } }, stats, leads: [lead(1), lead(2, { kind: "NO_WEBSITE", website: "", outcome: null, contacts: [{ channel: "WHATSAPP", link: "https://wa.me/212612345678", source: "OSM_TAG", sourceUrl: "x" }] })] }, new Date());
  await assert.rejects(s.finish("2026-11-14", c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats, leads: [lead(3)] }, new Date()), agent.LostClaimError);
  assert.deepEqual(await s.claim("2026-11-14", new Date("2026-11-14T09:00:00Z"), { retry: true }), { claimed: false, status: "COMPLETED" });

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

test("a FAILED day keeps the previous cursors and can be retried only on request; a crashed RUNNING one can be taken over", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c1 = await s.claim("2026-11-13", new Date("2026-11-13T06:00:00Z"), { retry: false });
  assert.ok(c1.claimed);
  await s.finish("2026-11-13", c1.startedAt, { status: "COMPLETED", state: { v: 1, cursors: { HOTELS: 7 } }, stats, leads: [] }, new Date());
  const c2 = await s.claim("2026-11-14", new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c2.claimed);
  await s.finish("2026-11-14", c2.startedAt, { status: "FAILED", state: await s.lastState(), stats: null, error: "The CRM couldn't be read" }, new Date());
  assert.deepEqual(await s.lastState(), { v: 1, cursors: { HOTELS: 7 } });
  assert.deepEqual(await s.claim("2026-11-14", new Date("2026-11-14T06:30:00Z"), { retry: false }), { claimed: false, status: "FAILED" });
  const retried = await s.claim("2026-11-14", new Date("2026-11-14T08:00:00Z"), { retry: true });
  assert.ok(retried.claimed);
  assert.deepEqual(await s.claim("2026-11-14", new Date("2026-11-14T08:02:00Z"), { retry: true }), { claimed: false, status: "RUNNING" }, "a live run isn't taken over");
  const takeover = await s.claim("2026-11-14", new Date("2026-11-14T08:30:00Z"), { retry: false });
  assert.ok(takeover.claimed, "still RUNNING after the limit: crashed, taken over");
  await assert.rejects(s.finish("2026-11-14", retried.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats, leads: [lead(1)] }, new Date()), agent.LostClaimError, "the crashed run can't save afterwards");
});

test("marking an import links the lead once and counts it on the day", { skip }, async () => {
  const s = store.prismaDailyStore;
  const c = await s.claim("2026-11-14", new Date("2026-11-14T06:00:00Z"), { retry: false });
  assert.ok(c.claimed);
  await s.finish("2026-11-14", c.startedAt, { status: "COMPLETED", state: { v: 1, cursors: {} }, stats, leads: [lead(1)] }, new Date());
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
