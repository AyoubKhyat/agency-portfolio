/**
 * Daily Lead Agent contact discovery: own-site Contact/About pages, explicit links only, robots.txt respected,
 * and contactability as a tie-breaker that never beats a more serious problem. Fake sites; no network, no DB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { AuditedCandidate } from "../src/lib/batch-discovery";
import type { OsmDataset, OsmEntry } from "../src/lib/osm-dataset";
import type { DailyLead, DailyStore } from "../src/lib/daily-leads";

let lc: typeof import("../src/lib/lead-contacts");
let dl: typeof import("../src/lib/daily-leads");
test.before(async () => {
  lc = await import("../src/lib/lead-contacts");
  dl = await import("../src/lib/daily-leads");
});

const res = (url: string, body: string, status = 200, finalUrl = url): SafeResponse => ({
  requestedUrl: url, finalUrl, status, headers: {}, body, bytes: body.length, truncated: false, ms: 100, hops: [],
});
const html = (links: string, text = "Riad à Marrakech, réservez votre séjour. ".repeat(20)) =>
  `<!doctype html><html><head><title>R</title><meta name="viewport" content="width=device-width"></head><body><h1>R</h1><p>${text}</p>${links}</body></html>`;

/** A site map: path → body (string) or status (number). Records every URL fetched. */
function site(pages: Record<string, string | number>, opts: { redirectContactTo?: string } = {}) {
  const hits: string[] = [];
  const fetcher: SafeFetch = async (url) => {
    hits.push(url);
    const u = new URL(url);
    if (opts.redirectContactTo && u.pathname === "/contact") return res(url, html(""), 200, opts.redirectContactTo);
    const p = pages[u.pathname];
    if (p === undefined) return res(url, "", 404);
    return typeof p === "number" ? res(url, "", p) : res(url, p);
  };
  return { fetcher, hits };
}

/* ── extraction ── */

test("Contact/About pages: same site only, contact pages first, at most 2, no files, no other hosts", () => {
  const h = `<a href="/a-propos">A propos</a><a href="https://www.riad.ma/contact-us/">Contact</a><a href="/contactez-nous">Contactez</a>
    <a href="https://other.ma/contact">x</a><a href="/brochure-contact.pdf">pdf</a><a href="/">home</a><a href="mailto:a@riad.ma">m</a><a href="/chambres">rooms</a>`;
  assert.deepEqual(lc.contactPageLinks(h, "https://riad.ma/"), ["https://www.riad.ma/contact-us/", "https://riad.ma/contactez-nous"]);
  assert.deepEqual(lc.contactPageLinks('<a href="/about-us">a</a>', "https://riad.ma/"), ["https://riad.ma/about-us"]);
  assert.deepEqual(lc.contactPageLinks('<a href="/contactless-payment-info">x</a>', "https://riad.ma/"), [], "a word that only starts with contact isn't a contact page");
});

test("e-mail only from mailto: links, never from page text; placeholders dropped", () => {
  const h = `<p>Write to hidden@riad.ma</p><a href="mailto:Reservations@Riad.ma?subject=Hi">mail</a><a href="mailto:you@example.com">x</a><a href="mailto:not-an-email">y</a>`;
  assert.deepEqual(lc.extractMailtoEmails(h, "https://riad.ma/contact").map((c) => [c.value, c.link, c.sourceUrl]),
    [["reservations@riad.ma", "mailto:reservations@riad.ma", "https://riad.ma/contact"]]);
});

test("discovery: robots.txt, home, then the contact page; explicit WhatsApp/Instagram/e-mail with the exact page", async () => {
  const { fetcher, hits } = site({
    "/robots.txt": "User-agent: *\nDisallow: /a-propos",
    "/": html('<a href="/contact">Contact</a><a href="/a-propos">About</a><a href="tel:+212612345678">Call</a>'),
    "/contact": html(`<a href="https://wa.me/212612345678?text=Bonjour">WA</a><a href="https://www.instagram.com/riadfixture/">IG</a>
      <a href="https://www.instagram.com/p/ABC123/">a post</a><a href="https://wa.me/0612345678">national</a><a href="mailto:info@riad.ma">mail</a>`),
    "/a-propos": html('<a href="https://wa.me/212699999999">other</a>'),
  });
  const r = await lc.discoverSiteContacts("https://riad.ma/", { fetcher });
  assert.deepEqual(r.pagesRead, ["https://riad.ma/", "https://riad.ma/contact"]);
  assert.ok(!hits.some((h) => h.includes("/a-propos")), "robots.txt disallows the about page: never requested");
  assert.ok(hits.every((h) => new URL(h).hostname === "riad.ma"), "no social site or other host is ever fetched");
  assert.deepEqual(r.contacts.map((c) => [c.channel, c.link, c.sourceUrl]), [
    ["WHATSAPP", "https://wa.me/212612345678", "https://riad.ma/contact"],
    ["INSTAGRAM", "https://instagram.com/riadfixture", "https://riad.ma/contact"],
    ["EMAIL", "mailto:info@riad.ma", "https://riad.ma/contact"],
  ], "tel: link, a post URL and a national-format wa.me give nothing; the pre-filled text is dropped");
});

test("discovery stops safely: robots 5xx, home disallowed, a page leaving the site, limits", async () => {
  const down = site({ "/robots.txt": 503, "/": html('<a href="https://wa.me/212612345678">x</a>') });
  assert.deepEqual(await lc.discoverSiteContacts("https://riad.ma/", { fetcher: down.fetcher }), { contacts: [], pagesRead: [], signals: null });
  assert.deepEqual(down.hits, ["https://riad.ma/robots.txt"]);

  const closed = site({ "/robots.txt": "User-agent: *\nDisallow: /", "/": html("") });
  assert.equal((await lc.discoverSiteContacts("https://riad.ma/", { fetcher: closed.fetcher })).pagesRead.length, 0);
  assert.equal(closed.hits.length, 1);

  const away = site({ "/robots.txt": "", "/": html('<a href="/contact">c</a>') }, { redirectContactTo: "https://elsewhere.ma/contact" });
  assert.deepEqual((await lc.discoverSiteContacts("https://riad.ma/", { fetcher: away.fetcher })).pagesRead, ["https://riad.ma/"]);

  const many = site({ "/robots.txt": "", "/": html('<a href="/contact">1</a><a href="/contact-us">2</a><a href="/about">3</a><a href="/a-propos">4</a>') });
  await lc.discoverSiteContacts("https://riad.ma/", { fetcher: many.fetcher });
  assert.equal(many.hits.length, 2 + lc.MAX_EXTRA_PAGES, "robots + home + at most 2 pages");

  let t = 0;
  const slow = site({ "/robots.txt": "", "/": html('<a href="/contact">c</a>'), "/contact": html("") });
  const r = await lc.discoverSiteContacts("https://riad.ma/", { fetcher: slow.fetcher, now: () => (t += 7_000) });
  assert.ok(r.pagesRead.length < 2, "the per-site time budget stops further pages");
});

test("discovery records each linked Contact page: read, fully parsed, and its contact options (About pages aren't)", async () => {
  const works = site({
    "/robots.txt": "User-agent: *\nDisallow:",
    "/": html('<a href="/contact">Contact</a><a href="/a-propos">About</a>'),
    "/contact": html("", "Appelez-nous au 0524 43 21 00. ".repeat(10)), "/a-propos": html(""),
  });
  const r1 = await lc.discoverSiteContacts("https://riad.ma/", { fetcher: works.fetcher });
  assert.deepEqual(r1.contactPages, [{ url: "https://riad.ma/contact", read: true, complete: true, kinds: ["phone"] }]);
  const broken = site({ "/robots.txt": "User-agent: *\nDisallow:", "/": html('<a href="/contact">Contact</a>'), "/contact": 500 });
  const r2 = await lc.discoverSiteContacts("https://riad.ma/", { fetcher: broken.fetcher });
  assert.deepEqual(r2.contactPages, [{ url: "https://riad.ma/contact", read: false, complete: false, kinds: [] }]);
  const none = site({ "/robots.txt": "User-agent: *\nDisallow:", "/": html("") });
  assert.deepEqual((await lc.discoverSiteContacts("https://riad.ma/", { fetcher: none.fetcher })).contactPages, []);
});

/* ── ranking and confidence ── */

const finding = (id: string, observed = "None found") => ({ id, check: id, observed, sourceUrl: "s", fetchedAt: "t", sentence: id });
const audited = (name: string, ids: string[], score: number): AuditedCandidate => ({
  candidate: { sourceId: `node/${name}`, source: "OSM", name, sector: "HOTELS", city: "Marrakech", neighborhood: null, phone: null, whatsapp: null,
    website: `https://${name}.ma`, email: null, instagram: null, facebook: null, mapsUrl: null, rating: null, reviewCount: null },
  outcome: "COMPLETE", finalUrl: `https://${name}.ma/`, auditedAt: "t",
  findings: ids.map((id) => finding(id, id === "E_HTTPS" ? "http://x" : id === "E_RESPONSE_TIME" ? "5000 ms" : "None found")),
  otherProblems: [], score, whatsapp: { link: "", confidence: "NONE", sources: [], status: "UNVERIFIED" }, inCrm: null,
});
const wa = { channel: "WHATSAPP" as const, link: "https://wa.me/212612345678", source: "WEBSITE" as const, sourceUrl: "x" };
const ig = { channel: "INSTAGRAM" as const, link: "https://www.instagram.com/x/", source: "WEBSITE" as const, sourceUrl: "x" };
const em = { channel: "EMAIL" as const, link: "mailto:a@b.ma", value: "a@b.ma", source: "WEBSITE" as const, sourceUrl: "x" };

test("WhatsApp > Instagram > e-mail > nothing", () => {
  assert.deepEqual([["WHATSAPP"], ["INSTAGRAM", "EMAIL"], ["EMAIL"], ["FACEBOOK"], []].map((c) => lc.contactRank(c)), [3, 2, 1, 0, 0]);
});

test("ranking: serious problems first; contactability only decides between comparable ones", () => {
  const seoOnlyWithWhatsApp = { audited: audited("seo", ["E_DESCRIPTION", "E_OPEN_GRAPH", "E_TITLE"], 30), contacts: [wa] };
  const httpsNoContact = { audited: audited("https", ["E_HTTPS"], 10), contacts: [] };
  const httpsWithEmail = { audited: audited("httpsmail", ["E_HTTPS"], 8), contacts: [em] };
  const httpsWithInsta = { audited: audited("httpsig", ["E_HTTPS"], 8), contacts: [ig] };
  const twoSerious = { audited: audited("two", ["E_HTTPS", "E_CONTACT"], 5), contacts: [] };
  const order = dl.rankWebsiteLeads([seoOnlyWithWhatsApp, httpsNoContact, httpsWithEmail, twoSerious, httpsWithInsta]).map((x) => x.audited.candidate.name);
  assert.deepEqual(order, ["two", "httpsig", "httpsmail", "https", "seo"]);
});

test("WhatsApp confidence: same number from OSM and site HIGH, one source MEDIUM, different numbers CONFLICT", () => {
  const osmWa = { ...wa, source: "OSM_TAG" as const };
  assert.equal(dl.whatsappConfidenceOf([osmWa, wa]), "HIGH");
  assert.equal(dl.whatsappConfidenceOf([wa]), "MEDIUM");
  assert.equal(dl.whatsappConfidenceOf([wa, { ...wa, link: "https://wa.me/212699999999" }]), "CONFLICT");
  assert.equal(dl.whatsappConfidenceOf([ig, em]), "NONE");
});

/* ── end to end ── */

function memStore() {
  let saved: DailyLead[] = [];
  let stats: unknown = null;
  const store: DailyStore = {
    dayRounds: async () => [],
    claim: async (_d, _r, now) => ({ claimed: true, startedAt: now }),
    lastState: async () => dl.EMPTY_STATE,
    shown: async () => ({ osmIds: new Set(), sites: new Set() }),
    finish: async (_d, _r, _s, o) => { if (o.status === "COMPLETED") { saved = o.leads; stats = o.stats; } },
  };
  return { store, leads: () => saved, stats: () => stats as { contactPagesRead: number; inCrmByContact: number } };
}
const entry = (id: number, host: string): OsmEntry => ({ id: `node/${id}`, name: host, sectors: ["HOTELS"], website: `https://${host}.ma` });
const ds = (entries: OsmEntry[]): OsmDataset => ({ version: 1, city: "Marrakech", source: "t", licence: "t", boundary: { wikidata: "Q", relation: 1, name: "M" }, osmDataUntil: null, generatedAt: "t", sectors: {}, sharedWebsites: 0, entries });

/** Every site: same problems on the home page (no viewport, no description, no link preview); some link a contact page. */
const noViewport = (body: string) => body.replace('<meta name="viewport" content="width=device-width">', "");
const multiSite: SafeFetch = async (url) => {
  const u = new URL(url);
  const h = u.hostname.split(".")[0];
  if (u.pathname === "/robots.txt") return res(url, "User-agent: *\nDisallow:");
  if (u.pathname === "/") return res(url, noViewport(html('<a href="/contact">Contact</a><a href="mailto:hi@x.ma">m</a>')));
  if (u.pathname === "/contact") {
    if (h === "reachable") return res(url, html('<a href="https://wa.me/212611112222">WhatsApp</a>'));
    if (h === "known") return res(url, html('<a href="https://wa.me/212633334444">WhatsApp</a>'));
    return res(url, html(""));
  }
  return res(url, "", 404);
};

test("a run reads contact pages, records where each contact was found, prefers the reachable lead, drops CRM matches", async () => {
  const m = memStore();
  const crm = async () => [{ id: "c", name: "Someone", phone: "+212633334444", email: "", website: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" }];
  await dl.runDailyLeads({ store: m.store, dataset: async () => ds([entry(1, "aaa-plain"), entry(2, "reachable"), entry(3, "known")]), loadCrm: crm, fetcher: multiSite, now: () => new Date("2026-11-14T06:05:00Z") });
  const leads = m.leads();
  assert.deepEqual(leads.map((l) => l.name), ["reachable", "aaa-plain"], "same problems: the WhatsApp-reachable one first; the CRM match is gone");
  const w = leads[0].contacts.find((c) => c.channel === "WHATSAPP")!;
  assert.deepEqual([w.link, w.source, w.sourceUrl], ["https://wa.me/212611112222", "WEBSITE", "https://reachable.ma/contact"]);
  assert.equal(leads[0].whatsappConfidence, "MEDIUM");
  assert.ok(leads.every((l) => l.contacts.some((c) => c.channel === "EMAIL" && new URL(c.sourceUrl).pathname === "/")), "the home page mailto: is kept, with its page");
  assert.equal(m.stats().inCrmByContact, 1);
  assert.ok(m.stats().contactPagesRead >= 4);
});

test("guarantees: own site only, no AI, no paid API, nothing marked verified", () => {
  const src = readFileSync(new URL("../src/lib/lead-contacts.ts", import.meta.url), "utf8");
  assert.match(src, /import \{ anchorHrefs, notARealPage, parsePage, robotsAllows \} from "@\/lib\/website-audit\/checks"/);
  assert.match(src, /import \{ safeFetch, type SafeFetch, type SafeResponse \} from "@\/lib\/website-audit\/safe-fetch"/);
  assert.doesNotMatch(src, /@\/lib\/ai|googleapis|graph\.facebook|i\.instagram|VERIFIED"/);
  const card = readFileSync(new URL("../src/components/admin/todays-leads.tsx", import.meta.url), "utf8");
  assert.match(card, /\(unverified, \{c\.source === "OSM_TAG" \? "from the OSM tag" : <>found on <a href=\{c\.sourceUrl\}/);
  assert.match(card, /Different WhatsApp numbers found: check which is current/);
});
