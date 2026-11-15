/** Today's leads issue presentation: titles and cautious wording over the P6A findings, nothing invented. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINDINGS } from "../src/lib/prospect-outreach-draft";
import { KNOWN_ISSUE_IDS, groupIssues, issueCopy } from "../src/lib/lead-issue-copy";

const f = (id: string, observed = "None found", sentence = "s") => ({ id, observed, sentence });

test("every customer-facing finding the check can produce has a title, an explanation and a cautious impact", () => {
  assert.deepEqual([...KNOWN_ISSUE_IDS].sort(), FINDINGS.map(([id]) => id).sort());
  for (const id of KNOWN_ISSUE_IDS) {
    const c = issueCopy(f(id, id === "E_RESPONSE_TIME" ? "5853 ms" : id === "E_HTTPS" ? "http://x.ma" : id === "E_HTTP_REDIRECT" ? "HTTP 200" : "None found"));
    assert.ok(c.title && c.explanation && c.impact, id);
    assert.match(c.impact!, /\bmay\b/, `${id}: impact stays a possibility`);
    assert.doesNotMatch(`${c.title} ${c.explanation} ${c.impact}`, /\d+\s?%|conversion|lost (sales|customers|revenue)|losing|guarantee/i, `${id}: no measured or promised loss`);
  }
});

test("speed is one check, with the observed figure, never a verdict", () => {
  const c = issueCopy(f("E_RESPONSE_TIME", "5853 ms"));
  assert.equal(c.title, "Slow to respond in one check");
  assert.match(c.explanation, /about 5\.9 s .*single check\. Speed can vary\./);
  assert.match(c.impact!, /^If this is typical/);
});

test("customer-facing and minor technical/SEO are kept apart, in the check's order", () => {
  const g = groupIssues([f("E_OPEN_GRAPH"), f("E_HTTPS", "http://x"), f("E_DESCRIPTION"), f("E_CONTACT")]);
  assert.deepEqual(g.customer.map((x) => x.finding.id), ["E_HTTPS", "E_CONTACT"]);
  assert.deepEqual(g.technical.map((x) => x.finding.id), ["E_OPEN_GRAPH", "E_DESCRIPTION"]);
});

test("an unknown finding falls back to the check's own sentence, with no impact added", () => {
  assert.deepEqual(issueCopy(f("E_NEW", "x", "something the check saw")), { group: "TECHNICAL", title: "Something the check saw", explanation: "", impact: null });
});

test("the card keeps the original evidence one click away", () => {
  const card = readFileSync(new URL("../src/components/admin/todays-leads.tsx", import.meta.url), "utf8");
  assert.match(card, /<IssueList findings=\{lead\.findings\} open=\{open\} \/>/);
  assert.match(card, /\{f\.sentence\}\s*<span[^>]*> — observed: \{f\.observed\}/, "Review evidence still shows the check's sentence and observation");
  for (const s of ["What a customer would notice", "Minor technical / SEO", "Possible impact:", "Review evidence"]) assert.ok(card.includes(s), s);
});
