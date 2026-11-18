/**
 * Find businesses → Full check → import: the link into Check a website, its pre-fill (which never runs a check by
 * itself), and the audit Find sends with an import. The server side of the note is in prospect-discovery-import.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fullCheckHref, prefillUrl, QUALIFY_PATH } from "../src/lib/qualify-link";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("Full check link: /admin/qualify?url=<encoded address>, only for web addresses", () => {
  assert.equal(fullCheckHref("https://riad-atlas.ma/"), `${QUALIFY_PATH}?url=https%3A%2F%2Friad-atlas.ma%2F`);
  const tricky = "https://riad.ma/fr/contact?x=1&y=a b#top";
  const href = fullCheckHref(tricky)!;
  assert.equal(new URLSearchParams(href.split("?")[1]).get("url"), tricky, "query, & and # survive the round trip");
  assert.doesNotMatch(href.slice(QUALIFY_PATH.length + 5), /[&#?/ ]/, "the address can't add parameters or a fragment to the link");
  assert.equal(fullCheckHref("http://riad.ma"), `${QUALIFY_PATH}?url=http%3A%2F%2Friad.ma`);
  for (const bad of ["", "  ", null, undefined, "javascript:alert(1)", "data:text/html,x", "/admin/users", "riad.ma", "ftp://riad.ma",
    "https://user:pw@riad.ma", `https://riad.ma/${"a".repeat(400)}`]) {
    assert.equal(fullCheckHref(bad), null, String(bad));
  }
});

test("pre-fill: reads ?url= only when it is a web address", () => {
  assert.equal(prefillUrl("?url=https%3A%2F%2Friad-atlas.ma%2F"), "https://riad-atlas.ma/");
  assert.equal(prefillUrl(fullCheckHref("https://riad.ma/a?b=1&c=2")!.split("?").slice(1).join("?")), "https://riad.ma/a?b=1&c=2");
  for (const bad of ["", "?", "?url=", "?url=javascript%3Aalert(1)", "?url=%2Fadmin", "?other=https%3A%2F%2Friad.ma", `?url=${encodeURIComponent(`https://r.ma/${"a".repeat(400)}`)}`]) {
    assert.equal(prefillUrl(bad), "", bad);
  }
});

test("Check a website fills the box from the link and never runs a check by itself", () => {
  const page = read("src/app/admin/qualify/page.tsx");
  const effect = /useEffect\(\(\) => \{([\s\S]*?)\n {2}\}, \[\]\);/.exec(page)?.[1] ?? "";
  assert.ok(effect, "a mount-only effect reads the link");
  assert.match(effect, /prefillUrl\(window\.location\.search\)/);
  assert.match(effect, /setUrl\(\(current\) => current \|\| prefill\)/, "it never overwrites what a person typed");
  assert.doesNotMatch(effect, /fetch\(|run\(|requestSubmit|submit\(|setLoading|setResult/, "nothing is checked until Check is pressed");
  assert.equal((page.match(/fetch\("\/api\/admin\/prospect-qualification"/g) ?? []).length, 1, "the only check is the form's");
  assert.match(page, /<form onSubmit=\{run\}/);
  assert.match(page, /Nothing is sent, saved or added to the CRM\./, "the standalone tool stays read-only");
});

test("Find businesses: Full check link on each result, and the card's check goes with the import", () => {
  const page = read("src/app/admin/batch-discovery/page.tsx");
  assert.match(page, /const fullCheck = fullCheckHref\(a\.finalUrl \?\? c\.website\);/);
  assert.match(page, /<a href=\{fullCheck\} target="_blank" rel="noopener noreferrer"[^>]*>\s*Full check/);
  assert.match(page, /candidates: \[\{ \.\.\.c, whatsapp: a\.whatsapp\.link \|\| null, audit: auditFor\(a\) \}\]/);
  const auditFor = /function auditFor\(a: AuditedCandidate\) \{([\s\S]*?)\n\}/.exec(page)?.[1] ?? "";
  assert.match(auditFor, /outcome: a\.outcome, auditedAt: a\.auditedAt, finalUrl: a\.finalUrl/);
  assert.match(auditFor, /findings: a\.findings\.map\(\(f\) => \(\{ id: f\.id, observed: f\.observed, sourceUrl: f\.sourceUrl, fetchedAt: f\.fetchedAt \}\)\)/,
    "only the fields the server accepts; no client-written text");
  assert.match(page, /rankTop\(audited\)/, "ranking unchanged");
});

test("the import route accepts the audit as optional and writes the note inside the prospect's create", () => {
  const route = read("src/lib/prospect-import.ts"); // the import logic, shared by the import API and the Daily Lead Agent
  assert.match(route, /audit: auditSchema\.optional\(\),/);
  assert.match(route, /const auditNote = cand\.audit \? buildAuditNote\(cand\.audit, website\) : null;/);
  // The audit note comes first among the notes, and every note is written inside the prospect's own create.
  assert.match(route, /const noteTexts = \[\.\.\.\(auditNote \? \[auditNote\] : \[\]\), /);
  assert.match(route, /prisma\.prospect\.create\(\{\s*data: \{\s*\.\.\.\(noteRows\.length > 0 \? \{ notes: \{ create: noteRows\.length === 1 \? noteRows\[0\] : noteRows \} \} : \{\}\),/);
  assert.doesNotMatch(route, /prospectNote\.create/, "no separate note write that could outlive a failed prospect write");
});
