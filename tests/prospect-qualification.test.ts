/**
 * P6A prospect qualification: one website in, evidence-backed problems, contact links found on it and existing
 * prospects that match out. Fake network and an in-memory prospect list: no database, no AI, nothing written.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { ProspectRow } from "../src/lib/prospect-qualification";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

let mod: typeof import("../src/lib/prospect-qualification");
test.before(async () => {
  mod = await import("../src/lib/prospect-qualification");
});

const AT = "2026-11-10T09:00:00.000Z";
const SRC = "https://www.riad-atlas.ma/contact";

const CONTACT_HTML = `<!doctype html><html lang="fr"><head><title>Riad Atlas</title></head><body>
  <a href="https://wa.me/212625461645">WhatsApp</a>
  <a href="https://api.whatsapp.com/send?phone=212625461645&text=Bonjour%20Sara">Same number, with text</a>
  <a href="https://wa.me/message/ABCDEF123">Short link</a>
  <a href="https://wa.me/0625461645">National number</a>
  <a href="https://chat.whatsapp.com/InviteCode">Group</a>
  <a href="https://www.instagram.com/Riad.Atlas/?igsh=abc">Instagram</a>
  <a href="https://instagram.com/riad.atlas">Instagram again</a>
  <a href="https://instagram.com/p/C0dE/">A post</a>
  <a href="https://instagram.com/explore/tags/riad">Explore</a>
  <a href="tel:+212625461645">Call</a><a href="mailto:sara@riad-atlas.ma">Mail</a>
  <!-- <a href="https://wa.me/212600000001">old number</a> -->
  <script>var x = '<a href="https://instagram.com/hidden.account">';</script>
</body></html>`;

test("WhatsApp and Instagram links are taken from the page with their source, never guessed", () => {
  const found = mod.extractContactLinks(CONTACT_HTML, SRC, AT);
  assert.ok(found.every((c) => c.status === "FOUND_ON_SITE" && c.sourceUrl === SRC && c.fetchedAt === AT));

  const wa = found.filter((c) => c.channel === "WHATSAPP");
  assert.deepEqual(wa.map((c) => [c.value, c.link, c.note]), [
    ["+212 6 25 46 16 45", "https://wa.me/212625461645", null],
    ["", "https://wa.me/message/ABCDEF123", "Short link: the number isn't shown"],
    ["", "", "WhatsApp link without a readable number"],
  ], "the same number once, no pre-filled text, no country guessed for 06..., no group invite");

  const ig = found.filter((c) => c.channel === "INSTAGRAM");
  assert.deepEqual(ig.map((c) => [c.value, c.link]), [["@riad.atlas", "https://instagram.com/riad.atlas"]]);

  const all = JSON.stringify(found);
  assert.doesNotMatch(all, /Bonjour|Sara|hidden\.account|212600000001|InviteCode|C0dE/);
});

test("a page full of links gives at most 10 per channel", () => {
  const html = Array.from({ length: 30 }, (_, i) => `<a href="https://instagram.com/shop${i}">x</a>`).join("");
  assert.equal(mod.extractContactLinks(html, SRC, AT).length, 10);
});

/* ───────────────── Duplicates ───────────────── */

const row = (over: Partial<ProspectRow>): ProspectRow => ({
  id: "p0", name: "", phone: "", email: "", website: "", instagram: "", whatsappLink: "",
  whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED", ...over,
});
const CRM: ProspectRow[] = [
  row({ id: "p1", name: "Riad Atlas", website: "https://riad-atlas.ma" }),
  row({ id: "p2", name: "Another riad", whatsappLink: "https://wa.me/212625461645", whatsappStatus: "VERIFIED" }),
  row({ id: "p3", name: "Same phone", phone: "06 25 46 16 45" }),
  row({ id: "p4", name: "Insta only", instagram: "@Riad.Atlas", instagramStatus: "VERIFIED" }),
  row({ id: "p5", name: "Unrelated", website: "https://other.ma", phone: "0611111111", instagram: "other" }),
  row({ id: "p6", name: "" }),
];

test("prospects sharing the domain, a linked number or a linked Instagram account are found; others are not", () => {
  const matches = mod.matchProspects({ websites: ["riad-atlas.ma"], phones: ["+212 6 25 46 16 45"], instagramHandles: ["riad.atlas"] }, CRM);
  const by = Object.fromEntries(matches.map((m) => [m.prospectId, m]));
  assert.deepEqual(Object.keys(by).sort(), ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(by.p1.reasons, ["Same website domain"]);
  assert.deepEqual(by.p2.reasons, ["Same WhatsApp number"]);
  assert.deepEqual(by.p3.reasons, ["Same phone number"]);
  assert.deepEqual(by.p4.reasons, ["Same Instagram account"]);
  assert.equal(by.p2.whatsappStatus, "VERIFIED", "a person's verification on the record is shown as it is");
  assert.equal(mod.matchProspects({ websites: [], phones: [], instagramHandles: [] }, CRM).length, 0, "an empty name matches nothing");
});

/* ───────────────── The whole check, with a fake network ───────────────── */

const PAGE_HTML = `<!doctype html><html lang="fr"><head><title>Riad Atlas</title>
  <meta name="viewport" content="width=device-width"></head><body><h1>Riad Atlas</h1>
  <p>${"Riad traditionnel dans la médina de Marrakech. ".repeat(20)}</p>
  <a href="https://wa.me/212625461645">WhatsApp</a><a href="https://instagram.com/riad.atlas">Instagram</a></body></html>`;
const res = (url: string, body: string, status = 200): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [],
});
function net(routes: Record<string, string | number>, requested: string[] = []): SafeFetch {
  return async (url) => {
    requested.push(new URL(url).pathname);
    const r = routes[new URL(url).pathname];
    if (r === undefined) return res(url, "", 404);
    return typeof r === "number" ? res(url, "", r) : res(url, r);
  };
}
const now = new Date().toISOString().slice(0, 10);

test("problems come with what was seen and where; contacts are FOUND_ON_SITE; matches come from the CRM", async () => {
  const r = await mod.qualifyWebsite("www.riad-atlas.ma", {
    fetcher: net({ "/robots.txt": "User-agent: *\nDisallow:", "/": PAGE_HTML }),
    loadProspects: async () => CRM,
  });
  assert.equal(r.targetUrl, "https://www.riad-atlas.ma");
  assert.equal(r.outcome, "COMPLETE");
  const ids = r.problems.map((p) => p.id);
  for (const id of ["E_HTTP_REDIRECT", "E_HSTS", "E_DESCRIPTION", "E_CANONICAL", "E_SITEMAP"]) assert.ok(ids.includes(id) || r.unknown.some((u) => u.id === id), id);
  assert.ok(!ids.includes("E_TITLE") && !ids.includes("E_VIEWPORT"), "passing checks aren't problems");
  // The redirect check's proof is the plain-http address it asked; the rest are the page, robots.txt or sitemap.
  assert.ok(r.problems.every((p) => /^https?:\/\/www\.riad-atlas\.ma(?:\/|$)/.test(p.sourceUrl) && p.fetchedAt.startsWith(now) && p.observed), JSON.stringify(r.problems));

  assert.deepEqual(r.contacts.map((c) => [c.channel, c.value, c.status]), [["WHATSAPP", "+212 6 25 46 16 45", "FOUND_ON_SITE"], ["INSTAGRAM", "@riad.atlas", "FOUND_ON_SITE"]]);
  assert.ok(r.contacts.every((c) => c.sourceUrl === r.finalUrl && c.fetchedAt.startsWith(now)));
  assert.ok(r.duplicates.checked);
  assert.deepEqual(r.duplicates.matches.map((m) => m.prospectId).sort(), ["p1", "p2", "p3", "p4"]);
  assert.doesNotMatch(JSON.stringify(r.contacts), /VERIFIED"/, "a contact on the site is never VERIFIED, even when a matching prospect's is");
});

test("a site that asks not to be read isn't read: no contacts, but the domain is still checked in the CRM", async () => {
  const requested: string[] = [];
  const r = await mod.qualifyWebsite("https://riad-atlas.ma/", {
    fetcher: net({ "/robots.txt": "User-agent: *\nDisallow: /", "/": PAGE_HTML }, requested),
    loadProspects: async () => CRM,
  });
  assert.equal(r.outcome, "ROBOTS_DISALLOWED");
  assert.deepEqual(requested, ["/robots.txt"]);
  assert.equal(r.contacts.length, 0);
  assert.ok(r.duplicates.checked && r.duplicates.matches.some((m) => m.prospectId === "p1"));
});

test("a bot check or error page gives no contacts", async () => {
  const challenge = `<html><head><script src="https://x.token.awswaf.com/c.js"></script></head><body><a href="https://wa.me/212625461645">x</a></body></html>`;
  const r = await mod.qualifyWebsite("riad-atlas.ma", { fetcher: net({ "/robots.txt": 404, "/": challenge }), loadProspects: async () => [] });
  assert.equal(r.outcome, "UNVERIFIED");
  assert.equal(r.contacts.length, 0);
  const err = await mod.qualifyWebsite("riad-atlas.ma", {
    fetcher: async (url) => (new URL(url).pathname === "/" ? res(url, PAGE_HTML, 500) : res(url, "", 404)), loadProspects: async () => [],
  });
  assert.equal(err.contacts.length, 0);
});

test("an address that isn't a public website is refused before anything is read; no CRM is reported as not checked", async () => {
  const requested: string[] = [];
  for (const bad of ["localhost", "javascript:alert(1)", "http://user:pw@site.ma", "not a url"]) {
    await assert.rejects(mod.qualifyWebsite(bad, { fetcher: net({}, requested), loadProspects: async () => [] }), mod.InvalidUrlError);
  }
  assert.equal(requested.length, 0);
  const noDb = await mod.qualifyWebsite("riad-atlas.ma", { fetcher: net({ "/robots.txt": 404, "/": PAGE_HTML }), loadProspects: async () => null });
  assert.deepEqual(noDb.duplicates, { checked: false, reason: "No database connected" });
  const down = await mod.qualifyWebsite("riad-atlas.ma", { fetcher: net({ "/robots.txt": 404, "/": PAGE_HTML }), loadProspects: async () => { throw new Error("db"); } });
  assert.deepEqual(down.duplicates, { checked: false, reason: "The CRM could not be read" });
});

test("read-only and admin-only: no AI, no writes, no import, no message", () => {
  const lib = read("src/lib/prospect-qualification.ts");
  const route = read("src/app/api/admin/prospect-qualification/route.ts");
  const page = read("src/app/admin/qualify/page.tsx");
  for (const src of [lib, route, page]) {
    assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$transaction/, "no database writes");
    assert.doesNotMatch(src, /@\/lib\/ai\b|@\/lib\/ai\/|ai-workforce|anthropic|groq|openai|gemini|logAudit|record-send|outreach\/|prospecting\/import|wa\.me\/\$\{/i, "no AI, no send, no import");
  }
  assert.match(route, /requireOwnerOrAdmin\(\)/);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.match(page, /FOUND_ON_SITE · not verified/);
  assert.match(page, /Only a person can mark a contact VERIFIED/);
  assert.doesNotMatch(page, /href=\{c\.link\}|href=\{p\.sourceUrl\}|href=\{c\.sourceUrl\}/, "addresses from someone else's site are shown, not linked");
});

test("page polish: singular problem, unbroken read time, top-bar title", () => {
  const page = read("src/app/admin/qualify/page.tsx");
  const layout = read("src/app/admin/layout.tsx");
  assert.match(page, /=== 1 \? "problem" : "problems"/, "'1 problem', not '1 problems'");
  assert.match(page, /whitespace-nowrap">read \{when\(fetchedAt\)\}/, "the read time never splits mid-word");
  assert.doesNotMatch(page, /break-all mt-1`\}>Source:/, "only the address may break anywhere");
  assert.match(layout, /qualify: "Check a website"/, "the top bar matches the menu label");
});
