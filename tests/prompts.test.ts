/**
 * Phase 0 / D + E — what we tell the model about a prospect.
 *
 * D: generate-message used to hardcode `website: null`, so a prospect with a
 *    stored URL was described to the model as having none.
 * E: generate-audit used to instruct the model to base findings on what is
 *    "typical for this sector" and to make every observation "feel observed".
 *    That produced invented claims presented as fact.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUserPrompt as buildMessagePrompt,
  buildSystemPrompt as buildMessageSystemPrompt,
  describeWebsite,
} from "../src/app/api/admin/prospecting/[id]/generate-message/route";
import {
  buildKnownFacts,
  buildSystemPrompt as buildAuditSystemPrompt,
  buildUserPrompt as buildAuditUserPrompt,
} from "../src/app/api/admin/prospecting/[id]/generate-audit/route";

/* ───────────────── D — website reaches the message prompt ───────────────── */

const messageArgs = {
  name: "Riad Al Ward",
  sector: "Riads",
  city: "Medina",
  hasWebsite: true,
  website: "https://riadalward.ma",
  instagram: "riadalward",
  followUpStage: "Initial contact (Day 1)",
  previousMessages: [] as string[],
  feedback: null,
  previousAttempt: null,
};

test("a stored website URL reaches the message prompt", () => {
  const prompt = buildMessagePrompt(messageArgs);
  assert.match(prompt, /https:\/\/riadalward\.ma/);
  assert.doesNotMatch(prompt, /URL unknown/);
  assert.doesNotMatch(prompt, /Has a website: no/);
});

test("no stored website is reported as no website", () => {
  const prompt = buildMessagePrompt({ ...messageArgs, hasWebsite: false, website: null });
  assert.match(prompt, /Has a website: no/);
});

test("hasWebsite true but no URL never claims a URL we do not have", () => {
  const out = describeWebsite(true, null);
  assert.match(out, /URL not stored/);
  assert.doesNotMatch(out, /https?:\/\//);
});

test("describeWebsite trusts a stored URL even if the legacy boolean disagrees", () => {
  assert.equal(describeWebsite(false, "https://example.ma"), "yes (https://example.ma)");
  assert.equal(describeWebsite(false, "   "), "no");
});

test("the message prompt forbids describing content we have not seen", () => {
  const sys = buildMessageSystemPrompt("fr", "FRIENDLY", "GET_REPLY", false);
  assert.match(sys, /EVIDENCE DISCIPLINE/);
  assert.match(sys, /have NOT visited their website/);
});

/* ───────────────── E — the audit may not fabricate observations ───────────────── */

const prospect = {
  name: "Riad Al Ward",
  sector: "Riads",
  neighborhood: "Medina",
  instagram: "riadalward",
  hasWebsite: true,
  website: "https://riadalward.ma",
};

test("known facts are derived only from stored columns", () => {
  const facts = buildKnownFacts(prospect);
  assert.ok(facts.some((f) => f.includes("Riad Al Ward")));
  assert.ok(facts.some((f) => f.includes("https://riadalward.ma")));
  assert.ok(facts.some((f) => f.includes("@riadalward")));
  // Every fact must flag that nothing was actually inspected.
  assert.ok(facts.some((f) => /NOT inspected/.test(f)));
});

test("a missing website is stated as 'not on file', not as 'has no website'", () => {
  const facts = buildKnownFacts({ ...prospect, hasWebsite: false, website: null });
  const line = facts.find((f) => f.includes("No website URL on file"));
  assert.ok(line, "expected a 'no URL on file' fact");
  assert.match(line, /not that none exists/);
});

test("the audit prompt no longer instructs the model to fabricate", () => {
  const sys = buildAuditSystemPrompt("fr");
  const forbidden = [
    /feel observed/i,
    /what's typical for this sector/i,
    /would credibly apply/i,
    /base findings on/i,
  ];
  for (const re of forbidden) {
    assert.doesNotMatch(sys, re, `fabrication instruction still present: ${re}`);
  }
});

test("the audit prompt states plainly that nothing was inspected", () => {
  const sys = buildAuditSystemPrompt("fr");
  assert.match(sys, /You have NOT seen/);
  assert.match(sys, /HYPOTHESIS/);
  assert.match(sys, /MUST NOT state anything about their website design/);

  const user = buildAuditUserPrompt(buildKnownFacts(prospect));
  assert.match(user, /NOT AVAILABLE/);
  assert.match(user, /KNOWN FACTS/);
});

test("the audit prompt does not ask for observations at all", () => {
  const sys = buildAuditSystemPrompt("en");
  assert.doesNotMatch(sys, /- Observation:/);
  assert.match(sys, /verification step/);
});
