/**
 * Daily Lead Agent rounds: up to 3 manual rounds of 12 checks a day, until 5 leads or the list is exhausted.
 * In-memory store with the Prisma store's rules (one lock per round), fake list, fake websites. No DB, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { OsmDataset, OsmEntry } from "../src/lib/osm-dataset";
import type { AgentState, DailyLead, DailyStore, DayRound, RunOutcome } from "../src/lib/daily-leads";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
let m: typeof import("../src/lib/daily-leads");
test.before(async () => { m = await import("../src/lib/daily-leads"); });

/* ── fakes (as in daily-leads.test.ts) ── */

const res = (url: string, body: string, status = 200): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [],
});
/** ok-*: no viewport (a firm customer-facing problem). minor-*: SEO details only, never a lead. */
const page = `<!doctype html><html lang="fr"><head><title>Biz</title></head>
  <body><h1>Biz</h1><p>${"Une entreprise à Marrakech. ".repeat(40)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;
const seoOnlyPage = page.replace("<title>Biz</title>", `<title>Biz</title><meta name="viewport" content="width=device-width">`);

function makeFetcher() {
  const homeHits: string[] = [];
  const fetcher: SafeFetch = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/") homeHits.push(u.hostname);
    if (u.pathname === "/robots.txt") return res(url, "User-agent: *\nDisallow:");
    if (u.pathname === "/" && u.hostname.startsWith("minor-")) return res(url, seoOnlyPage);
    if (u.pathname === "/") return res(url, page);
    return res(url, "", 404);
  };
  return { fetcher, homeHits };
}

const e = (id: number, sector: string, over: Partial<OsmEntry> = {}): OsmEntry =>
  ({ id: `node/${id}`, name: `Biz ${id}`, sectors: [sector], website: `https://ok-${id}.ma`, ...over });
/** One sector, `n` businesses; the ids in `ok` qualify, every other one is SEO-only. Each round reads 10 of them. */
const hotels = (n: number, ok: number[], over: (id: number) => Partial<OsmEntry> = () => ({})) =>
  Array.from({ length: n }, (_, i) => i + 1).map((id) => e(id, "HOTELS", { website: `https://${ok.includes(id) ? "ok" : "minor"}-${id}.ma`, ...over(id) }));

function dataset(entries: OsmEntry[]): OsmDataset {
  return {
    version: 1, city: "Marrakech", source: "test", licence: "test", boundary: { wikidata: "Q101625", relation: 1, name: "Marrakesh" },
    osmDataUntil: "2026-11-09T00:00:00Z", generatedAt: "2026-11-10T00:00:00Z", sectors: {}, sharedWebsites: 0, entries,
  };
}

function memStore() {
  type Run = { day: string; round: number; status: "RUNNING" | "COMPLETED" | "FAILED"; startedAt: Date; outcome?: RunOutcome };
  const runs = new Map<string, Run>();
  const saved: { day: string; round: number; lead: DailyLead }[] = [];
  const key = (day: string, round: number) => (round === 1 ? day : `${day}-r${round}`);
  let finishes = 0;
  const store: DailyStore = {
    async dayRounds(day) {
      return [...runs.values()].filter((r) => r.day === day).sort((a, b) => a.round - b.round).map((r) => {
        const o = r.outcome?.status === "COMPLETED" ? r.outcome : null;
        return {
          round: r.round, status: r.status, startedAt: r.startedAt,
          leads: o?.leads.length ?? 0, noWebsiteLeads: o?.leads.filter((l) => l.kind === "NO_WEBSITE").length ?? 0,
          exhausted: o?.stats.exhausted === true, evaluated: o?.evaluated ?? { osmIds: [], sites: [] },
        };
      });
    },
    async claim(day, round, now, { retry }) {
      const r = runs.get(key(day, round));
      if (!r) { runs.set(key(day, round), { day, round, status: "RUNNING", startedAt: now }); return { claimed: true, startedAt: now }; }
      if (r.status === "COMPLETED") return { claimed: false, status: "COMPLETED" };
      const stale = r.status === "RUNNING" && now.getTime() - r.startedAt.getTime() > m.STALE_RUN_MS;
      if (stale || (r.status === "FAILED" && retry)) { r.status = "RUNNING"; r.startedAt = now; return { claimed: true, startedAt: now }; }
      return { claimed: false, status: r.status };
    },
    async lastState(): Promise<AgentState> {
      const done = [...runs.values()].filter((r) => r.outcome).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      return done[0]?.outcome?.state ?? m.EMPTY_STATE;
    },
    async shown() {
      return { osmIds: new Set(saved.map((s) => s.lead.osmId)), sites: new Set(saved.filter((s) => s.lead.website).map((s) => new URL(s.lead.website).hostname)) };
    },
    async finish(day, round, startedAt, outcome) {
      const r = runs.get(key(day, round));
      if (!r || r.status !== "RUNNING" || r.startedAt !== startedAt) throw new m.LostClaimError("lost");
      finishes++;
      r.status = outcome.status; r.outcome = outcome;
      if (outcome.status === "COMPLETED") for (const lead of outcome.leads) saved.push({ day, round, lead });
    },
  };
  return { store, runs, saved, finishes: () => finishes };
}

const at = (iso: string) => () => new Date(iso);
const DAY = "2026-11-14";
const T = (hhmm: string) => at(`${DAY}T${hhmm}:00Z`);
const noCrm = async () => [];
const outcomeOf = (s: ReturnType<typeof memStore>, k: string) => {
  const o = s.runs.get(k)?.outcome;
  assert.ok(o && o.status === "COMPLETED", `${k} completed`);
  return o as Extract<RunOutcome, { status: "COMPLETED" }>;
};

/* ── pure planning ── */

const round = (n: number, over: Partial<DayRound> = {}): DayRound => ({
  round: n, status: "COMPLETED", startedAt: new Date(0), leads: 0, noWebsiteLeads: 0, exhausted: false, evaluated: { osmIds: [], sites: [] }, ...over,
});

test("planRound / continuationOf: first round, retry or takeover of the same round, continue only when allowed", () => {
  assert.deepEqual(m.planRound([], { continueRound: false }), { kind: "RUN", round: 1 });
  assert.deepEqual(m.planRound([], { continueRound: true }), { kind: "RUN", round: 1 }, "a Continue on an empty day is round 1");
  assert.deepEqual(m.planRound([round(1, { status: "RUNNING" })], { continueRound: true }), { kind: "RUN", round: 1 }, "the claim decides: running or stale");
  assert.deepEqual(m.planRound([round(1), round(2, { status: "FAILED" })], { continueRound: false }), { kind: "RUN", round: 2 }, "a failed round is retried as itself");
  assert.deepEqual(m.planRound([round(1, { leads: 1 })], { continueRound: false }), { kind: "STOP", result: "ALREADY_COMPLETED" }, "Run never continues");
  assert.deepEqual(m.planRound([round(1, { leads: 1 })], { continueRound: true }), { kind: "RUN", round: 2 });
  assert.deepEqual(m.planRound([round(1, { leads: 3 }), round(2, { leads: 2 })], { continueRound: true }), { kind: "STOP", result: "TARGET_REACHED" });
  assert.deepEqual(m.planRound([round(1), round(2), round(3)], { continueRound: true }), { kind: "STOP", result: "NO_ROUNDS_LEFT" });
  assert.deepEqual(m.planRound([round(1), round(2, { exhausted: true })], { continueRound: true }), { kind: "STOP", result: "EXHAUSTED" });
  assert.deepEqual(m.planRound([round(1, { leads: 5 })], { continueRound: true }), { kind: "STOP", result: "TARGET_REACHED" }, "a full first round: nothing to continue");

  const c = m.continuationOf([round(2, { leads: 1 }), round(1, { leads: 2 })]);
  assert.deepEqual(c, { roundsUsed: 2, maxRounds: 3, leads: 3, canContinue: true, stopReason: null }, "rounds in any order");
  assert.equal(m.continuationOf([round(1), round(2, { status: "RUNNING" })]).canContinue, false);
  assert.equal(m.continuationOf([round(1), round(2, { status: "FAILED" })]).stopReason, null, "a failure is not a stop: it is retried");
  assert.equal(m.continuationOf([]).roundsUsed, 0);
  assert.equal(m.MAX_ROUNDS, 3);
});

test("legacy: a day saved before rounds (round 1 only, no checked list) reads as round 1 and can be continued", () => {
  assert.equal(m.runId(DAY), "daily-agent-2026-11-14", "round 1 keeps the original id");
  assert.equal(m.runId(DAY, 1), "daily-agent-2026-11-14");
  assert.equal(m.runId(DAY, 2), "daily-agent-2026-11-14-r2");
  assert.equal(m.runQuery(DAY, 3), "DAILY_AGENT:2026-11-14:r3");
  assert.deepEqual(m.planRound([round(1, { leads: 1 })], { continueRound: true }), { kind: "RUN", round: 2 });
});

/* ── full runs ── */

test("three rounds: each carries on from the cursors, no site is checked twice, the day stops after round 3 under target", async () => {
  const s = memStore();
  const { fetcher, homeHits } = makeFetcher();
  const list = hotels(40, [5, 15, 25, 35]);
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };

  const r1 = await m.runDailyLeads({ ...deps, now: T("06:05") });
  assert.deepEqual([r1.result, r1.round, r1.leads, r1.checked], ["COMPLETED", 1, 1, 10]);
  assert.equal(outcomeOf(s, DAY).stats.round, 1);
  assert.equal(outcomeOf(s, DAY).stats.skipped.checkedToday, undefined, "round 1 looks exactly as before");
  assert.equal((await m.runDailyLeads({ ...deps, now: T("06:10"), retry: true })).result, "ALREADY_COMPLETED", "Run (no Continue) still never repeats a day");

  const hosts1 = new Set(homeHits.splice(0));
  const r2 = await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r2.result, r2.round, r2.leads, r2.checked], ["COMPLETED", 2, 1, 10]);
  const hosts2 = new Set(homeHits.splice(0));
  const r3 = await m.runDailyLeads({ ...deps, now: T("06:40"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r3.result, r3.round, r3.leads, r3.checked], ["COMPLETED", 3, 1, 10]);
  const hosts3 = new Set(homeHits.splice(0));

  for (const h of hosts2) assert.ok(!hosts1.has(h), `${h} checked in rounds 1 and 2`);
  for (const h of hosts3) assert.ok(!hosts1.has(h) && !hosts2.has(h), `${h} checked twice`);
  assert.deepEqual(s.saved.map((x) => [x.round, x.lead.osmId]), [[1, "node/5"], [2, "node/15"], [3, "node/25"]]);
  assert.ok(s.runs.has(`${DAY}-r2`) && s.runs.has(`${DAY}-r3`), "each round has its own lock");

  const r4 = await m.runDailyLeads({ ...deps, now: T("07:00"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r4.result, r4.leads, r4.checked], ["NO_ROUNDS_LEFT", 0, 0]);
  assert.equal(s.finishes(), 3);
  const c = m.continuationOf(await s.store.dayRounds(DAY));
  assert.deepEqual(c, { roundsUsed: 3, maxRounds: 3, leads: 3, canContinue: false, stopReason: "NO_ROUNDS_LEFT" }, "3 of 5: never padded");
});

test("early target: a round saves only what is missing from 5, then the day stops", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(hotels(30, [1, 2, 3, 11, 12, 13, 14, 15])), loadCrm: noCrm, fetcher };
  assert.equal((await m.runDailyLeads({ ...deps, now: T("06:05") })).leads, 3);
  const r2 = await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r2.result, r2.leads], ["COMPLETED", 2], "5 qualified in round 2, but only 2 were missing");
  assert.equal(s.saved.length, m.MAX_LEADS);
  const r3 = await m.runDailyLeads({ ...deps, now: T("06:40"), retry: true, continueRound: true, expectDay: DAY });
  assert.equal(r3.result, "TARGET_REACHED");
  assert.equal(s.runs.has(`${DAY}-r3`), false, "no round row is created once the target is reached");
  // The ones not saved today stay available for another day (they were checked, not shown).
  const shown = await s.store.shown();
  assert.equal(shown.osmIds.size, 5);
});

test("a full first round (5 leads, 2 without a website) leaves nothing to continue", async () => {
  const list: OsmEntry[] = [...hotels(12, [1, 2, 3, 4, 5]), e(100, "HOTELS", { website: "", whatsapp: "https://wa.me/212612340001" }), e(101, "HOTELS", { website: "", instagram: "https://www.instagram.com/b101" })];
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };
  assert.equal((await m.runDailyLeads({ ...deps, now: T("06:05") })).leads, 5);
  assert.equal((await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY })).result, "TARGET_REACHED");
});

test("no-website leads stay within 2 a day across rounds", async () => {
  const list: OsmEntry[] = [
    ...hotels(20, []),
    e(100, "HOTELS", { website: "", whatsapp: "https://wa.me/212612340001" }), e(101, "HOTELS", { website: "", instagram: "https://www.instagram.com/b101" }),
    e(102, "HOTELS", { website: "", instagram: "https://www.instagram.com/b102" }), e(103, "HOTELS", { website: "", instagram: "https://www.instagram.com/b103" }),
  ];
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };
  assert.equal((await m.runDailyLeads({ ...deps, now: T("06:05") })).leads, 2);
  const r2 = await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.equal(r2.result, "COMPLETED");
  assert.equal(s.saved.filter((x) => x.lead.kind === "NO_WEBSITE").length, m.MAX_NO_WEBSITE);
});

test("two Continues at once: one round runs, the other is told it's already running; Continue during round 1 waits too", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(hotels(40, [5, 15])), loadCrm: noCrm, fetcher };
  await s.store.claim(DAY, 1, new Date(`${DAY}T06:00:00Z`), { retry: false });
  const during = await m.runDailyLeads({ ...deps, now: T("06:02"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([during.result, during.round], ["ALREADY_RUNNING", 1], "no round 2 while round 1 is running");
  s.runs.delete(DAY);

  await m.runDailyLeads({ ...deps, now: T("06:05") });
  const cont = { ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY };
  const [a, b] = await Promise.all([m.runDailyLeads(cont), m.runDailyLeads(cont)]);
  assert.deepEqual([a.result, b.result].sort(), ["ALREADY_RUNNING", "COMPLETED"]);
  assert.equal(s.finishes(), 2);
  const ids = s.saved.map((x) => x.lead.osmId);
  assert.equal(new Set(ids).size, ids.length, "no lead saved twice");
});

test("cross-round duplicates: the same site under another OSM id is not checked again, and a lead is never shown twice", async () => {
  // node/12 has node/3's (rejected) site and node/14 has node/5's (lead) site.
  const list = hotels(30, [5], (id) => (id === 12 ? { website: "https://minor-3.ma" } : id === 14 ? { website: "https://ok-5.ma" } : {}));
  const s = memStore();
  const { fetcher, homeHits } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...deps, now: T("06:05") });
  homeHits.splice(0);
  await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.ok(!homeHits.includes("minor-3.ma") && !homeHits.includes("ok-5.ma"));
  const st = outcomeOf(s, `${DAY}-r2`).stats;
  assert.equal(st.skipped.checkedToday, 1, "node/12: site checked in round 1");
  assert.equal(st.skipped.shownBefore, 1, "node/14: site shown as a lead in round 1");
  assert.deepEqual(s.saved.map((x) => x.lead.osmId), ["node/5"]);
});

test("a CRM match found in a later round is still left out", async () => {
  const list = hotels(30, [5, 15]);
  const crmRow = { id: "c1", name: "Someone", phone: "", email: "", website: "https://ok-15.ma", instagram: "", whatsappLink: "", neighborhood: "", sector: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" };
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: async () => [crmRow], fetcher };
  await m.runDailyLeads({ ...deps, now: T("06:05") });
  const r2 = await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.equal(r2.leads, 0);
  assert.equal(outcomeOf(s, `${DAY}-r2`).stats.skipped.inCrm, 1);
});

test("failure and retry: a failed round keeps earlier leads, is retried as the same round, and only by hand", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const list = hotels(40, [5, 15, 25]);
  const ok = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...ok, now: T("06:05") });

  const down = { ...ok, loadCrm: async () => { throw new Error("db password=secret"); } };
  const f = await m.runDailyLeads({ ...down, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([f.result, f.round], ["FAILED", 2]);
  assert.doesNotMatch(f.error ?? "", /secret|password/);
  assert.equal(s.saved.length, 1, "round 1's lead is kept");
  assert.equal(outcomeOf(s, DAY).stats.exhausted, false, "a failure is never read as exhaustion");
  assert.equal(m.continuationOf(await s.store.dayRounds(DAY)).stopReason, null, "a failure doesn't end the day");

  assert.deepEqual([(await m.runDailyLeads({ ...ok, now: T("06:25") })).result], ["FAILED_NEEDS_RETRY"], "the cron never retries a failed round");
  const again = await m.runDailyLeads({ ...ok, now: T("06:30"), retry: true });
  assert.deepEqual([again.result, again.round, again.leads], ["COMPLETED", 2, 1], "Try again reruns round 2, not round 3");
  const r3 = await m.runDailyLeads({ ...ok, now: T("06:45"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r3.result, r3.round], ["COMPLETED", 3], "the failed attempt didn't use up a round");
  assert.deepEqual(s.saved.map((x) => x.lead.osmId), ["node/5", "node/15", "node/25"]);
});

test("a crashed later round (still RUNNING after the limit) can be taken over; a live one can't", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(hotels(30, [5, 15])), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...deps, now: T("06:05") });
  await s.store.claim(DAY, 2, new Date(`${DAY}T06:20:00Z`), { retry: false });
  assert.equal((await m.runDailyLeads({ ...deps, now: T("06:22"), retry: true })).result, "ALREADY_RUNNING");
  const r = await m.runDailyLeads({ ...deps, now: T("06:40"), retry: true });
  assert.deepEqual([r.result, r.round], ["COMPLETED", 2]);
});

test("Casablanca rollover: a Continue for yesterday after midnight runs nothing; the new day starts at round 1", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(hotels(40, [5, 15, 25])), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...deps, now: T("20:00") });
  const late = new Date(`${DAY}T23:30:00Z`);
  const today = m.casablancaDay(late);
  assert.notEqual(today, DAY, "23:30 UTC is already the next day in Casablanca");
  const r = await m.runDailyLeads({ ...deps, now: () => late, retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r.result, r.day, r.leads, r.checked], ["DAY_CHANGED", today, 0, 0]);
  assert.equal(s.runs.size, 1, "nothing claimed for either day");
  const n = await m.runDailyLeads({ ...deps, now: () => late });
  assert.deepEqual([n.result, n.round, n.day], ["COMPLETED", 1, today]);
  assert.equal(s.saved.filter((x) => x.day === today).every((x) => x.lead.osmId !== "node/5"), true, "yesterday's lead isn't shown again");
});

test("exhaustion: once every sector is searched to its end with nothing left, the day stops (confirmed, not guessed)", async () => {
  const s = memStore();
  const { fetcher, homeHits } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(hotels(3, [])), loadCrm: noCrm, fetcher };
  const r1 = await m.runDailyLeads({ ...deps, now: T("06:05") });
  assert.deepEqual([r1.leads, r1.checked], [0, 3]);
  assert.equal(outcomeOf(s, DAY).stats.exhausted, false, "it checked something: not yet confirmed");
  homeHits.splice(0);
  const r2 = await m.runDailyLeads({ ...deps, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r2.result, r2.checked], ["COMPLETED", 0]);
  assert.deepEqual(homeHits, [], "the list started again, but nothing checked today was fetched again");
  assert.equal(outcomeOf(s, `${DAY}-r2`).stats.exhausted, true);
  const r3 = await m.runDailyLeads({ ...deps, now: T("06:40"), retry: true, continueRound: true, expectDay: DAY });
  assert.equal(r3.result, "EXHAUSTED");
  assert.equal(s.runs.has(`${DAY}-r3`), false);
});

test("an unreadable list is a failure to retry, never exhaustion", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const good = { store: s.store, dataset: async () => dataset(hotels(30, [5])), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...good, now: T("06:05") });
  const bad = await m.runDailyLeads({ ...good, dataset: async () => { throw new Error("blob 500"); }, now: T("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.equal(bad.result, "FAILED");
  const rounds = await s.store.dayRounds(DAY);
  assert.deepEqual(rounds.map((r) => [r.round, r.status, r.exhausted]), [[1, "COMPLETED", false], [2, "FAILED", false]]);
});

/* ── wiring ── */

test("Continue is owner or admin only, pins the day, and the cron never continues", () => {
  const route = read("src/app/api/admin/daily-leads/route.ts");
  assert.match(route, /z\.object\(\{ action: z\.literal\("continue"\), day: z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\) \}\)\.strict\(\)/);
  assert.match(route, /if \(parsed\.data\.action === "run" \|\| parsed\.data\.action === "continue"\) \{\s*if \(!isAdmin\(auth\.session\) && !\(await sessionIsOwner\(auth\.session\)\)\)/,
    "both start a run only for an owner or admin");
  assert.match(route, /runDailyLeadsNow\(\{ retry: true, continueRound: true, expectDay: parsed\.data\.day \}\)/);
  const cron = read("src/app/api/cron/daily-leads/route.ts");
  assert.match(cron, /runDailyLeadsNow\(\{ retry: false \}\)/);
  assert.doesNotMatch(cron, /continueRound|expectDay/);
  const src = ["src/lib/daily-leads.ts", "src/lib/daily-leads-store.ts", "src/lib/daily-leads-run.ts"].map(read).join("\n");
  assert.doesNotMatch(src, /@\/lib\/ai|anthropic|openai|groq|googleapis|serpapi/i, "still no AI or paid API");
});

test("Today's card: Continue only for owner/admin while allowed, leads stay visible during a later round, plain stop reasons", () => {
  const card = read("src/components/admin/todays-leads.tsx");
  assert.match(card, /const continueButton = \(\) => view\?\.canRun && view\.continuation\.canContinue && \(/);
  assert.match(card, /\{ action, day: view\?\.day \}/, "Continue sends the day on screen");
  for (const s of ["Continue: check up to 12 more websites", "Today's target of 5 is reached.", "No more businesses to check today in the Marrakech list.",
    "rounds used today.", "being prepared since", "The leads below are kept.", "already checked in an earlier round today", "Midnight has passed in Casablanca"]) {
    assert.ok(card.includes(s), s);
  }
});
