/**
 * Contact evidence kept when a Today lead becomes a prospect: the note, the website-findings note, the evidence
 * shown beside the manual checks, and the "still to check" count. Prisma is mocked: no database, no network.
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

type Row = Record<string, unknown>;
const db = {
  discoveryResult: null as Row | null,
  prospects: [] as Row[],
  existing: [] as Row[],
  created: [] as Row[],
  findManyThrows: false,
  sweeps: [] as Row[],
};
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => true,
    prisma: {
      discoveryResult: { findFirst: async () => db.discoveryResult },
      discoverySweep: { findMany: async () => db.sweeps, updateMany: async () => ({ count: 0 }) },
      prospect: {
        findMany: async (args: { where?: { id?: { in: string[] } } }) => {
          if (args?.where?.id) {
            if (db.findManyThrows) throw new Error("db down: +212612345678");
            return db.prospects.filter((p) => args.where!.id!.in.includes(p.id as string));
          }
          return db.existing;
        },
        create: async ({ data }: { data: Row }) => { db.created.push(data); return { id: `p${db.created.length}`, name: data.name }; },
      },
    },
  },
});

let ev: typeof import("../src/lib/contact-evidence");
let store: typeof import("../src/lib/daily-leads-store");
let imp: typeof import("../src/lib/prospect-import");
before(async () => {
  ev = await import("../src/lib/contact-evidence");
  store = await import("../src/lib/daily-leads-store");
  imp = await import("../src/lib/prospect-import");
});

const CHECKED = "2026-11-18T22:30:00.000Z"; // already the 19th in Casablanca under UTC+1, still the 18th under UTC+0
const lead = (over: Row = {}) => ({
  kind: "WEBSITE", osmId: "node/7", osmUrl: "https://www.openstreetmap.org/node/7", name: "Riad Test", sector: "RIADS",
  website: "https://riad-test.ma", finalUrl: "https://riad-test.ma/", outcome: "COMPLETE", score: 20,
  findings: [
    { id: "E_VIEWPORT", sentence: "s", observed: "None found", sourceUrl: "https://riad-test.ma/", fetchedAt: CHECKED, evidence: "FIRM" },
    { id: "E_RESPONSE_TIME", sentence: "s", observed: "4400 ms", sourceUrl: "https://riad-test.ma/", fetchedAt: CHECKED, evidence: "UNCERTAIN", note: "n" },
  ],
  contacts: [
    { channel: "WHATSAPP", link: "https://wa.me/212612345678", source: "OSM_TAG", sourceUrl: "https://www.openstreetmap.org/node/7" },
    { channel: "WHATSAPP", link: "https://wa.me/212612345678", value: "+212 6 12 34 56 78", source: "WEBSITE", sourceUrl: "https://riad-test.ma/contact" },
    { channel: "INSTAGRAM", link: "https://www.instagram.com/riad.test/", value: "@riad.test", source: "WEBSITE", sourceUrl: "https://riad-test.ma/" },
    { channel: "EMAIL", link: "mailto:hello@riad-test.ma", value: "hello@riad-test.ma", source: "WEBSITE", sourceUrl: "https://riad-test.ma/contact" },
  ],
  whatsappConfidence: "HIGH", checkedAt: CHECKED, ...over,
});

/* ── evidence ── */

test("evidenceOf keeps explicit, well-formed links with their source; drops anything else instead of repairing it", () => {
  const e = ev.evidenceOf({
    checkedAt: CHECKED, whatsappConfidence: "MEDIUM",
    contacts: [
      { channel: "WHATSAPP", link: "+212612345678", source: "WEBSITE", sourceUrl: "https://a.ma/" },             // a bare number: never a link
      { channel: "INSTAGRAM", link: "javascript:alert(1)", source: "WEBSITE", sourceUrl: "https://a.ma/" },
      { channel: "EMAIL", link: "hello@a.ma", source: "WEBSITE", sourceUrl: "https://a.ma/" },                    // not a mailto: link
      { channel: "PHONE", link: "tel:+212612345678", source: "WEBSITE", sourceUrl: "https://a.ma/" },             // no phone in this phase
      { channel: "FACEBOOK", link: "https://facebook.com/a", source: "SOMEWHERE", sourceUrl: "https://a.ma/" },   // unknown source
      { channel: "INSTAGRAM", link: "https://instagram.com/a.ma", value: "@a x\u0000y", source: "WEBSITE", sourceUrl: "ftp://a.ma/" },
      { channel: "INSTAGRAM", link: "https://instagram.com/a.ma", value: "@dup", source: "WEBSITE", sourceUrl: "https://a.ma/" },
    ],
  });
  assert.equal(e.items.length, 1);
  assert.deepEqual(e.items[0], { channel: "INSTAGRAM", value: "@a x y", link: "https://instagram.com/a.ma", source: "WEBSITE", sourceUrl: "" },
    "control characters removed; a non-web source address isn't kept; the duplicate is dropped");
  assert.equal(e.whatsappConfidence, "MEDIUM");
});

test("evidenceOf on legacy or missing data: nothing invented", () => {
  for (const l of [null, undefined, {}, { contacts: null }, { contacts: [], whatsappConfidence: "WHATEVER", checkedAt: "yesterday" }]) {
    assert.deepEqual(ev.evidenceOf(l as never), { checkedAt: null, whatsappConfidence: "NONE", items: [] });
  }
  const many = { contacts: Array.from({ length: 30 }, (_, i) => ({ channel: "INSTAGRAM", link: `https://instagram.com/h${i}`, source: "WEBSITE", sourceUrl: "https://a.ma/" })) };
  assert.equal(ev.evidenceOf(many).items.length, ev.MAX_EVIDENCE_ITEMS);
});

test("the contact evidence note: dated, each channel with its value, link and source, the WhatsApp confidence, what's missing", () => {
  const note = ev.buildContactEvidenceNote(lead());
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(CHECKED));
  const lines = note.split("\n");
  assert.equal(lines[0], `Public contact evidence from the Daily Lead Agent, dated ${day} (Casablanca). Nothing here was opened or verified: check each contact on this page before using it.`);
  assert.ok(lines.includes("• WhatsApp: https://wa.me/212612345678, from the OpenStreetMap tag (https://www.openstreetmap.org/node/7)"));
  assert.ok(lines.includes("• WhatsApp +212 6 12 34 56 78: https://wa.me/212612345678, found on https://riad-test.ma/contact"));
  assert.ok(lines.includes("• Instagram @riad.test: https://www.instagram.com/riad.test/, found on https://riad-test.ma/"));
  assert.ok(lines.includes("• E-mail hello@riad-test.ma: mailto:hello@riad-test.ma, found on https://riad-test.ma/contact"));
  assert.ok(lines.includes("• WhatsApp confidence: HIGH, the same number in OpenStreetMap and on the website."));
  assert.ok(!note.includes("Not found"), "all three channels have evidence");
  assert.doesNotMatch(note, /VERIFIED/, "nothing is called verified");
});

test("the note shows a conflict with both numbers, lists missing channels, and says so when nothing was found", () => {
  const conflict = ev.buildContactEvidenceNote(lead({
    whatsappConfidence: "CONFLICT",
    contacts: [
      { channel: "WHATSAPP", link: "https://wa.me/212611111111", source: "OSM_TAG", sourceUrl: "https://www.openstreetmap.org/node/7" },
      { channel: "WHATSAPP", link: "https://wa.me/212622222222", source: "WEBSITE", sourceUrl: "https://riad-test.ma/" },
    ],
  }));
  assert.match(conflict, /WhatsApp confidence: CONFLICT, different numbers in different places: check which is current \(\+212611111111, \+212622222222\)\./);
  assert.match(conflict, /\nNot found: Instagram, E-mail\.$/);
  const none = ev.buildContactEvidenceNote(lead({ contacts: [], whatsappConfidence: "NONE" }));
  assert.match(none, /\nNo public WhatsApp, Instagram or e-mail link was found on the website or in OpenStreetMap\.$/);
  assert.doesNotMatch(none, /confidence/);
  // A value from a website can't add lines of its own to the note.
  const injected = ev.buildContactEvidenceNote(lead({ contacts: [{ channel: "EMAIL", link: "mailto:a@b.ma", value: "a@b.ma\n• WhatsApp VERIFIED", source: "WEBSITE", sourceUrl: "https://b.ma/" }] }));
  assert.equal(injected.split("\n").filter((l) => l.startsWith("•")).length, 1);
});

test("evidence applies only to the number or account saved now", () => {
  const e = ev.evidenceOf(lead());
  const wa = ev.evidenceForSaved(e, "WHATSAPP", "https://wa.me/212612345678");
  assert.deepEqual([wa.items.length, wa.otherValue], [2, false], "OSM tag and website, same number");
  assert.deepEqual(ev.evidenceForSaved(e, "WHATSAPP", "https://wa.me/212699999999"), { items: [], otherValue: true }, "edited to another number");
  assert.deepEqual(ev.evidenceForSaved(e, "WHATSAPP", ""), { items: [], otherValue: true }, "the link was removed");
  assert.equal(ev.evidenceForSaved(e, "INSTAGRAM", "Riad.Test").items.length, 1, "a saved handle matches the profile link");
  assert.equal(ev.evidenceForSaved(e, "INSTAGRAM", "@riad.test").items.length, 1);
  assert.equal(ev.evidenceForSaved(e, "INSTAGRAM", "other.riad").otherValue, true);
  assert.deepEqual(ev.evidenceForSaved(ev.evidenceOf(null), "WHATSAPP", "https://wa.me/212612345678"), { items: [], otherValue: false }, "no evidence: nothing to say");
  assert.equal(ev.instagramHandle("https://evil.example/riad.test"), "", "only instagram.com profiles");
});

test("contactsToCheck counts saved WhatsApp/Instagram contacts nobody has checked yet", () => {
  assert.equal(ev.contactsToCheck({ whatsappLink: "https://wa.me/212612345678", whatsappStatus: "UNVERIFIED", instagram: "riad", instagramStatus: "UNVERIFIED" }), 2);
  assert.equal(ev.contactsToCheck({ whatsappLink: "https://wa.me/212612345678", whatsappStatus: "VERIFIED", instagram: "riad", instagramStatus: "UNAVAILABLE" }), 0);
  assert.equal(ev.contactsToCheck({ whatsappLink: "", whatsappStatus: "UNVERIFIED", instagram: "", instagramStatus: "UNVERIFIED" }), 0, "nothing saved: nothing to check");
});

/* ── notes at import ── */

test("importNotes: the contact evidence note, then the website findings marked by origin and confirmation", () => {
  const now = new Date("2026-11-19T08:00:00.000Z");
  const [contact, audit, ...rest] = store.importNotes(lead() as never, now);
  assert.equal(rest.length, 0);
  assert.match(contact, /^Public contact evidence from the Daily Lead Agent/);
  assert.match(audit, /^Website check from the Daily Lead Agent, dated \d{4}-\d{2}-\d{2} \(https:\/\/riad-test\.ma\/\)/);
  assert.match(audit, /\(unconfirmed\): seen "4400 ms"/, "a finding a second read didn't confirm stays marked");
  assert.doesNotMatch(audit, /Not set up for phones \(unconfirmed\)/);
  assert.match(audit, /Saved by that day's Daily Lead Agent run; the site was not re-checked at import\./);
  assert.doesNotMatch(audit, /Find businesses|Sent by the browser/);
});

test("importNotes: no website note for a no-website lead or legacy findings; the contact note always", () => {
  const now = new Date("2026-11-19T08:00:00.000Z");
  const noSite = store.importNotes(lead({ kind: "NO_WEBSITE", website: "", finalUrl: null, outcome: null, findings: [] }) as never, now);
  assert.equal(noSite.length, 1);
  const legacy = store.importNotes(lead({ findings: undefined, contacts: undefined, whatsappConfidence: undefined }) as never, now);
  assert.equal(legacy.length, 1, "no findings: no website note");
  assert.match(legacy[0], /No public WhatsApp, Instagram or e-mail link was found/);
  const offSite = store.importNotes(lead({ findings: [{ id: "E_VIEWPORT", sentence: "s", observed: "x", sourceUrl: "https://elsewhere.ma/", fetchedAt: CHECKED, evidence: "FIRM" }] }) as never, now);
  assert.equal(offSite.length, 1, "findings from another site are never kept");
});

test("the Find businesses audit note keeps its own wording", async () => {
  const { buildAuditNote } = await import("../src/lib/audit-note");
  const n = buildAuditNote({ outcome: "COMPLETE", auditedAt: CHECKED, finalUrl: "https://riad-test.ma/", findings: [{ id: "E_VIEWPORT", observed: "None found", sourceUrl: "https://riad-test.ma/", fetchedAt: CHECKED }] },
    "https://riad-test.ma", Date.parse("2026-11-19T08:00:00.000Z"))!;
  assert.match(n, /^Website check from Find businesses/);
  assert.match(n, /Sent by the browser with the import/);
});

test("importCandidates saves server notes with the prospect; a request body can't add notes; duplicates still skipped", async () => {
  const session = { userId: "u1", fullName: "Tester", role: "SALES", email: "t@x.test", avatarInitials: "T" };
  const cand = { sourceId: "node/7", source: "OSM", name: "Riad Test", sector: "RIADS", city: "Marrakech", website: "https://riad-test.ma", mapsUrl: "https://www.openstreetmap.org/node/7" };
  db.existing = []; db.created = [];
  const out = await imp.importCandidates({ candidates: [cand], allowPossibleDuplicates: false }, session as never, { serverNotes: (id) => (id === "node/7" ? ["note A", "note B", "  "] : ["wrong"]) });
  assert.equal(out.status, 200);
  const notes = (db.created[0].notes as { create: { content: string; authorId: string }[] }).create;
  assert.deepEqual(notes.map((n) => [n.content, n.authorId]), [["note A", "u1"], ["note B", "u1"]], "blank notes dropped; attributed to the importer");
  assert.equal(db.created[0].whatsappStatus, "UNVERIFIED");
  assert.equal(db.created[0].instagramStatus, "UNVERIFIED");

  db.created = [];
  await imp.importCandidates({ candidates: [{ ...cand, notes: ["injected"], serverNotes: ["injected"] }] }, session as never);
  assert.equal(db.created[0]?.notes, undefined, "extra body fields never become notes");

  db.created = [];
  db.existing = [{ id: "x", name: "Someone else", phone: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "", website: "https://riad-test.ma", email: "" }];
  const dup = await imp.importCandidates({ candidates: [cand], allowPossibleDuplicates: false }, session as never, { serverNotes: () => ["note A"] });
  assert.equal(dup.status, 200);
  assert.equal(db.created.length, 0, "the CRM duplicate check runs first: no prospect, no notes");
  db.existing = [];
});

/* ── reading it back ── */

test("getProspectContactEvidence reads the run's saved lead; nothing for other prospects or broken data", async () => {
  db.discoveryResult = { sourceUrl: "https://www.openstreetmap.org/node/7", sweep: { keyword: JSON.stringify({ state: { v: 1, cursors: {} }, stats: null, leads: { "node/7": lead() } }) } };
  const e = await store.getProspectContactEvidence("p1");
  assert.equal(e?.items.length, 4);
  assert.equal(e?.whatsappConfidence, "HIGH");
  db.discoveryResult = null;
  assert.equal(await store.getProspectContactEvidence("p1"), null, "not imported from Today");
  db.discoveryResult = { sourceUrl: "https://www.openstreetmap.org/node/7", sweep: { keyword: "not json" } };
  assert.equal(await store.getProspectContactEvidence("p1"), null);
  db.discoveryResult = { sourceUrl: "https://www.openstreetmap.org/node/8", sweep: { keyword: JSON.stringify({ state: { v: 1, cursors: {} }, stats: null, leads: { "node/7": lead() } }) } };
  assert.equal(await store.getProspectContactEvidence("p1"), null, "another lead's details are never used");
  db.discoveryResult = null;
});

/* ── outreach stays behind a person's check ── */

test("drafts still need a channel a person marked VERIFIED, whatever the evidence says", async () => {
  const { verifiedChannels } = await import("../src/lib/prospect-outreach-draft");
  const p = { whatsappLink: "https://wa.me/212612345678", phone: "", instagram: "riad.test", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED" };
  assert.deepEqual(verifiedChannels(p), [], "HIGH-confidence evidence is not a check");
  assert.deepEqual(verifiedChannels({ ...p, whatsappStatus: "VERIFIED" }), ["WHATSAPP"]);
  assert.deepEqual(verifiedChannels({ ...p, instagramStatus: "UNAVAILABLE" }), []);
  const src = ["src/lib/contact-evidence.ts", "src/lib/daily-leads-store.ts"].map(read).join("\n");
  assert.doesNotMatch(src, /whatsappStatus:\s*"VERIFIED"|instagramStatus:\s*"VERIFIED"/, "nothing here marks a contact verified");
});

/* ── wiring and UI ── */

test("wiring: notes from the server's lead, evidence on the prospect page, the count on Today, no contact data in logs", () => {
  const route = read("src/app/api/admin/daily-leads/route.ts");
  assert.match(route, /const notes = importNotes\(lead\);/);
  assert.match(route, /allowPossibleDuplicates: false/);
  const prospectRoute = read("src/app/api/admin/prospecting/[id]/route.ts");
  assert.match(prospectRoute, /const contactEvidence = await getProspectContactEvidence\(id\)\.catch\(\(\) => null\);/, "never blocks the page");
  const check = read("src/components/admin/contact-check.tsx");
  for (const s of ["not a check", "doesn&apos;t apply to the one saved now", "OpenStreetMap tag", "Confidence"]) assert.ok(check.includes(s), s);
  assert.match(check, /Opened, matches the business/, "the manual decision is unchanged");
  const page = read("src/app/admin/prospecting/[id]/page.tsx");
  assert.match(page, /evidenceForSaved\(ev, "WHATSAPP", prospect\.whatsappLink\)/);
  assert.match(page, /evidenceForSaved\(ev, "INSTAGRAM", prospect\.instagram\)/);
  assert.ok(page.includes("no check exists for these; nothing was verified"));
  const card = read("src/components/admin/todays-leads.tsx");
  assert.ok(card.includes("still to check by hand (WhatsApp or Instagram)"));
  for (const f of ["src/lib/contact-evidence.ts", "src/lib/daily-leads-store.ts", "src/app/api/admin/daily-leads/route.ts"]) {
    assert.doesNotMatch(read(f), /console\.(log|info|warn|error)\([^)]*(contact|whatsapp|email|instagram|phone|note)/i, `${f}: no contact data in logs`);
  }
});

test("Today: imported leads carry the contacts-to-check count; not imported or a failed read leaves it out", async () => {
  const day = "2026-11-19";
  const keyword = JSON.stringify({ state: { v: 1, cursors: {} }, stats: null, leads: { "node/7": lead(), "node/8": lead({ osmId: "node/8", osmUrl: "https://www.openstreetmap.org/node/8", name: "Dar Other" }) } });
  db.sweeps = [{
    id: `daily-agent-${day}`, status: "COMPLETED", startedAt: new Date(`${day}T06:00:00Z`), completedAt: new Date(`${day}T06:04:00Z`), error: null, keyword,
    results: [
      { id: "r7", sourceUrl: "https://www.openstreetmap.org/node/7", importedProspectId: "p1", importedAt: new Date(`${day}T07:00:00Z`) },
      { id: "r8", sourceUrl: "https://www.openstreetmap.org/node/8", importedProspectId: null, importedAt: null },
    ],
  }];
  db.prospects = [{ id: "p1", whatsappLink: "https://wa.me/212612345678", whatsappStatus: "UNVERIFIED", instagram: "riad.test", instagramStatus: "VERIFIED" }];
  const view = await store.getTodayLeads(day);
  assert.deepEqual(view.leads.map((l) => [l.osmId, l.contactsToCheck]), [["node/7", 1], ["node/8", null]], "one WhatsApp still to check; the other lead isn't imported");

  db.findManyThrows = true;
  const fallback = await store.getTodayLeads(day);
  assert.deepEqual(fallback.leads.map((l) => l.contactsToCheck), [null, null], "the leads still show without the count");
  db.findManyThrows = false;

  db.prospects = [];
  assert.equal((await store.getTodayLeads(day)).leads[0].contactsToCheck, null, "a deleted prospect: no count, no error");
  db.sweeps = [];
});
