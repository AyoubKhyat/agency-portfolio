/**
 * Website-to-business identity check for Daily Lead Agent leads. Fake pages modelled on what real sites serve;
 * no network, no database, no AI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { OsmDataset, OsmEntry } from "../src/lib/osm-dataset";
import type { DailyLead, DailyStore, RunStats } from "../src/lib/daily-leads";
import { assessIdentity, identitySignals, distinctiveWords } from "../src/lib/lead-identity";

const page = (head: string, body = "") => `<!doctype html><html><head>${head}</head><body><h1>x</h1><p>${body}</p></body></html>`;
const sig = (head: string, url: string, body = "") => identitySignals(page(head, body), url);
const check = (name: string, head: string, url: string, body = "") => assessIdentity(name, sig(head, url, body));

/** The pattern lemarrakchi.com serves: title, og:site_name, JSON-LD and domain all say "Le Marrakchi". */
const LE_MARRAKCHI = `<title>Le Marrakchi - Restaurant Marrakech Rooftop - Restaurant marocain</title>
  <meta property="og:site_name" content="Le Marrakchi">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Le Marrakchi"},{"@type":"Restaurant","name":"Le Marrakchi"}]}</script>`;

test("La Farmacie listed with lemarrakchi.com: the site is clearly another business → MISMATCH", () => {
  const r = check("La Farmacie", LE_MARRAKCHI, "https://lemarrakchi.com/", "Restaurant marocain sur les toits de la médina. Réservez une table.");
  assert.equal(r.status, "MISMATCH");
  assert.equal(r.siteName, "Le Marrakchi");
  assert.match(r.reason, /presents itself as "Le Marrakchi".*never mentions "La Farmacie"/);
});

test("the preview's real matches: brand in the title, accents and HTML entities handled", () => {
  assert.equal(check("Patisserie Amandine", "<title>Amandine Marrakech — Pâtisserie &amp; Salon de thé</title>", "http://www.amandinemarrakech.com/").status, "MATCH");
  assert.equal(check("Henna Art Cafe", "<title>Marrakech henna art cafe &#8211; Marrakech</title>", "https://marrakechhennaartcafe.com/").status, "MATCH");
  assert.equal(check("Café Arabe", "<title>Café Arabe</title>", "https://cafearabe.com/").status, "MATCH");
  assert.equal(check("Riad Yasmine", "<title>Home</title>", "https://riadyasmine.com/").status, "MATCH", "the domain alone is enough to match");
});

test("trading names, parent brands and legitimate redirects are not mismatches", () => {
  assert.equal(check("Riad Yasmine", "<title>Maisons du Sud | Riad Yasmine</title>", "https://maisonsdusud.com/riad-yasmine").status, "MATCH", "a group site naming the riad");
  const parent = check("Riad Yasmine", '<title>Dar Collection</title><meta property="og:site_name" content="Dar Collection">', "https://darcollection.com/", "Our houses: Riad Yasmine, Riad Lune.");
  assert.equal(parent.status, "UNVERIFIED", "named only in the page text of a parent brand's site: unsure, not a mismatch");
  assert.equal(check("Kosybar", '<title>Kozybar</title><meta property="og:site_name" content="Kozybar">', "https://kozybar.ma/").status, "UNVERIFIED", "a spelling variant is never a mismatch");
  assert.equal(check("Le Marrakshi", LE_MARRAKCHI, "https://lemarrakchi.com/").status, "UNVERIFIED", "a transliteration is never a mismatch");
  // A redirect to a new domain: the page actually served is what's compared.
  assert.equal(check("Atlas Tours", "<title>Atlas Tours Morocco</title>", "https://atlas-tours-morocco.com/").status, "MATCH");
});

test("multilingual and generic names stay UNVERIFIED instead of being called a mismatch", () => {
  assert.equal(check("مطعم الفنا", LE_MARRAKCHI, "https://lemarrakchi.com/").status, "UNVERIFIED");
  assert.equal(check("Restaurant Marrakech", LE_MARRAKCHI, "https://lemarrakchi.com/").status, "UNVERIFIED");
  assert.deepEqual(distinctiveWords("La Pâtisserie du Riad Marrakech"), [], "only generic words: nothing distinctive");
});

test("weak evidence is UNVERIFIED: one signal with another name, a generic title, or no page read", () => {
  assert.equal(check("La Farmacie", "<title>Atlas Tours</title>", "https://site123.example/").status, "UNVERIFIED", "a single signal is not strong evidence");
  assert.equal(check("La Farmacie", "<title>Accueil</title>", "https://x.ma/").status, "UNVERIFIED");
  assert.equal(assessIdentity("La Farmacie", null).status, "UNVERIFIED");
  assert.equal(check("La Farmacie", '<script type="application/ld+json">{broken</script><title>Home</title>', "https://x.ma/").status, "UNVERIFIED", "broken JSON-LD is ignored");
});

/* ── end to end ── */

const res = (url: string, body: string, status = 200): SafeResponse => ({ requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 100, hops: [] });
const text = "Une adresse à Marrakech. ".repeat(30);
const sites: Record<string, string> = {
  "lemarrakchi.ma": page(LE_MARRAKCHI, `${text}<a href="https://wa.me/212644445555">WhatsApp</a><a href="mailto:hello@lemarrakchi.com">m</a>`),
  "cafe-fixture.ma": page("<title>Cafe Fixture</title>", `${text}<a href="mailto:hi@cafe-fixture.ma">m</a>`),
  "unsure.ma": page("<title>Accueil</title>", text),
};
const fetcher: SafeFetch = async (url) => {
  const u = new URL(url);
  if (u.pathname === "/robots.txt") return res(url, "User-agent: *\nDisallow:");
  return u.pathname === "/" && sites[u.hostname] ? res(url, sites[u.hostname]) : res(url, "", 404);
};
const entry = (id: number, name: string, host: string): OsmEntry => ({ id: `node/${id}`, name, sectors: ["RESTAURANTS"], website: `https://${host}` });
const ds = (entries: OsmEntry[]): OsmDataset => ({ version: 1, city: "Marrakech", source: "t", licence: "t", boundary: { wikidata: "Q", relation: 1, name: "M" }, osmDataUntil: null, generatedAt: "t", sectors: {}, sharedWebsites: 0, entries });

test("a run holds the mismatched site for review with nothing attached, and labels the unsure one", async () => {
  const dl = await import("../src/lib/daily-leads");
  let leads: DailyLead[] = [];
  let stats: RunStats | null = null;
  const store: DailyStore = {
    dayRounds: async () => [],
    claim: async (_d, _r, now) => ({ claimed: true, startedAt: now }), lastState: async () => dl.EMPTY_STATE,
    shown: async () => ({ osmIds: new Set(), sites: new Set() }),
    finish: async (_d, _r, _s, o) => { if (o.status === "COMPLETED") { leads = o.leads; stats = o.stats; } },
  };
  await dl.runDailyLeads({
    store, loadCrm: async () => [], fetcher, now: () => new Date("2026-11-14T06:05:00Z"),
    dataset: async () => ds([entry(1, "La Farmacie", "lemarrakchi.ma"), entry(2, "Cafe Fixture", "cafe-fixture.ma"), entry(3, "Bistro Inconnu", "unsure.ma")]),
  });
  assert.deepEqual(leads.map((l) => [l.name, l.identity?.status]).sort(), [["Bistro Inconnu", "UNVERIFIED"], ["Cafe Fixture", "MATCH"]]);
  const all = JSON.stringify(leads);
  assert.ok(!all.includes("212644445555") && !all.includes("lemarrakchi"), "the other business's contacts are attached to nobody");
  const review = stats!.identityReview!;
  assert.equal(review.length, 1);
  assert.deepEqual([review[0].name, review[0].siteName, new URL(review[0].website).hostname], ["La Farmacie", "Le Marrakchi", "lemarrakchi.ma"]);
  assert.ok(!("findings" in review[0]) && !("contacts" in review[0]), "nothing about the site is attached to the business");
});

test("the card shows the unverified label and the manual-review list without changing the layout", () => {
  const card = readFileSync(new URL("../src/components/admin/todays-leads.tsx", import.meta.url), "utf8");
  assert.match(card, /Website identity unverified: \{lead\.identity\.reason\}/);
  assert.match(card, /Held for manual review · website may belong to another business/);
  assert.match(card, /Not ranked, and no website problems or contacts were attached\./);
  const src = readFileSync(new URL("../src/lib/lead-identity.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|@\/lib\/ai|googleapis/, "no request and no AI in the identity check");
});
