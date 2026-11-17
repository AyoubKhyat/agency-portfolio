/** Daily Lead Agent qualification: firm vs uncertain evidence, SEO-only rejection, sectors and competitors. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { firmCustomerIssues, gradeFindings, hasCustomerIssue, isCompetitor, qualifies, sectorPriority } from "../src/lib/daily-leads-quality";
import { rankWebsiteLeads } from "../src/lib/daily-leads";
import type { AuditedCandidate } from "../src/lib/batch-discovery";

const f = (id: string, observed = "None found") => ({ id, sentence: id, observed });
const HOME = "https://x.ma/";

test("SEO/technical findings alone never qualify", () => {
  const seo = gradeFindings([f("E_DESCRIPTION"), f("E_OPEN_GRAPH"), f("E_TITLE"), f("E_HTTP_REDIRECT", "HTTP 200")]);
  assert.equal(hasCustomerIssue(seo), false);
  assert.equal(qualifies(seo), false);
});

test("HTTPS and viewport problems are firm", () => {
  assert.equal(qualifies(gradeFindings([f("E_HTTPS", "http://x.ma")])), true);
  assert.equal(qualifies(gradeFindings([f("E_VIEWPORT"), f("E_OPEN_GRAPH")])), true);
});

test("a slow page is never firm: one sample, or two correlated samples from the same server region", () => {
  const slow = [f("E_RESPONSE_TIME", "4400 ms")];
  assert.equal(gradeFindings(slow)[0].evidence, "UNCERTAIN");
  const twice = gradeFindings(slow, { pagesRead: [HOME], contacts: [], homeMs: 5100 });
  assert.equal(twice[0].evidence, "UNCERTAIN");
  assert.match(twice[0].note!, /5\.1 s/);
  assert.equal(qualifies(twice), false);
  assert.equal(gradeFindings(slow, { pagesRead: [HOME], contacts: [], homeMs: 700 })[0].evidence, "UNCERTAIN");
});

const CONTACT = "https://x.ma/contact";
const second = (contactPages: { url: string; read: boolean; complete: boolean; kinds: string[] }[], contacts: { channel: string; sourceUrl: string }[] = []) =>
  ({ pagesRead: [HOME, ...contactPages.filter((p) => p.read).map((p) => p.url)], contacts, contactPages });

test("home-page contact is firm only when the journey is demonstrably poor", () => {
  const noContact = [f("E_CONTACT")];
  const noLink = gradeFindings(noContact, second([]))[0];
  assert.deepEqual([noLink.evidence, /doesn't link to a Contact page/.test(noLink.note!)], ["FIRM", true]);
  const emptyContactPage = gradeFindings(noContact, second([{ url: CONTACT, read: true, complete: true, kinds: [] }]))[0];
  assert.deepEqual([emptyContactPage.evidence, /\/contact\) shows no phone/.test(emptyContactPage.note!)], ["FIRM", true]);
});

test("home-page contact is uncertain when a linked Contact page works, can't be checked, or wasn't looked at", () => {
  const noContact = [f("E_CONTACT")];
  const working = gradeFindings(noContact, second([{ url: CONTACT, read: true, complete: true, kinds: ["form", "phone"] }]))[0];
  assert.equal(working.evidence, "UNCERTAIN");
  assert.match(working.note!, /Contact page \(\/contact\) has form, phone/);
  assert.equal(gradeFindings(noContact, second([{ url: CONTACT, read: false, complete: false, kinds: [] }]))[0].evidence, "UNCERTAIN", "unreadable");
  assert.equal(gradeFindings(noContact, second([{ url: CONTACT, read: true, complete: false, kinds: [] }]))[0].evidence, "UNCERTAIN", "JS shell / cut off");
  assert.equal(gradeFindings(noContact)[0].evidence, "UNCERTAIN", "no second read");
  assert.equal(gradeFindings(noContact, second([], [{ channel: "WHATSAPP", sourceUrl: HOME }]))[0].evidence, "UNCERTAIN", "second read found WhatsApp on home");
  // An Instagram link isn't a contact option in the audit's sense, so it doesn't contradict it.
  assert.equal(gradeFindings(noContact, second([], [{ channel: "INSTAGRAM", sourceUrl: HOME }]))[0].evidence, "FIRM");
});

test("firm count ignores uncertain and technical findings", () => {
  const g = gradeFindings([f("E_HTTPS", "http://x"), f("E_RESPONSE_TIME", "4000 ms"), f("E_TITLE")], { pagesRead: [HOME], contacts: [], homeMs: 4100 });
  assert.equal(firmCustomerIssues(g), 1);
});

test("competitors: agency sector or explicit agency wording only; bare communication/marketing/media words are not enough", () => {
  for (const c of [
    { name: "SEOCOM", sector: "IT_COMPANIES" }, { name: "Agence de communication Atlas", sector: "EVENT_AGENCIES" },
    { name: "Agence Web Atlas", sector: "IT_COMPANIES" }, { name: "Atlas Pub", sector: "MARKETING" },
    { name: "Studio K", sector: "IT_COMPANIES", website: "https://www.seo-marrakech.ma" },
    { name: "Nova", sector: "PRINTING", website: "https://nova-webdesign.com" }, { name: "Kech Digital Agency", sector: "IT_COMPANIES" },
  ]) assert.equal(isCompetitor(c), true, c.name);
  for (const c of [
    { name: "Grand Hotel Tazi", sector: "HOTELS", website: "https://grandhoteltazi.com" }, { name: "Seoul Garden", sector: "RESTAURANTS" },
    { name: "Museo Café", sector: "CAFES" }, { name: "Révostyle", sector: "BEAUTY", website: "https://revostyle.ma" },
    { name: "Imprimerie Digital Print", sector: "PRINTING" }, { name: "Genious Communications", sector: "EVENT_AGENCIES" },
    { name: "Atlas Communications (Maroc Telecom)", sector: "ELECTRONICS" }, { name: "Marketing Plaza Hotel", sector: "HOTELS" },
    { name: "Média Print", sector: "PRINTING" }, { name: "Publicité Atlas Imprimerie", sector: "PRINTING" },
  ]) assert.equal(isCompetitor(c), false, c.name);
});

test("sector priority orders qualified leads but never rescues an unqualified one", () => {
  assert.equal(sectorPriority("HOTELS"), 1);
  assert.equal(sectorPriority("LAWYERS"), 0);
  const a = (name: string, sector: string, ids: [string, string][], score: number) => ({
    audited: {
      candidate: { sourceId: `node/${name}`, source: "OSM", name, sector, city: "Marrakech", neighborhood: null, phone: null, whatsapp: null,
        website: `https://${name}.ma`, email: null, instagram: null, facebook: null, mapsUrl: null, rating: null, reviewCount: null },
      outcome: "COMPLETE", finalUrl: `https://${name}.ma/`, auditedAt: "t",
      findings: ids.map(([id, observed]) => ({ id, check: id, observed, sourceUrl: "s", fetchedAt: "t", sentence: id })),
      otherProblems: [], score, whatsapp: { link: "", confidence: "NONE", sources: [], status: "UNVERIFIED" }, inCrm: null,
    } as AuditedCandidate,
    contacts: [],
  });
  const lawyerTwoFirm = a("lawyer", "LAWYERS", [["E_HTTPS", "http://x"], ["E_VIEWPORT", "None found"]], 19);
  const hotelOneFirm = a("hotel", "HOTELS", [["E_HTTPS", "http://x"]], 10);
  const spaUncertainOnly = a("spa", "SPAS", [["E_RESPONSE_TIME", "4400 ms"]], 7);
  const order = rankWebsiteLeads([spaUncertainOnly, lawyerTwoFirm, hotelOneFirm]).map((x) => x.audited.candidate.name);
  assert.deepEqual(order, ["hotel", "lawyer", "spa"]);
});
