/**
 * Bulk Sweep import (/api/admin/prospect-discovery/import): the server-side duplicate recheck now covers the
 * website domain and email, and WhatsApp is only an explicit https link, never a phone number. Prisma and the
 * session are mocked: no database.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { classify, siteKey, type ExistingProspectLite } from "../src/lib/discovery-duplicates";
import { normalizePhoneMA } from "../src/lib/discovery-providers";
import { explicitWhatsAppLink } from "../src/lib/contact-check";
import type { DiscoveryCandidate } from "../src/lib/discovery-providers";
import { issueCopy } from "../src/lib/lead-issue-copy";

const titleOf = (id: string) => issueCopy({ id, sentence: "", observed: "" }).title;
const re = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

const cand = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  sourceId: "node/1", source: "OSM", name: "Riad Nouveau", sector: "RIADS", city: "Marrakech", neighborhood: null,
  phone: null, whatsapp: null, website: null, email: null, instagram: null, facebook: null, mapsUrl: null, rating: null, reviewCount: null, ...over,
});
const lite = (over: Partial<ExistingProspectLite>): ExistingProspectLite => ({
  id: "p1", name: "Ancien Nom", phone: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "Other", website: "", email: "", ...over,
});

test("domains are normalized: www, case, scheme and path don't matter; shared platforms compare the page", () => {
  assert.equal(siteKey("https://WWW.Riad-Atlas.ma/contact?x=1"), "riad-atlas.ma");
  assert.equal(siteKey("riad-atlas.ma"), "riad-atlas.ma");
  assert.equal(siteKey("https://www.facebook.com/RiadAtlas/"), "facebook.com/riadatlas");
  assert.equal(siteKey("https://facebook.com"), null, "a platform home page isn't a business site");
  assert.equal(siteKey(""), null);
  assert.equal(siteKey("not a url"), null);
});

test("classify: the same website or email is a duplicate even with a different name and number", () => {
  const existing = [lite({ id: "site", website: "https://www.riad-atlas.ma" }), lite({ id: "mail", email: "Contact@Dar-Zina.ma" })];
  assert.deepEqual(classify(cand({ website: "http://riad-atlas.ma/fr" }), existing), { status: "EXISTS", matchedId: "site", reason: "Same website domain" });
  assert.deepEqual(classify(cand({ email: "contact@dar-zina.ma" }), existing), { status: "EXISTS", matchedId: "mail", reason: "Same email address" });
  assert.equal(classify(cand({ website: "https://other-riad.ma" }), existing).status, "NEW");
  // Two different Facebook pages are two businesses.
  assert.equal(classify(cand({ website: "https://facebook.com/riad.b" }), [lite({ website: "https://facebook.com/riad.a" })]).status, "NEW");
  assert.equal(classify(cand({ website: "https://facebook.com/riad.a/about" }), [lite({ website: "https://www.facebook.com/riad.a" })]).status, "EXISTS");
  // Older callers without website/email still work as before.
  assert.equal(classify(cand({ phone: "+212612345678" }), [{ id: "x", name: "Z", phone: "0612345678", instagram: "", whatsappLink: "", neighborhood: "", sector: "" }]).status, "EXISTS");
});

test("WhatsApp: only an explicit https link with a number; a phone never becomes one", () => {
  assert.equal(explicitWhatsAppLink("https://wa.me/212612345678"), "https://wa.me/212612345678");
  assert.equal(explicitWhatsAppLink("https://api.whatsapp.com/send?phone=212612345678&text=hi"), "https://wa.me/212612345678");
  for (const bad of ["0612345678", "+212612345678", "http://wa.me/212612345678", "https://wa.me/0612345678", "https://wa.me/message/ABC",
    "https://evil.com/wa.me/212612345678", "javascript:alert(1)", "https://wa.me/212612345678@evil.com", "", null]) {
    assert.equal(explicitWhatsAppLink(bad as string), "", String(bad));
  }
  // OSM WhatsApp tags written as wa.me/212… or 212… no longer get a second country code.
  assert.equal(normalizePhoneMA("https://wa.me/212612345678"), "+212612345678");
  assert.equal(normalizePhoneMA("212612345678"), "+212612345678");
  assert.equal(normalizePhoneMA("0612345678"), "+212612345678");
  assert.equal(normalizePhoneMA("+212 6 12 34 56 78"), "+212612345678");
});

/* ───────────────── The route ───────────────── */

type Row = Record<string, unknown> & { id: string };
const db = { prospects: [] as Row[], created: [] as Row[], creates: 0, failCreate: false };
mock.module("@/lib/auth", { namedExports: { getSession: async () => ({ userId: "u1", fullName: "Test User", role: "admin" }) } });
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => true,
    prisma: {
      prospect: {
        findMany: async () => db.prospects.map((p) => ({ ...p })),
        create: async ({ data }: { data: Row }) => {
          db.creates++;
          if (db.failCreate) throw new Error("write failed");
          const row: Row = { ...data, id: `new${db.created.length}` }; db.created.push(row); return { id: row.id, name: row["name"] };
        },
      },
      discoverySweep: { updateMany: async () => ({ count: 0 }) },
    },
  },
});

const route = import("../src/app/api/admin/prospect-discovery/import/route");
async function importCandidates(candidates: Partial<DiscoveryCandidate>[], extra: object = {}) {
  db.created = []; db.creates = 0;
  const { POST } = await route;
  const res = await POST(new Request("http://x/api", { method: "POST", body: JSON.stringify({ candidates: candidates.map((c) => cand(c)), ...extra }) }));
  return { status: res.status, body: await res.json() };
}

test("import rechecks the website domain and email against current prospects", async () => {
  db.prospects = [{ id: "p1", name: "Riad Atlas", phone: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "Riads", website: "https://www.riad-atlas.ma", email: "hello@dar-zina.ma" }];
  const r = await importCandidates([
    { name: "Totally Different Name", website: "https://riad-atlas.ma/en" },
    { name: "Another Name", sourceId: "node/2", email: "HELLO@dar-zina.ma" },
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body.imported, 0);
  assert.deepEqual(r.body.skippedDetails.map((s: { reason: string }) => s.reason), ["Same website domain", "Same email address"]);
});

test("two candidates in one batch with the same domain: only the first is imported", async () => {
  db.prospects = [];
  const r = await importCandidates([{ name: "Riad Un", website: "https://riad-un.ma" }, { name: "Riad Un Bis", sourceId: "node/2", website: "http://www.riad-un.ma/contact" }]);
  assert.equal(r.body.imported, 1);
  assert.equal(r.body.skippedDetails[0].reason, "Same website domain");
});

test("imported prospects are UNVERIFIED and keep only an explicit WhatsApp link", async () => {
  db.prospects = [];
  const r = await importCandidates([
    { name: "Riad Phone", phone: "+212612345678", whatsapp: "0612345678", website: "https://riad-phone.ma" },
    { name: "Riad Link", sourceId: "node/2", phone: "+212622222222", whatsapp: "https://wa.me/212622222222", website: "https://riad-link.ma" },
    { name: "Riad Evil", sourceId: "node/3", whatsapp: "javascript:alert(1)", website: "https://riad-evil.ma" },
  ]);
  assert.equal(r.body.imported, 3);
  assert.deepEqual(db.created.map((c) => c.whatsappLink), ["", "https://wa.me/212622222222", ""]);
  assert.ok(db.created.every((c) => c.whatsappStatus === "UNVERIFIED" && c.instagramStatus === "UNVERIFIED"));
  assert.equal(db.created[0].phone, "+212612345678", "the phone is kept as a phone");
});

test("Bulk Sweep behaviour kept: new businesses import, possible duplicates wait unless allowed", async () => {
  db.prospects = [{ id: "p1", name: "Riad Jardin Secret", phone: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "RIADS", website: "", email: "" }];
  const held = await importCandidates([{ name: "Jardin Bleu", sector: "RIADS" }, { name: "Dar Nouvelle", sourceId: "node/2" }]);
  assert.equal(held.body.imported, 1);
  assert.equal(held.body.skippedDetails[0].reason, "Similar name + same sector");
  const allowed = await importCandidates([{ name: "Jardin Bleu", sector: "RIADS" }], { allowPossibleDuplicates: true });
  assert.equal(allowed.body.imported, 1);
});

/* ───────────────── Find businesses: the website check kept as a dated note ───────────────── */

const NOW = new Date().toISOString();
const SITE = "https://riad-audit.ma";
const finding = (over: Record<string, unknown> = {}) => ({ id: "E_DESCRIPTION", observed: "None found", sourceUrl: `${SITE}/`, fetchedAt: NOW, ...over });
const audit = (over: Record<string, unknown> = {}) => ({ outcome: "COMPLETE", auditedAt: NOW, finalUrl: `${SITE}/`, findings: [finding()], ...over });
const noteOf = (row: Row) => (row.notes as { create?: { content: string; authorId: string; authorName: string } } | undefined)?.create;
const withAudit = (a: unknown, over: Partial<DiscoveryCandidate> = {}) => ({ name: "Riad Audit", website: SITE, ...over, audit: a } as Partial<DiscoveryCandidate>);

test("a completed check with findings becomes a dated note written by the server, saved with the prospect", async () => {
  db.prospects = [];
  const r = await importCandidates([withAudit(audit({ findings: [finding(), finding({ id: "E_OPEN_GRAPH", sourceUrl: `${SITE}/fr` })] }))]);
  assert.equal(r.status, 200);
  assert.equal(r.body.imported, 1);
  const note = noteOf(db.created[0]);
  assert.ok(note, "the note is part of the prospect's own create");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(NOW));
  assert.match(note.content, new RegExp(`^Website check from Find businesses, dated ${day} \\(${SITE}/\\): 2 problems a customer would notice\\.`));
  assert.match(note.content, re(`• ${titleOf("E_DESCRIPTION")}: seen "None found" (${SITE}/)`));
  assert.match(note.content, re(`• ${titleOf("E_OPEN_GRAPH")}: seen "None found" (${SITE}/fr)`));
  assert.match(note.content, /Sent by the browser with the import and checked here for format and site only; the site was not re-checked\./,
    "the note never claims the server verified the evidence");
  assert.doesNotMatch(note.content, /verified|confirmed|this is what the site showed/i);
  assert.deepEqual([note.authorId, note.authorName], ["u1", "Test User"]);
});

test("no note for a check that didn't complete, had no usable finding, or had a bad date", async () => {
  db.prospects = [];
  const future = new Date(Date.now() + 60 * 60_000).toISOString();
  const cases: [string, unknown][] = [
    ["unreadable", audit({ outcome: "UNREADABLE" })],
    ["robots", audit({ outcome: "ROBOTS_DISALLOWED" })],
    ["error", audit({ outcome: "ERROR", finalUrl: null, findings: [] })],
    ["no findings", audit({ findings: [] })],
    ["future date", audit({ auditedAt: future })],
    ["not a date", audit({ auditedAt: "yesterday" })],
    ["lenient date \"1\" (Date.parse → 2001)", audit({ auditedAt: "1" })],
    ["lenient date \"May 5\"", audit({ auditedAt: "May 5" })],
    ["date without time", audit({ auditedAt: "2026-11-16" })],
    ["impossible date", audit({ auditedAt: "2026-02-30T10:00:00.000Z" })],
    ["local time, not UTC", audit({ auditedAt: "2026-11-16T10:00:00+01:00" })],
    ["unknown check", audit({ findings: [finding({ id: "E_ROBOTS" }), finding({ id: "E_MADE_UP" })] })],
    ["another site", audit({ findings: [finding({ sourceUrl: "https://evil.example/" }), finding({ sourceUrl: "https://riad-audit.ma.evil.example/" })] })],
    ["not a web address", audit({ findings: [finding({ sourceUrl: "javascript:alert(1)" }), finding({ sourceUrl: "https://user:pw@riad-audit.ma/" })] })],
    ["empty after cleaning", audit({ findings: [finding({ observed: "<b></b>" })] })],
  ];
  for (const [label, a] of cases) {
    const r = await importCandidates([withAudit(a)]);
    assert.equal(r.body.imported, 1, `${label}: the prospect is still imported`);
    assert.equal("notes" in db.created[0], false, `${label}: no note`);
  }
  // A business without a website of its own has nothing the evidence could belong to.
  const r = await importCandidates([withAudit(audit(), { website: null })]);
  assert.equal(r.body.imported, 1);
  assert.equal("notes" in db.created[0], false);
});

test("only valid findings are kept: one line per check, own-site evidence, text cleaned", async () => {
  db.prospects = [];
  await importCandidates([withAudit(audit({ findings: [
    finding({ observed: "None <script>x</script>\u0007found" }),
    finding({ observed: "duplicate of the same check" }),
    finding({ id: "E_MADE_UP" }),
    finding({ id: "E_TITLE", sourceUrl: "https://evil.example/" }),
    finding({ id: "E_HTTPS", observed: "http://www.riad-audit.ma", sourceUrl: "http://www.riad-audit.ma/" }),
  ] }))]);
  const note = noteOf(db.created[0])!.content;
  assert.match(note, /: 2 problems a customer would notice\./);
  assert.doesNotMatch(note, /<script|<\/script|\u0007|duplicate of|E_MADE_UP|evil\.example/);
  assert.match(note, re(`• ${titleOf("E_DESCRIPTION")}: seen "None x found"`), "tags and control characters removed");
  assert.match(note, re(`• ${titleOf("E_HTTPS")}: seen "http://www.riad-audit.ma"`), "www and http are the same site");
  const foreignFinal = await importCandidates([withAudit(audit({ finalUrl: "https://elsewhere.example/" }))]);
  assert.equal(foreignFinal.body.imported, 1);
  assert.match(noteOf(db.created[0])!.content, /^Website check from Find businesses, dated \S+ \(https:\/\/riad-audit\.ma\)/, "a final address on another site is never shown");
});

test("malformed audits are refused before anything is written", async () => {
  db.prospects = [];
  const many = Array.from({ length: 13 }, (_, i) => finding({ fetchedAt: `${i}` }));
  for (const [label, a] of [
    ["too many findings", audit({ findings: many })],
    ["observed too long", audit({ findings: [finding({ observed: "x".repeat(501) })] })],
    ["source address too long", audit({ findings: [finding({ sourceUrl: `${SITE}/${"a".repeat(400)}` })] })],
    ["an extra field (client-written text)", audit({ note: "Call them now" })],
    ["an extra field on a finding", audit({ findings: [{ ...finding(), sentence: "made up" }] })],
    ["wrong types", audit({ findings: "E_TITLE" })],
    ["missing fields", { outcome: "COMPLETE" }],
  ] as [string, unknown][]) {
    const r = await importCandidates([withAudit(a)]);
    assert.equal(r.status, 400, label);
    assert.equal(db.creates, 0, `${label}: nothing written`);
  }
});

test("skipped duplicates get no prospect and no note", async () => {
  db.prospects = [{ id: "p1", name: "Riad Jardin Secret", phone: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "RIADS", website: "https://riad-audit.ma", email: "" }];
  const exists = await importCandidates([withAudit(audit(), { name: "Some Other Name" })]);
  assert.equal(exists.body.imported, 0);
  assert.equal(exists.body.skippedDetails[0].reason, "Same website domain");
  assert.equal(db.creates, 0);
  const possible = await importCandidates([withAudit(audit(), { name: "Jardin Secret", sector: "RIADS", website: "https://jardin-secret.ma" })]);
  assert.equal(possible.body.imported, 0, "a possible duplicate waits for a person");
  assert.equal(db.creates, 0);
});

test("the prospect and its note are one write: a failed write leaves neither", async () => {
  db.prospects = [];
  db.failCreate = true;
  try {
    const { POST } = await route;
    db.created = []; db.creates = 0;
    await assert.rejects(POST(new Request("http://x/api", { method: "POST", body: JSON.stringify({ candidates: [cand(withAudit(audit()))] }) })));
    assert.equal(db.creates, 1, "a single write was attempted");
    assert.equal(db.created.length, 0);
  } finally {
    db.failCreate = false;
  }
  // The mock has no prospectNote model: any separate note write would have thrown above.
});

test("without an audit (Daily Lead Agent, older callers) the import is exactly as before; scoring ignores the audit", async () => {
  db.prospects = [];
  const plain = await importCandidates([{ name: "Riad Audit", website: SITE, phone: "+212612345678" }]);
  const plainRow = { ...db.created[0] };
  assert.equal(plain.body.imported, 1);
  assert.equal("notes" in plainRow, false);
  await importCandidates([withAudit(audit(), { phone: "+212612345678" })]);
  const audited = db.created[0];
  for (const k of ["score", "scoreLabel", "qualityLabel", "priority", "status", "whatsappStatus", "instagramStatus", "source"]) {
    assert.deepEqual(audited[k], plainRow[k], k);
  }
});
