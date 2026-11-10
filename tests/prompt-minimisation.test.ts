/**
 * Data minimisation: what the AI Workforce sends to Groq. Evidence is built by the real website checks from
 * pages full of identifying text, and the prompt must hold only fixed labels, codes and numbers.
 * No database, network or AI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEvidence, type Evidence } from "../src/lib/website-audit/checks";
import type { SafeResponse } from "../src/lib/website-audit/safe-fetch";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

let mod: typeof import("../src/lib/ai-workforce/inbound-diagnosis");
test.before(async () => {
  mod = await import("../src/lib/ai-workforce/inbound-diagnosis");
});

const NAME_TITLE = "Dr Ahmed Benali — Cabinet dentaire, 12 rue Ibn Sina";
const DISGUISED = "Écrivez à ahmed [at] benali.ma, ahmed(at)benali(dot)ma ou @ahmed.benali.officiel. Tél ٠٦٢٥٤٦١٦٤٥ ou 06 25 46";

function page(html: string, finalUrl = "https://ahmed-benali-dentiste.ma/"): SafeResponse {
  return { requestedUrl: finalUrl, finalUrl, status: 200, headers: {}, body: html, bytes: html.length, truncated: false, ms: 420, hops: [] };
}
function evidenceFor(html: string, finalUrl?: string): Evidence[] {
  return buildEvidence({
    page: page(html, finalUrl), httpProbe: null, robotsFound: true, robotsUrl: "https://ahmed-benali-dentiste.ma/robots.txt",
    sitemap: { state: "missing", url: "https://ahmed-benali-dentiste.ma/sitemap.xml" }, fetchedAt: "2026-11-10T00:00:00.000Z",
  });
}
const HTML = (title: string, description: string, lang = "fr") =>
  `<!doctype html><html lang="${lang}"><head><title>${title}</title><meta name="description" content="${description}">` +
  `<meta name="viewport" content="width=device-width"></head><body><h1>Cabinet du Dr Benali</h1>` +
  `<a href="tel:+212625461645">Appeler</a><img src="a.jpg" alt="Dr Ahmed Benali"><p>${"Texte du cabinet. ".repeat(30)}</p></body></html>`;

const IDENTIFYING = [/Ahmed/i, /Benali/i, /dentiste/i, /Ibn Sina/i, /\[at\]|\(at\)|\(dot\)/i, /officiel/i, /[٠-٩]/, /06 25 46/, /212625461645/, /\.ma\b/, /Écrivez|Cabinet/i];

test("names, disguised emails, Arabic-Indic digits and identifying domains never reach the prompt", () => {
  const evidence = evidenceFor(HTML(NAME_TITLE, DISGUISED));
  const stored = JSON.stringify(evidence);
  assert.match(stored, /Benali/, "the stored evidence still holds the site's text, for the admin view");
  assert.match(stored, /ahmed-benali-dentiste\.ma/);

  const user = mod.buildUserPrompt({ evidence });
  for (const re of IDENTIFYING) assert.doesNotMatch(user, re, String(re));
  assert.equal(JSON.stringify(evidence), stored, "building the prompt doesn't change the stored evidence");

  const facts = Object.fromEntries(mod.minimiseEvidence(evidence).map((f) => [f.id, f.observed]));
  assert.equal(facts.E_TITLE, `Present, ${Array.from(NAME_TITLE).length} characters`);
  assert.equal(facts.E_DESCRIPTION, `Present, ${Array.from(DISGUISED).length} characters`);
  assert.equal(facts.E_HTTPS, "https");
  assert.equal(facts.E_LANG, 'lang="fr"');
  assert.equal(facts.E_CONTACT, "phone");
  assert.equal(facts.E_RESPONSE_TIME, "420 ms");
});

test("every observed value sent is a fixed label, a code or a number", () => {
  const closed = /^(?:Present|Present, \d{1,3} characters|Present, over 155 characters|Present, not a standard language code|https?|lang="[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}"|HTTP \d{3}(?: to https)?|Plain http did not answer|\d+ ms|(?:Over )?\d+ KB|Not sent|Only applies over HTTPS|\d+ found|\d+ of \d+ without alt|No images in the HTML|(?:email|form|phone|whatsapp)(?:, (?:email|form|phone|whatsapp))*|Found|Not found|Could not check|None found(?: \(page (?:too large to read fully|is rendered by JavaScript)\))?)$/i;
  const pages = [
    evidenceFor(HTML(NAME_TITLE, DISGUISED)),
    evidenceFor(HTML("", "", "")),
    evidenceFor(HTML("Salon Fatima Zahra", "Coiffure", "Fatima Zahra salon"), "http://fatima-zahra.ma/"),
  ];
  for (const evidence of pages) {
    for (const f of mod.minimiseEvidence(evidence)) assert.match(f.observed, closed, `${f.id}: ${f.observed}`);
  }
  const http = Object.fromEntries(mod.minimiseEvidence(pages[2]).map((f) => [f.id, f.observed]));
  assert.equal(http.E_HTTPS, "http");
  assert.equal(http.E_LANG, "Present, not a standard language code", "a name in lang= is not passed on");
});

test("a title or description cut at the limit only says it is long", () => {
  const long = "Ahmed Benali ".repeat(20);
  const facts = Object.fromEntries(mod.minimiseEvidence(evidenceFor(HTML(long, long))).map((f) => [f.id, f.observed]));
  assert.equal(facts.E_TITLE, "Present, over 155 characters");
  assert.equal(facts.E_DESCRIPTION, "Present, over 155 characters");
});

test("unexpected free text fails closed: nothing is sent", () => {
  const base = evidenceFor(HTML("Riad", "Riad"));
  const swap = (id: string, patch: Partial<Evidence>) => base.map((e) => (e.id === id ? { ...e, ...patch } : e));
  const cases: Evidence[][] = [
    swap("E_H1", { observed: "Dr Ahmed Benali" }),
    swap("E_RESPONSE_TIME", { observed: "420 ms, Ahmed" }),
    swap("E_CONTACT", { observed: "phone, ahmed@benali.ma" }),
    swap("E_HTTPS", { observed: "ahmed-benali.ma" }),
    swap("E_TITLE", { observed: "Dr Ahmed Benali" }),
    swap("E_LANG", { observed: "Ahmed" }),
    swap("E_H1", { check: "Heading of Dr Ahmed Benali's site: call +212 6" }),
    swap("E_H1", { status: "Ahmed" as Evidence["status"] }),
    [...base, { ...base[0], id: "E_NEW_CHECK", observed: "1 found" }],
  ];
  for (const evidence of cases) {
    assert.throws(() => mod.buildUserPrompt({ evidence }), (err: unknown) => err instanceof mod.UnsafeEvidenceError && !/Ahmed|Benali/.test(String(err)));
  }
});

test("the policy and the form notice describe the minimised data in every locale", () => {
  const WORDING = {
    fr: { policy: [/codes, de nombres et d'indications/, /L'adresse de votre site, le texte de vos pages, votre nom/], notice: /résultats techniques uniquement, sans recevoir l'adresse ni le contenu de votre site/ },
    en: { policy: [/codes, numbers and present\/absent indicators/, /Your site's address, the text of your pages, your name/], notice: /technical results only, without receiving your site's address or content/ },
    ar: { policy: [/رموز وأرقام ومؤشرات/, /عنوان موقعك ولا نصوص صفحاتك ولا اسمك/], notice: /نتائج تقنية فقط، دون أن تتلقى عنوان موقعك أو محتواه/ },
  } as const;
  for (const l of ["fr", "en", "ar"] as const) {
    const m = JSON.parse(read(`src/messages/${l}.json`));
    const use: string = m.Privacy.sections[2].items[3];
    for (const re of WORDING[l].policy) assert.match(use, re, `${l}: ${re}`);
    assert.match(use, /Groq, Inc\./);
    assert.doesNotMatch(use, /seuls constats techniques|technical findings only|الملاحظات التقنية وحدها/, `${l}: old wording left`);
    assert.match(m.Diagnosis.privacy_notice, WORDING[l].notice);
    assert.doesNotMatch(`${use} ${m.Diagnosis.privacy_notice}`, /anonym|aucune donnée personnelle|no personal data|مجهول/i, `${l}: no absolute claims`);
  }
});

test("the run stops before the AI on unexpected evidence, and the admin view explains why", () => {
  const src = read("src/lib/ai-workforce/inbound-diagnosis.ts");
  assert.match(src, /if \(err instanceof UnsafeEvidenceError\) return await auditOnly\("UNSAFE_EVIDENCE"\);/);
  assert.ok(src.indexOf('auditOnly("UNSAFE_EVIDENCE")') < src.indexOf("result = await generate("), "checked before the AI call");
  assert.match(read("src/components/admin/diagnosis-panel.tsx"), /UNSAFE_EVIDENCE: "A check returned something unexpected, so nothing was sent to the AI/);
  for (const lang of ["fr", "en", "ar"] as const) {
    const system = mod.buildSystemPrompt(lang);
    assert.match(system, /aren't given the site's address or text/);
    assert.doesNotMatch(system, /bare domain/);
  }
});
