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
const db = { prospects: [] as Row[], created: [] as Row[] };
mock.module("@/lib/auth", { namedExports: { getSession: async () => ({ userId: "u1", fullName: "Test User", role: "admin" }) } });
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => true,
    prisma: {
      prospect: {
        findMany: async () => db.prospects.map((p) => ({ ...p })),
        create: async ({ data }: { data: Row }) => { const row: Row = { ...data, id: `new${db.created.length}` }; db.created.push(row); return { id: row.id, name: row["name"] }; },
      },
      discoverySweep: { updateMany: async () => ({ count: 0 }) },
    },
  },
});

const route = import("../src/app/api/admin/prospect-discovery/import/route");
async function importCandidates(candidates: Partial<DiscoveryCandidate>[], extra: object = {}) {
  db.created = [];
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
