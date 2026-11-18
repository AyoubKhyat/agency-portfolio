/**
 * P6B Stage 1: a first message drafted by code from a fresh website check. Fake network and in-memory CRM:
 * no database, no AI, nothing written or sent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";
import type { DraftProspect, UsedFinding } from "../src/lib/prospect-outreach-draft";
import type { ProspectRow } from "../src/lib/prospect-qualification";
import { analyzeMessage, hasBlockingError } from "../src/lib/message-quality";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

let mod: typeof import("../src/lib/prospect-outreach-draft");
test.before(async () => {
  mod = await import("../src/lib/prospect-outreach-draft");
});

const AT = "2026-11-11T09:00:00.000Z";
type Grade = "FIRM" | "UNCERTAIN";
const ev = (id: string, observed: string, evidence: Grade | undefined = "FIRM") =>
  ({ id, check: id, observed, sourceUrl: "https://riad-atlas.ma/", fetchedAt: AT, ...(evidence ? { evidence } : {}) });

test("only confirmed customer-facing failures: https, phone layout, and a confirmed missing contact option", () => {
  const picked = mod.pickFindings([
    ev("E_HSTS", "Not sent"),           // technical: never in a message
    ev("E_DESCRIPTION", "None found"),  // SEO: never in a message
    ev("E_TITLE", "None found"),
    ev("E_OPEN_GRAPH", "None found"),
    ev("E_RESPONSE_TIME", "4217 ms"),   // one speed sample: never in a message
    ev("E_VIEWPORT", "None found"),
    ev("E_HTTPS", "http://riad-atlas.ma/"),
  ], "fr");
  assert.deepEqual(picked.map((f) => f.id), ["E_HTTPS", "E_VIEWPORT"]);
  assert.ok(picked.every((f) => !("evidence" in f)), "the grade isn't carried into the result");
  assert.deepEqual(mod.DRAFT_FINDING_IDS, ["E_HTTPS", "E_VIEWPORT", "E_CONTACT"]);

  // A missing contact option is used only when the Daily Leads grading confirmed it.
  assert.deepEqual(mod.pickFindings([ev("E_CONTACT", "None found", "UNCERTAIN")], "fr"), []);
  assert.deepEqual(mod.pickFindings([ev("E_CONTACT", "None found")], "fr").map((f) => f.id), ["E_CONTACT"]);
  // Ungraded findings never count, whatever they say.
  const { evidence: _g, ...ungraded } = ev("E_VIEWPORT", "None found"); // eslint-disable-line @typescript-eslint/no-unused-vars
  assert.deepEqual(mod.pickFindings([ungraded], "fr"), []);
  // Only SEO details or speed: nothing to say.
  assert.deepEqual(mod.pickFindings([ev("E_DESCRIPTION", "None found"), ev("E_RESPONSE_TIME", "9000 ms")], "en"), []);
  // An observation that doesn't look like that check's failure is skipped, never guessed from.
  assert.equal(mod.pickFindings([ev("E_HTTPS", "https://riad-atlas.ma"), ev("E_VIEWPORT", "width=device-width")], "en").length, 0);
});

test("agency voice in FR, EN and AR: 'nous', signed Ibda3 Digital; business name, domain, the points, one question", () => {
  const voice: Record<"fr" | "en" | "ar", { we: RegExp[]; notI: RegExp; team: string; signed: RegExp }> = {
    fr: { we: [/nous avons remarqué deux points :/, /Voulez-vous que nous vous envoyions le détail \?/], notI: /\bj['’]ai\b|\bje\b|\bme\b|\bmon\b/i, team: "L'équipe Ibda3 Digital", signed: /\nAyoub, Ibda3 Digital$/ },
    en: { we: [/We visited the home page of riad-atlas\.ma and noticed two things:/, /Would you like us to send you the details\?/], notI: /\bI\b|\bme\b|\bmy\b/, team: "The Ibda3 Digital team", signed: /\nAyoub, Ibda3 Digital$/ },
    ar: { we: [/زرنا الصفحة الرئيسية/, /ولاحظنا نقطتين/, /أن نرسل لكم/], notI: /زرت |لاحظت|أرسل لكم|لم أجد/, team: "فريق Ibda3 Digital", signed: /\nAyoub، Ibda3 Digital$/ },
  };
  for (const language of ["fr", "en", "ar"] as const) {
    const v = voice[language];
    const f = mod.pickFindings([ev("E_VIEWPORT", "None found"), ev("E_CONTACT", "None found")], language) as UsedFinding[];
    const body = mod.composeDraft({ language, businessName: "Riad Atlas", domain: "riad-atlas.ma", findings: f, senderName: "Ayoub Khyat" });
    assert.match(body, /Riad Atlas/);
    assert.match(body, /riad-atlas\.ma/);
    for (const re of v.we) assert.match(body, re, `${language}: ${re}`);
    assert.doesNotMatch(body, v.notI, `${language}: no first person singular`);
    assert.match(body, v.signed);
    assert.equal(body.split("\n").filter((l) => l.startsWith("- ")).length, 2);
    assert.ok(!hasBlockingError(analyzeMessage(body, { name: "Riad Atlas" })), language);
    const single = mod.composeDraft({ language, businessName: "Riad Atlas", domain: "riad-atlas.ma", findings: f.slice(0, 1), senderName: "" });
    assert.ok(single.endsWith(`\n${v.team}`), `${language}: signed by the team when no name is known`);
    assert.doesNotMatch(single, v.notI);
  }
  const fr = mod.composeDraft({ language: "fr", businessName: "Riad Atlas", domain: "riad-atlas.ma", findings: mod.pickFindings([ev("E_VIEWPORT", "None found")], "fr"), senderName: "" });
  assert.match(fr, /nous avons remarqué un point :/);
  assert.match(fr, /C'est une correction simple\. Voulez-vous que nous vous envoyions le détail \?/);
});

/* ───────────────── The whole draft, with a fake network ───────────────── */

const res = (url: string, body: string, status = 200): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status, headers: {}, body, bytes: body.length, truncated: false, ms: 300, hops: [],
});
function net(routes: Record<string, string | number>, requested: string[] = []): SafeFetch {
  return async (url) => {
    requested.push(new URL(url).pathname);
    if (url.startsWith("http://")) return { ...res(url, "", 301), headers: { location: url.replace("http://", "https://") } };
    const r = routes[new URL(url).pathname];
    if (r === undefined) return res(url, "", 404);
    return typeof r === "number" ? res(url, "", r) : res(url, r);
  };
}
// No viewport, no description; a title and text that must never reach the message.
const PAGE = `<!doctype html><html lang="fr"><head><title>SECRET TITLE TEXT</title></head><body><h1>Riad Atlas</h1>
  <p>${"Texte privé de la page. ".repeat(30)}</p><a href="https://wa.me/212625461645">WhatsApp</a></body></html>`;
const SITE = { "/robots.txt": "User-agent: *\nDisallow:", "/": PAGE };

const prospect = (over: Partial<DraftProspect> = {}): DraftProspect => ({
  id: "me", name: "Riad Atlas", phone: "0625461645", email: "", website: "https://riad-atlas.ma", instagram: "",
  whatsappLink: "https://wa.me/212625461645", whatsappStatus: "VERIFIED", instagramStatus: "UNVERIFIED",
  status: "A_ENVOYER", sector: "Riad", neighborhood: "Médina", sentAt: null, lastSendAt: null, ...over,
});
const row = (over: Partial<ProspectRow>): ProspectRow => ({
  id: "x", name: "", phone: "", email: "", website: "", instagram: "", whatsappLink: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED", ...over,
});
const deps = (p: DraftProspect, crm: ProspectRow[] = [], requested: string[] = [], routes: Record<string, string | number> = SITE) => ({
  loadProspect: async () => p,
  loadProspects: async () => [row({ ...p }), ...crm],
  fetcher: net(routes, requested),
});
const input = { language: "fr" as const, senderName: "Sara Test" };

test("a prospect ready for a first message gets a draft built only from confirmed failed checks", async () => {
  const r = await mod.draftForProspect("me", input, deps(prospect()));
  assert.ok(r && r.ok, JSON.stringify(r));
  assert.equal(r.channel, "WHATSAPP");
  assert.deepEqual(r.findings.map((f) => f.id), ["E_VIEWPORT"], "the missing description (SEO) is left out");
  assert.match(r.body, /nous avons remarqué un point :/);
  assert.ok(r.findings.every((f) => f.sourceUrl.startsWith("https://riad-atlas.ma") && f.fetchedAt && f.observed));
  assert.match(r.body, /^Bonjour Riad Atlas,/);
  assert.match(r.body, /Sara, Ibda3 Digital$/);
  assert.doesNotMatch(r.body, /SECRET TITLE TEXT|Texte privé|212625461645/, "nothing from the page or the contact details goes into the text");
  assert.ok(!hasBlockingError(r.warnings));
});

test("refused before any website is read: contacted, no VERIFIED channel, unverified channel asked for, no website", async () => {
  const cases: [Partial<DraftProspect>, string, object?][] = [
    [{ status: "ENVOYE" }, "ALREADY_CONTACTED"],
    [{ lastSendAt: AT }, "ALREADY_CONTACTED"],
    [{ sentAt: AT }, "ALREADY_CONTACTED"],
    [{ whatsappStatus: "UNVERIFIED" }, "NO_VERIFIED_CHANNEL"],
    [{ whatsappStatus: "UNAVAILABLE", instagram: "riad.atlas", instagramStatus: "UNAVAILABLE" }, "NO_VERIFIED_CHANNEL"],
    [{}, "NO_VERIFIED_CHANNEL", { channel: "INSTAGRAM" }],
    [{ website: "" }, "NO_WEBSITE"],
    // A WhatsApp check on a bare phone number: nobody opened a saved link, so it can't be drafted to.
    [{ whatsappLink: "" }, "NO_VERIFIED_CHANNEL"],
    [{ whatsappLink: "https://evil.example/wa.me/212625461645" }, "NO_VERIFIED_CHANNEL"],
  ];
  for (const [over, code, extra] of cases) {
    const requested: string[] = [];
    const r = await mod.draftForProspect("me", { ...input, ...(extra ?? {}) }, deps(prospect(over), [], requested));
    assert.ok(r && !r.ok && r.blockers.some((b) => b.code === code), `${code}: ${JSON.stringify(r)}`);
    assert.equal(requested.length, 0, `${code}: the site isn't read`);
  }
});

test("a possible duplicate blocks the draft: same domain, same number or same Instagram; the prospect itself doesn't count", async () => {
  for (const other of [
    row({ id: "o1", name: "Riad Atlas bis", website: "https://www.riad-atlas.ma" }),
    row({ id: "o2", name: "Same phone", phone: "+212 6 25 46 16 45" }),
    row({ id: "o3", name: "Same IG", instagram: "@riad.atlas" }),
  ]) {
    const r = await mod.draftForProspect("me", input, deps(prospect({ instagram: "riad.atlas" }), [other]));
    assert.ok(r && !r.ok && r.blockers[0].code === "POSSIBLE_DUPLICATE" && r.blockers[0].message.includes(other.name), JSON.stringify(r));
  }
  const unrelated = await mod.draftForProspect("me", input, deps(prospect(), [row({ id: "o4", name: "Other", website: "https://other.ma", phone: "0611111111" })]));
  assert.ok(unrelated?.ok);
});

test("no draft when the CRM can't be checked, the site can't be read, or nothing evidenced is worth saying", async () => {
  const noCrm = await mod.draftForProspect("me", input, { ...deps(prospect()), loadProspects: async () => { throw new Error("db"); } });
  assert.ok(noCrm && !noCrm.ok && noCrm.blockers[0].code === "CRM_NOT_CHECKED");

  const robots = await mod.draftForProspect("me", input, deps(prospect(), [], [], { "/robots.txt": "User-agent: *\nDisallow: /", "/": PAGE }));
  assert.ok(robots && !robots.ok && robots.blockers[0].code === "SITE_NOT_READ");

  const good = `<!doctype html><html lang="fr"><head><title>Riad</title><meta name="description" content="Riad à Marrakech">
    <meta name="viewport" content="width=device-width"><meta property="og:title" content="Riad"></head>
    <body><h1>Riad</h1><p>${"Texte. ".repeat(80)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;
  const fine = await mod.draftForProspect("me", input, deps(prospect(), [], [], { "/robots.txt": "User-agent: *\nDisallow:", "/": good }));
  assert.ok(fine && !fine.ok && fine.blockers[0].code === "NO_EVIDENCED_FINDING", JSON.stringify(fine));

  // SEO details only (no description, no social preview), with https, a phone layout and a contact link: blocked.
  const seoOnly = `<!doctype html><html lang="fr"><head><title>Riad</title><meta name="viewport" content="width=device-width"></head>
    <body><h1>Riad</h1><p>${"Texte. ".repeat(80)}</p><a href="mailto:a@b.ma">Mail</a></body></html>`;
  const seo = await mod.draftForProspect("me", input, deps(prospect(), [], [], { "/robots.txt": "User-agent: *\nDisallow:", "/": seoOnly }));
  assert.ok(seo && !seo.ok && seo.blockers[0].code === "NO_EVIDENCED_FINDING", JSON.stringify(seo));
  assert.match(seo.ok ? "" : seo.blockers[0].message, /No confirmed problem a customer would notice/);
});

/* ───────────────── A missing contact option: confirmed or not ───────────────── */

// A phone layout and https, but no phone, e-mail, WhatsApp or form on the home page.
const noContactHome = (extra = "") => `<!doctype html><html lang="fr"><head><title>Riad</title><meta name="viewport" content="width=device-width"></head>
  <body><h1>Riad Atlas</h1><p>${"Texte de présentation. ".repeat(40)}</p>${extra}</body></html>`;

/** Like `deps`, but counts the secure home-page reads (the audit also tries http:// for its redirect check). */
function countingDeps(routes: Record<string, string | number>) {
  const urls: string[] = [];
  const inner = net(routes);
  const fetcher: SafeFetch = async (url, opts) => { urls.push(url); return inner(url, opts); };
  const isSecureHome = (u: string) => { const x = new URL(u); return x.protocol === "https:" && x.pathname === "/"; };
  return { deps: { ...deps(prospect(), [], [], routes), fetcher }, homeReads: () => urls.filter(isSecureHome).length };
}

test("a missing contact option confirmed by the second read (no Contact page) is drafted, in the agency voice", async () => {
  const c = countingDeps({ "/robots.txt": "User-agent: *\nDisallow:", "/": noContactHome() });
  const r = await mod.draftForProspect("me", input, c.deps);
  assert.ok(r && r.ok, JSON.stringify(r));
  assert.deepEqual(r.findings.map((f) => f.id), ["E_CONTACT"]);
  assert.match(r.body, /nous n'avons trouvé ni sur la page d'accueil ni sur la page Contact/);
  assert.equal(c.homeReads(), 2, "the home page is read a second time, for the grading");
});

test("a missing contact option that the Contact page contradicts, or that couldn't be checked, is never said", async () => {
  // The home page links a Contact page that has an e-mail link: the customer can reach them, so nothing to say.
  const withContactPage = { "/robots.txt": "User-agent: *\nDisallow:", "/": noContactHome(`<a href="/contact">Contact</a>`),
    "/contact": `<!doctype html><html><head><title>Contact</title></head><body><h1>Contact</h1><p>${"Écrivez-nous. ".repeat(30)}</p><a href="mailto:hello@riad-atlas.ma">hello@riad-atlas.ma</a></body></html>` };
  const contradicted = await mod.draftForProspect("me", input, deps(prospect(), [], [], withContactPage));
  assert.ok(contradicted && !contradicted.ok && contradicted.blockers[0].code === "NO_EVIDENCED_FINDING", JSON.stringify(contradicted));

  // The Contact page can't be read (robots.txt disallows it): unconfirmed, so not said.
  const blocked = { "/robots.txt": "User-agent: *\nDisallow: /contact", "/": noContactHome(`<a href="/contact">Contact</a>`) };
  const unsure = await mod.draftForProspect("me", input, deps(prospect(), [], [], blocked));
  assert.ok(unsure && !unsure.ok && unsure.blockers[0].code === "NO_EVIDENCED_FINDING", JSON.stringify(unsure));
});

test("the second read happens only when there is a missing contact option to confirm", async () => {
  const c = countingDeps(SITE);
  const r = await mod.draftForProspect("me", input, c.deps);
  assert.ok(r?.ok);
  assert.equal(c.homeReads(), 1, "PAGE has a WhatsApp link: no E_CONTACT, no second read");
});

test("unknown prospect: nothing", async () => {
  assert.equal(await mod.draftForProspect("nope", input, { loadProspect: async () => null }), null);
});

test("no AI, no writes, no automatic send; owner/admin only", () => {
  const lib = read("src/lib/prospect-outreach-draft.ts");
  const route = read("src/app/api/admin/prospecting/[id]/outreach-draft/route.ts");
  const panel = read("src/components/admin/outreach-draft-panel.tsx");
  for (const src of [lib, route, panel]) {
    assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$transaction/, "no database writes");
    assert.doesNotMatch(src, /anthropic|groq|openai|gemini|ai-workforce|@\/lib\/ai\b|createChatCompletion|generate-message/i, "no AI");
  }
  assert.match(route, /requireOwnerOrAdmin\(\)/);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  // The panel only records a send after the person says "Yes, sent", through the existing flow.
  assert.equal((panel.match(/recordConfirmedSend\(/g) ?? []).length, 1);
  assert.match(panel, /async function confirmSent\(\) \{\n\s+if \(!opened\) return;\n\s+const result = await recordConfirmedSend\(/);
  assert.doesNotMatch(panel, /\/outreach`/, "never posts a message record directly");
  // The library never sends or records anything itself.
  assert.doesNotMatch(lib, /record-send|recordConfirmedSend|method:\s*"POST"|wa\.me\/\$\{|window\.open/, "no sending from the draft code");
});

test("Today: links to the contact checks and, for an owner/admin with a verified channel, to the draft; nothing more", () => {
  const card = read("src/components/admin/todays-leads.tsx");
  assert.match(card, /href=\{`\/admin\/prospecting\/\$\{prospectId\}#contact`\}[^>]*>Check contacts</);
  assert.match(card, /\{canDraft && lead\.hasVerifiedChannel === true && \(\s*<Link href=\{`\/admin\/prospecting\/\$\{prospectId\}#draft`\}[^>]*>Draft first message</);
  assert.equal((card.match(/canDraft=\{view\.canRun\}/g) ?? []).length, 2, "both lists pass the owner/admin flag");
  assert.doesNotMatch(card, /outreach-draft/, "the card never calls the draft API");
  assert.match(read("src/components/admin/outreach-draft-panel.tsx"), /<div id="draft" /);
  const store = read("src/lib/daily-leads-store.ts");
  assert.match(store, /verified: verifiedChannels\(p\)\.length > 0/, "the same rule as the draft gate");
});
