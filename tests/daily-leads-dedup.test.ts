/**
 * Daily Lead Agent: one check per business and per website in a round, whichever sectors list it.
 * In-memory store (the Prisma store's rules), fake list and fake websites. No DB, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { OsmDataset, OsmEntry } from "../src/lib/osm-dataset";
import type { AgentState, DailyLead, DailyStore, RunOutcome } from "../src/lib/daily-leads";

let m: typeof import("../src/lib/daily-leads");
test.before(async () => { m = await import("../src/lib/daily-leads"); });

/* ── fakes ── */

const res = (url: string, body: string, status = 200): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [],
});
/** Default: no viewport (a firm customer-facing problem). minor-*: SEO details only, never a lead. */
const page = `<!doctype html><html lang="fr"><head><title>Biz</title></head>
  <body><h1>Biz</h1><p>${"Une entreprise à Marrakech. ".repeat(40)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;
const seoOnlyPage = page.replace("<title>Biz</title>", `<title>Biz</title><meta name="viewport" content="width=device-width">`);

function makeFetcher() {
  const robotsHits: string[] = [];
  const fetcher: SafeFetch = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/robots.txt") { robotsHits.push(u.hostname); return res(url, "User-agent: *\nDisallow:"); }
    if (u.hostname.startsWith("minor-")) return u.pathname === "/" ? res(url, seoOnlyPage) : res(url, "", 404);
    return res(url, page);
  };
  return { fetcher, robotsHits };
}

const e = (id: number, sectors: string[], website = `https://ok-${id}.ma`, over: Partial<OsmEntry> = {}): OsmEntry =>
  ({ id: `node/${id}`, name: `Biz ${id}`, sectors, website, ...over });

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
      if (r.status === "FAILED" && retry) { r.status = "RUNNING"; r.startedAt = now; return { claimed: true, startedAt: now }; }
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
      r.status = outcome.status; r.outcome = outcome;
      if (outcome.status === "COMPLETED") for (const lead of outcome.leads) saved.push({ day, round, lead });
    },
  };
  return { store, runs, saved };
}

const DAY = "2026-11-18";
const at = (hhmm: string) => () => new Date(`${DAY}T${hhmm}:00Z`);
const noCrm = async () => [];
const done = (s: ReturnType<typeof memStore>, k = DAY) => {
  const o = s.runs.get(k)?.outcome;
  assert.ok(o && o.status === "COMPLETED", `${k} completed`);
  return o as Extract<RunOutcome, { status: "COMPLETED" }>;
};
const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

/* ── the identity key ── */

test("roundSiteKey: one site whatever the spelling; shared platforms and path hosting keep businesses apart", () => {
  const k = m.roundSiteKey;
  assert.equal(k("http://www.Riad-X.ma/"), "riad-x.ma");
  assert.equal(k("https://riad-x.ma/fr/contact"), "riad-x.ma", "pages of one site are one site");
  assert.equal(k("riad-x.ma"), "riad-x.ma");
  assert.notEqual(k("https://alice.wixsite.com/spa"), k("https://alice.wixsite.com/riad"), "two Wix sites of one account");
  assert.notEqual(k("https://sites.google.com/view/dar-a"), k("https://sites.google.com/view/dar-b"), "two Google Sites");
  assert.notEqual(k("https://www.facebook.com/riad.a"), k("https://www.facebook.com/riad.b"));
  assert.equal(k("https://alice.wixsite.com/spa/"), k("https://alice.wixsite.com/spa"), "a trailing slash is the same site");
  assert.notEqual(k("https://bob.github.io/a"), k("https://bob.github.io/b"));
  assert.equal(k(""), null);
  assert.equal(k(null), null);
  assert.equal(k("not a url"), null);
});

test("oneLeadPerBusiness: a business never gets two cards; order and the first copy are kept", () => {
  const l = (osmId: string, sector: string) => ({ osmId, sector });
  assert.deepEqual(m.oneLeadPerBusiness([l("node/1", "HOTELS"), l("node/2", "SPAS"), l("node/1", "RIADS"), l("node/3", "SPAS")]),
    [l("node/1", "HOTELS"), l("node/2", "SPAS"), l("node/3", "SPAS")]);
  assert.deepEqual(m.oneLeadPerBusiness([]), []);
});

/* ── runs ── */

test("Hotels/Riads overlap: each riad is checked once, the 12 checks go to different businesses", async () => {
  // 6 riads tagged as hotels (in both lists), 8 plain hotels and 4 spas. A sector search stops at 10 sites, so
  // Hotels gives 10, Riads' 6 are all duplicates (0), and the spas fill the remaining 2 checks.
  const list = [
    ...Array.from({ length: 6 }, (_, i) => e(i + 1, ["HOTELS", "RIADS"], `https://minor-${i + 1}.ma`)),
    ...Array.from({ length: 8 }, (_, i) => e(i + 101, ["HOTELS"], `https://minor-${i + 101}.ma`)),
    ...Array.from({ length: 4 }, (_, i) => e(i + 201, ["SPAS"], `https://minor-${i + 201}.ma`)),
  ];
  const s = memStore();
  const { fetcher, robotsHits } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher, now: at("06:05") });
  assert.equal(r.result, "COMPLETED");
  const o = done(s);
  assert.deepEqual(dupes(o.evaluated!.osmIds), [], "no business checked twice");
  assert.deepEqual(dupes(robotsHits), [], "no site fetched twice");
  assert.equal(r.checked, 12, "the budget is filled with 12 different businesses");
  assert.equal(o.stats.skipped.duplicateInRound, 6, "the riads' second listing is skipped");
});

test("Event agencies/Wedding planners and Photographers/Videographers: checked once each", async () => {
  const list = [
    e(1, ["EVENT_AGENCIES", "WEDDING_PLANNERS"]), e(2, ["EVENT_AGENCIES", "WEDDING_PLANNERS"]), e(3, ["EVENT_AGENCIES"]),
    e(4, ["PHOTOGRAPHERS", "VIDEOGRAPHERS"]), e(5, ["PHOTOGRAPHERS", "VIDEOGRAPHERS"]), e(6, ["PHOTOGRAPHERS"]),
  ];
  const s = memStore();
  const { fetcher } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher, now: at("06:05") });
  const o = done(s);
  assert.equal(r.checked, 6);
  assert.deepEqual(dupes(o.evaluated!.osmIds), []);
  assert.equal(o.stats.skipped.duplicateInRound, 4);
  const ids = s.saved.map((x) => x.lead.osmId);
  assert.equal(ids.length, 5, "5 qualifying businesses, the cap");
  assert.deepEqual(dupes(ids), [], "one card per business");
});

test("one website under two OSM ids (two sectors) is checked once; the first sector searched keeps it", async () => {
  const list = [
    e(1, ["HOTELS"], "https://www.dar-x.ma/"),
    e(2, ["RESTAURANTS"], "http://dar-x.ma/fr/restaurant"),
    e(3, ["RESTAURANTS"], "https://other-y.ma"),
  ];
  const s = memStore();
  const { fetcher, robotsHits } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher, now: at("06:05") });
  assert.equal(r.checked, 2);
  const checked = done(s).evaluated!.osmIds;
  // Whichever sector the day's rotation searches first keeps it (on this day Restaurants comes before Hotels).
  assert.equal(checked.filter((id) => id === "node/1" || id === "node/2").length, 1, "the shared site is checked once");
  assert.deepEqual(done(s).evaluated!.sites.filter((k) => k === "dar-x.ma"), ["dar-x.ma"]);
  assert.ok(robotsHits.includes("dar-x.ma"));
  assert.equal(done(s).stats.skipped.duplicateInRound, 1);
  const leads = s.saved.map((x) => x.lead);
  assert.equal(leads.filter((l) => /dar-x\.ma/.test(l.website)).length, 1, "one lead for the shared site");
});

test("shared hosting: two businesses on one Wix account are both checked, never merged", async () => {
  const list = [e(1, ["SPAS"], "https://alice.wixsite.com/spa-a"), e(2, ["RIADS"], "https://alice.wixsite.com/riad-b")];
  const s = memStore();
  const { fetcher } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher, now: at("06:05") });
  assert.equal(r.checked, 2);
  assert.equal(done(s).stats.skipped.duplicateInRound, 0);
});

test("cursors: the overlapping sector moves past what the other one took, and the next round checks new businesses", async () => {
  // 30 riads listed in both Hotels and Riads; none qualifies (SEO-only), so nothing is ever shown.
  const list = Array.from({ length: 30 }, (_, i) => e(i + 1, ["HOTELS", "RIADS"], `https://minor-${i + 1}.ma`));
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };
  const r1 = await m.runDailyLeads({ ...deps, now: at("06:05") });
  const o1 = done(s);
  assert.equal(r1.checked, 10, "one sector's window; the other sector's copies are skipped");
  assert.equal(o1.stats.skipped.duplicateInRound, 10);
  assert.equal(o1.state.cursors.HOTELS, 10);
  assert.equal(o1.state.cursors.RIADS, 10, "the overlapping sector moved on too");

  const r2 = await m.runDailyLeads({ ...deps, now: at("06:20"), retry: true, continueRound: true, expectDay: DAY });
  assert.deepEqual([r2.result, r2.round, r2.checked], ["COMPLETED", 2, 10]);
  const o2 = done(s, `${DAY}-r2`);
  const both = [...o1.evaluated!.osmIds, ...o2.evaluated!.osmIds];
  assert.equal(both.length, 20);
  assert.deepEqual(dupes(both), [], "no business checked in both rounds");
  assert.deepEqual([o2.state.cursors.HOTELS, o2.state.cursors.RIADS], [20, 20]);
});

test("cross-round and in-round exclusions together: earlier rounds' businesses stay out, overlaps still checked once", async () => {
  // Hotels: shared riads s1..s10 first. Riads: its own r1..r10 first, then the same s1..s10.
  const shared = Array.from({ length: 10 }, (_, i) => e(i + 1, ["HOTELS", "RIADS"], `https://minor-s${i + 1}.ma`));
  const riadOnly = Array.from({ length: 10 }, (_, i) => e(i + 101, ["RIADS"], `https://minor-r${i + 1}.ma`));
  // sectorEntries keeps the list order: the Riads-only ones are listed first.
  const list = [...riadOnly, ...shared];
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...deps, now: at("06:05") });
  await m.runDailyLeads({ ...deps, now: at("06:20"), retry: true, continueRound: true, expectDay: DAY });
  await m.runDailyLeads({ ...deps, now: at("06:40"), retry: true, continueRound: true, expectDay: DAY });
  const all = [DAY, `${DAY}-r2`, `${DAY}-r3`].flatMap((k) => done(s, k).evaluated!.osmIds);
  assert.deepEqual(dupes(all), [], "nothing checked twice in the day, across sectors and rounds");
  assert.equal(new Set(all).size, 20, "every business checked once over the day");
  const later = [`${DAY}-r2`, `${DAY}-r3`].map((k) => done(s, k).stats.skipped);
  assert.ok(later.some((x) => (x.checkedToday ?? 0) > 0), "earlier rounds' businesses are skipped by the cross-round check");
});

test("CRM matches are still left out for a business listed in two sectors", async () => {
  const list = [e(1, ["HOTELS", "RIADS"], "https://ok-1.ma"), e(2, ["HOTELS", "RIADS"], "https://ok-2.ma")];
  const crm = async () => [{ id: "c1", name: "Someone", phone: "", email: "", website: "https://ok-1.ma", instagram: "", whatsappLink: "", neighborhood: "", sector: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" }];
  const s = memStore();
  const { fetcher, robotsHits } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: crm, fetcher, now: at("06:05") });
  assert.equal(r.checked, 1);
  assert.ok(!robotsHits.includes("ok-1.ma"), "the CRM match is never fetched");
  assert.deepEqual(s.saved.map((x) => x.lead.osmId), ["node/2"]);
});

test("no overlap: behaviour as before, nothing counted as a duplicate", async () => {
  const list = Array.from({ length: 6 }, (_, i) => e(i + 1, [i % 2 ? "HOTELS" : "SPAS"]));
  const s = memStore();
  const { fetcher } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: noCrm, fetcher, now: at("06:05") });
  assert.equal(r.checked, 6);
  assert.equal(done(s).stats.skipped.duplicateInRound, 0);
  assert.equal(r.leads, m.MAX_LEADS);
});

test("Today's card says when a business listed in two sectors was checked once", async () => {
  const { readFileSync } = await import("node:fs");
  const card = readFileSync(new URL("../src/components/admin/todays-leads.tsx", import.meta.url), "utf8");
  assert.ok(card.includes("listed in more than one sector, checked once"));
});
