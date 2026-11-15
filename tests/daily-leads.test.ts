/**
 * Daily Lead Agent v1: an in-memory store, a fake OSM list, fake websites and an in-memory CRM.
 * No database, no network, no AI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { OsmDataset, OsmEntry } from "../src/lib/osm-dataset";
import type { AgentState, DailyLead, DailyStore, RunOutcome } from "../src/lib/daily-leads";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
let m: typeof import("../src/lib/daily-leads");
test.before(async () => { m = await import("../src/lib/daily-leads"); });

/* ── fakes ── */

const res = (url: string, body: string, status = 200): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [],
});
const page = `<!doctype html><html lang="fr"><head><title>Biz</title><meta name="viewport" content="width=device-width"></head>
  <body><h1>Biz</h1><p>${"Une entreprise à Marrakech. ".repeat(40)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;

/** Host prefix decides the site: ok-* readable with problems, robots-* asks not to be read, down-* fails, err-* 500. */
function makeFetcher() {
  const homeHits: string[] = [];
  const fetcher: SafeFetch = async (url) => {
    const u = new URL(url);
    if (u.protocol === "http:") return { ...res(url, "", 301), headers: { location: url.replace("http:", "https:") } };
    if (u.pathname === "/") homeHits.push(u.hostname);
    if (u.hostname.startsWith("down-")) throw new Error("connection refused");
    if (u.hostname.startsWith("err-")) return res(url, "oops", 500);
    if (u.pathname === "/robots.txt") return res(url, u.hostname.startsWith("robots-") ? "User-agent: *\nDisallow: /" : "User-agent: *\nDisallow:");
    if (u.pathname === "/") return res(url, page);
    return res(url, "", 404);
  };
  return { fetcher, homeHits };
}

const e = (id: number, sector: string, over: Partial<OsmEntry> = {}): OsmEntry =>
  ({ id: `node/${id}`, name: `Biz ${id}`, sectors: [sector], website: `https://ok-${id}.ma`, ...over });

function dataset(entries: OsmEntry[]): OsmDataset {
  return {
    version: 1, city: "Marrakech", source: "test", licence: "test", boundary: { wikidata: "Q101625", relation: 1, name: "Marrakesh" },
    osmDataUntil: "2026-11-09T00:00:00Z", generatedAt: "2026-11-10T00:00:00Z", sectors: {}, sharedWebsites: 0, entries,
  };
}

/** Same rules as the Prisma store: the day is the lock, finish only while the claim holds. */
function memStore() {
  const runs = new Map<string, { status: "RUNNING" | "COMPLETED" | "FAILED"; startedAt: Date; outcome?: RunOutcome }>();
  const saved: { day: string; lead: DailyLead }[] = [];
  let finishes = 0;
  const store: DailyStore = {
    async claim(day, now, { retry }) {
      const r = runs.get(day);
      if (!r) { runs.set(day, { status: "RUNNING", startedAt: now }); return { claimed: true, startedAt: now }; }
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
    async finish(day, startedAt, outcome) {
      const r = runs.get(day);
      if (!r || r.status !== "RUNNING" || r.startedAt !== startedAt) throw new m.LostClaimError("lost");
      finishes++;
      r.status = outcome.status; r.outcome = outcome;
      if (outcome.status === "COMPLETED") for (const lead of outcome.leads) saved.push({ day, lead });
    },
  };
  return { store, runs, saved, finishes: () => finishes };
}

const at = (iso: string) => () => new Date(iso);
const DAY1 = "2026-11-14T06:05:00Z";
const DAY2 = "2026-11-15T06:05:00Z";
const noCrm = async () => [];

/* ── pure helpers ── */

test("the day is Casablanca's calendar day from the tz database (its offset has changed over time, so not hardcoded)", () => {
  const tz = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  for (const iso of ["2026-11-14T06:00:00Z", "2026-11-14T23:30:00Z", "2027-02-20T23:30:00Z", "2027-07-01T23:30:00Z"]) {
    assert.equal(m.casablancaDay(new Date(iso)), tz(new Date(iso)), iso);
  }
  assert.match(m.casablancaDay(new Date()), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(m.casablancaDay(new Date("2026-11-14T12:00:00Z")), "2026-11-14", "midday UTC is the same day under any Moroccan offset");
  assert.equal(m.TIME_ZONE, "Africa/Casablanca");
});

test("sector rotation: 3 different sectors a day, every sector gets a turn, same day = same pick", () => {
  const all = ["A", "B", "C", "D", "E", "F", "G"];
  const seen = new Set<string>();
  for (let d = 1; d <= 7; d++) {
    const day = `2026-12-0${d}`;
    const pick = m.rotateSectors(day, all);
    assert.equal(new Set(pick).size, 3);
    assert.deepEqual(pick, m.rotateSectors(day, all));
    pick.forEach((s) => seen.add(s));
  }
  assert.equal(seen.size, all.length);
  assert.deepEqual(m.rotateSectors("2026-12-01", ["A", "B"]), ["A", "B"], "fewer sectors than a day's share: all of them");
});

test("interleave takes turns and stops at the cap", () => {
  assert.deepEqual(m.interleave([[1, 2, 3, 4, 5], [10], [20, 21]], 5), [1, 10, 20, 2, 21]);
});

test("no-website leads need an explicit WhatsApp or Instagram tag; a Facebook page alone isn't enough", () => {
  assert.equal(m.contactOnly(e(1, "RIADS", { website: "", whatsapp: "https://wa.me/212612345678" })), true);
  assert.equal(m.contactOnly(e(1, "RIADS", { website: "", instagram: "https://www.instagram.com/x" })), true);
  assert.equal(m.contactOnly(e(1, "RIADS", { website: "", facebook: "https://www.facebook.com/x" })), false);
  assert.equal(m.contactOnly(e(1, "RIADS", { website: "", whatsapp: "+212612345678" })), false, "a bare number isn't an explicit link");
  assert.equal(m.contactOnly(e(1, "RIADS")), false, "has a website");
});

/* ── full runs ── */

function bigList() {
  const list: OsmEntry[] = [];
  let id = 1;
  for (const sector of ["HOTELS", "RIADS", "RESTAURANTS", "CAFES"]) {
    for (let i = 0; i < 8; i++, id++) {
      const kind = i % 4 === 1 ? "robots" : i % 4 === 2 ? "down" : i % 4 === 3 ? "err" : "ok";
      list.push(e(id, sector, { website: `https://${kind}-${id}.ma` }));
    }
    list.push(e(id++, sector, { website: "", whatsapp: "https://wa.me/212612340000".replace("0000", String(1000 + id)) }));
    list.push(e(id++, sector, { website: "", instagram: `https://www.instagram.com/biz${id}` }));
    list.push(e(id++, sector, { website: "" })); // nothing to go on: never a lead
  }
  return list;
}

test("a run: at most 12 sites checked, at most 5 leads, at most 2 without a website, evidence only", async () => {
  const s = memStore();
  const { fetcher, homeHits } = makeFetcher();
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher, now: at(DAY1) });
  assert.equal(r.result, "COMPLETED");
  assert.ok(r.checked <= m.MAX_SITE_CHECKS && r.checked > 0, `checked ${r.checked}`);
  assert.ok(new Set(homeHits).size <= m.MAX_SITE_CHECKS);
  const leads = s.saved.map((x) => x.lead);
  assert.ok(leads.length > 0 && leads.length <= m.MAX_LEADS);
  const noSite = leads.filter((l) => l.kind === "NO_WEBSITE");
  assert.equal(noSite.length, m.MAX_NO_WEBSITE, "no-website businesses with an explicit tag are found even past the checked sites");
  assert.equal(leads.length, m.MAX_LEADS);
  assert.ok(leads.findIndex((l) => l.kind === "NO_WEBSITE") >= leads.filter((l) => l.kind === "WEBSITE").length, "website evidence first");
  for (const l of leads) {
    if (l.kind === "WEBSITE") {
      assert.equal(l.outcome, "COMPLETE", "only a site read completely can be a lead");
      assert.match(new URL(l.website).hostname, /^ok-/, "unreadable, robots-blocked and failing sites never become leads");
      assert.ok(l.findings.length > 0 && l.findings.every((f) => f.observed && f.sourceUrl && f.fetchedAt));
    } else {
      assert.equal(l.website, "");
      assert.ok(l.contacts.length > 0 && l.contacts.every((c) => c.source === "OSM_TAG"));
    }
    for (const c of l.contacts) if (c.channel === "WHATSAPP") assert.match(c.link, /^https:\/\/wa\.me\/\d+$/);
  }
  const outcome = s.runs.get("2026-11-14")!.outcome!;
  assert.equal(outcome.status, "COMPLETED");
  if (outcome.status === "COMPLETED") {
    assert.equal(outcome.stats.sectors.length, 3);
    assert.ok((outcome.stats.outcomes.UNREADABLE ?? 0) + (outcome.stats.outcomes.ROBOTS_DISALLOWED ?? 0) > 0, "failures are counted, not hidden");
    for (const k of outcome.stats.sectors) assert.ok(outcome.state.cursors[k] > 0, `${k} moved on`);
  }
});

test("idempotent: a second call the same day does nothing; the next day continues and never repeats a lead", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...deps, now: at(DAY1) });
  const firstLeads = s.saved.length;
  const again = await m.runDailyLeads({ ...deps, now: at("2026-11-14T06:40:00Z") });
  assert.equal(again.result, "ALREADY_COMPLETED");
  const manual = await m.runDailyLeads({ ...deps, now: at("2026-11-14T09:00:00Z"), retry: true });
  assert.equal(manual.result, "ALREADY_COMPLETED", "a completed day is never re-run, even by hand");
  assert.equal(s.saved.length, firstLeads);
  assert.equal(s.finishes(), 1);

  const before = new Set(s.saved.map((x) => x.lead.osmId));
  const day2 = await m.runDailyLeads({ ...deps, now: at(DAY2) });
  assert.equal(day2.result, "COMPLETED");
  const day2Leads = s.saved.filter((x) => x.day === "2026-11-15").map((x) => x.lead.osmId);
  for (const id of day2Leads) assert.ok(!before.has(id), `${id} was shown already`);
  assert.ok(s.saved.some((x) => x.day === "2026-11-15" && x.lead.kind === "NO_WEBSITE"), "no-website leads not picked on day 1 come back");
  const nameless = bigList().filter((x) => !x.website && !x.whatsapp && !x.instagram).map((x) => x.id);
  assert.ok(s.saved.every((x) => !nameless.includes(x.lead.osmId)), "an entry with nothing to go on is never a lead");
});

test("two calls at once: one runs, the other is told it's already running", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const deps = { store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher, now: at(DAY1) };
  const [a, b] = await Promise.all([m.runDailyLeads(deps), m.runDailyLeads(deps)]);
  assert.deepEqual([a.result, b.result].sort(), ["ALREADY_RUNNING", "COMPLETED"]);
  assert.equal(s.finishes(), 1);
});

test("CRM duplicates are left out, with or without a website", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const list = [
    e(1, "HOTELS", { website: "https://ok-1.ma" }),
    e(2, "HOTELS", { website: "https://ok-2.ma" }),
    e(3, "HOTELS", { website: "", whatsapp: "https://wa.me/212611111111" }),
    e(4, "HOTELS", { website: "", instagram: "https://www.instagram.com/knownig" }),
  ];
  const crm = async () => [
    { id: "c1", name: "Someone", phone: "", email: "", website: "https://ok-1.ma", instagram: "", whatsappLink: "", neighborhood: "", sector: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" },
    { id: "c2", name: "Other", phone: "+212611111111", email: "", website: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" },
    { id: "c3", name: "Third", phone: "", email: "", website: "", instagram: "knownig", whatsappLink: "", neighborhood: "", sector: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" },
  ];
  await m.runDailyLeads({ store: s.store, dataset: async () => dataset(list), loadCrm: crm, fetcher, now: at(DAY1) });
  assert.deepEqual(s.saved.map((x) => x.lead.osmId), ["node/2"]);
});

test("failures: list unreadable or CRM unreadable → FAILED with a plain reason, nothing saved, retry only by hand", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const broken = { store: s.store, dataset: async () => { throw new Error("blob 403 secret-token"); }, loadCrm: noCrm, fetcher };
  const r = await m.runDailyLeads({ ...broken, now: at(DAY1) });
  assert.equal(r.result, "FAILED");
  assert.match(r.error ?? "", /business list couldn't be read/);
  assert.doesNotMatch(r.error ?? "", /secret|403/, "no internals in the message");
  assert.equal(s.saved.length, 0);
  assert.equal((await m.runDailyLeads({ ...broken, now: at("2026-11-14T06:30:00Z") })).result, "FAILED_NEEDS_RETRY", "the schedule doesn't loop on a failure");

  const crmDown = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(bigList()), loadCrm: async () => { throw new Error("db"); }, fetcher, now: at("2026-11-14T07:00:00Z"), retry: true });
  assert.equal(crmDown.result, "FAILED");
  assert.match(crmDown.error ?? "", /duplicates couldn't be ruled out/);

  const fixed = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher, now: at("2026-11-14T07:30:00Z"), retry: true });
  assert.equal(fixed.result, "COMPLETED");
});

test("a crashed run (still RUNNING after the limit) can be taken over; a live one can't", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  await s.store.claim("2026-11-14", new Date("2026-11-14T06:00:00Z"), { retry: false });
  const deps = { store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher };
  assert.equal((await m.runDailyLeads({ ...deps, now: at("2026-11-14T06:03:00Z") })).result, "ALREADY_RUNNING");
  assert.equal((await m.runDailyLeads({ ...deps, now: at("2026-11-14T06:30:00Z") })).result, "COMPLETED");
});

test("time limit: no new checks start after it, and the unchecked sites wait for the next day", async () => {
  const s = memStore();
  const { fetcher, homeHits } = makeFetcher();
  let t = 0;
  const clock = () => (t += 100_000); // every check of the clock moves time on 100 s
  const r = await m.runDailyLeads({ store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher, now: at(DAY1), clock });
  assert.equal(r.result, "COMPLETED");
  assert.ok(r.checked <= 3, `checked ${r.checked}`);
  assert.ok(new Set(homeHits).size <= 3);
  const out = s.runs.get("2026-11-14")!.outcome!;
  assert.ok(out.status === "COMPLETED" && out.stats.stoppedEarly);
  // Day 2 starts with the sites day 1 didn't reach.
  const { fetcher: f2, homeHits: hits2 } = makeFetcher();
  await m.runDailyLeads({ store: s.store, dataset: async () => dataset(bigList()), loadCrm: noCrm, fetcher: f2, now: at(DAY2) });
  assert.ok(hits2.length > 0);
});

test("an exhausted sector starts again from the top, and what was shown stays out", async () => {
  const s = memStore();
  const { fetcher } = makeFetcher();
  const small = [e(1, "HOTELS"), e(2, "HOTELS")];
  const deps = { store: s.store, dataset: async () => dataset(small), loadCrm: noCrm, fetcher };
  await m.runDailyLeads({ ...deps, now: at(DAY1) });
  assert.equal(s.saved.length, 2);
  const out = s.runs.get("2026-11-14")!.outcome!;
  assert.equal(out.state.cursors.HOTELS, 0, "end of the list → start again next time");
  const r2 = await m.runDailyLeads({ ...deps, now: at(DAY2) });
  assert.equal(r2.result, "COMPLETED");
  assert.equal(s.saved.length, 2, "nothing shown twice");
});

/* ── wiring and guarantees ── */

test("cron secret: required, at least 16 characters, exact Bearer match", async () => {
  const { cronAuthorized } = await import("../src/lib/daily-leads-run");
  const secret = "s".repeat(32);
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(cronAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(cronAuthorized(secret, secret), false);
  assert.equal(cronAuthorized(null, secret), false);
  assert.equal(cronAuthorized("Bearer short", "short"), false, "a short secret is refused");
  assert.equal(cronAuthorized("Bearer ", undefined), false, "no secret configured → nobody");
});

test("no cron is scheduled yet (added separately once CRON_SECRET and the dataset are set); the route stays authenticated", () => {
  const scheduled = existsSync(new URL("../vercel.json", import.meta.url)) ? JSON.parse(read("vercel.json")).crons ?? [] : [];
  assert.deepEqual(scheduled.filter((c: { path?: string }) => c.path === "/api/cron/daily-leads"), [], "the schedule ships in its own PR");
  const route = read("src/app/api/cron/daily-leads/route.ts");
  assert.match(route, /if \(!cronAuthorized\(req\.headers\.get\("authorization"\)\)\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(route, /export const maxDuration = 300;/);
  const admin = read("src/app/api/admin/daily-leads/route.ts");
  assert.match(admin, /const auth = await requireTeam\(\);/);
  assert.match(admin, /if \(!isAdmin\(auth\.session\) && !\(await sessionIsOwner\(auth\.session\)\)\)/, "running by hand is owner/admin only");
  assert.match(admin, /allowPossibleDuplicates: false/, "import re-checks duplicates through the existing route");
});

test("no AI, no paid API, no Prospect writes, no messages in the agent", () => {
  const src = ["src/lib/daily-leads.ts", "src/lib/daily-leads-store.ts", "src/lib/daily-leads-run.ts", "src/app/api/cron/daily-leads/route.ts"].map(read).join("\n");
  assert.doesNotMatch(src, /@\/lib\/ai|getAiProvider|anthropic|openai|groq|gemini/i);
  assert.doesNotMatch(src, /googleapis|places\.googleapis|GOOGLE_PLACES|serpapi/i);
  assert.doesNotMatch(src, /prospect\.(create|update|upsert|delete)|outreachMessage|sendWhatsApp|nodemailer|emailjs/i);
  assert.doesNotMatch(read("src/lib/daily-leads.ts"), /normalizePhoneMA|phone:\s*e\./, "a phone is never made into a contact");
  const store = read("src/lib/daily-leads-store.ts");
  assert.doesNotMatch(store, /aiSummary:|websiteSummary:|suggestedOffer:|opportunityExplanation:/, "the AI text fields stay empty");
  assert.match(store, /aiProvider: "NONE"/);
});

test("Today shows the card with review, import and the empty/failed states", () => {
  const page = read("src/app/admin/page.tsx");
  assert.match(page, /<TodaysLeads \/>/);
  const card = read("src/components/admin/todays-leads.tsx");
  for (const s of ["Not prepared yet today.", "Couldn&apos;t prepare today&apos;s leads.", "No business met the bar today.", "Review evidence", "Import to prospects", "Imported · open prospect", "No website listed in OpenStreetMap", "unverified", "nothing is sent automatically"]) {
    assert.ok(card.includes(s), s);
  }
});
