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
const ev = (id: string, observed: string) => ({ id, check: id, observed, sourceUrl: "https://riad-atlas.ma/", fetchedAt: AT });

test("only owner-facing failures with the exact evidence shape are used, most important first, at most two", () => {
  const picked = mod.pickFindings([
    ev("E_HSTS", "Not sent"), // technical: never in a message
    ev("E_DESCRIPTION", "None found"),
    ev("E_RESPONSE_TIME", "4217 ms"),
    ev("E_VIEWPORT", "None found"),
  ], "fr");
  assert.deepEqual(picked.map((f) => f.id), ["E_VIEWPORT", "E_RESPONSE_TIME"]);
  assert.match(picked[1].sentence, /environ 4,2 secondes/);

  // An observation that doesn't look like that check's failure is skipped, never guessed from.
  const odd = mod.pickFindings([ev("E_RESPONSE_TIME", "slow"), ev("E_HTTPS", "https://riad-atlas.ma"), ev("E_TITLE", "\"Riad\"")], "en");
  assert.equal(odd.length, 0);
});

test("the message: CRM business name, the domain, the evidenced points, one question; in FR, EN and AR", () => {
  const findings = mod.pickFindings([ev("E_VIEWPORT", "None found"), ev("E_DESCRIPTION", "None found")], "fr") as UsedFinding[];
  for (const language of ["fr", "en", "ar"] as const) {
    const f = mod.pickFindings([ev("E_VIEWPORT", "None found"), ev("E_DESCRIPTION", "None found")], language);
    const body = mod.composeDraft({ language, businessName: "Riad Atlas", domain: "riad-atlas.ma", findings: f, senderName: "Ayoub Khyat" });
    assert.match(body, /Riad Atlas/);
    assert.match(body, /riad-atlas\.ma/);
    assert.match(body, /Ayoub, Ibda3 Digital$/);
    assert.equal(body.split("\n").filter((l) => l.startsWith("- ")).length, 2);
    assert.ok(!hasBlockingError(analyzeMessage(body, { name: "Riad Atlas" })), language);
  }
  assert.equal(findings.length, 2);
  const single = mod.composeDraft({ language: "fr", businessName: "Riad Atlas", domain: "riad-atlas.ma", findings: findings.slice(0, 1), senderName: "" });
  assert.match(single, /un point :/);
  assert.match(single, /C'est une correction simple/);
  assert.match(single, /Ibda3 Digital$/);
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

test("a prospect ready for a first message gets a draft built only from failed checks", async () => {
  const r = await mod.draftForProspect("me", input, deps(prospect()));
  assert.ok(r && r.ok, JSON.stringify(r));
  assert.equal(r.channel, "WHATSAPP");
  assert.deepEqual(r.findings.map((f) => f.id), ["E_VIEWPORT", "E_DESCRIPTION"]);
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
});
