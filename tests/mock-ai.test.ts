/**
 * Phase 0 / F — mock output must never pass for real analysis.
 *
 * MockAiProvider is the SILENT fallback whenever no AI key is configured, and
 * its template prose reads exactly like an analyst wrote it. Unmarked, a
 * placeholder outreach draft is one copy-paste away from a real business owner.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAiProvider, MOCK_MARKER } from "../src/lib/ai/mock";

const auditInput = {
  name: "Riad Al Ward",
  sector: "Luxury Hotels",
  city: "Marrakech",
  country: "Morocco",
  website: "",
  hasWebsite: false,
  hasEmail: false,
  hasInstagram: true,
  hasPhone: true,
};

const outreachInput = {
  businessName: "Riad Al Ward",
  sector: "Luxury Hotels",
  city: "Marrakech",
  country: "Morocco",
  language: "en" as const,
  suggestedOffer: "Direct-booking site",
};

test("the mock provider declares itself as not real", () => {
  const p = new MockAiProvider();
  assert.equal(p.name, "MOCK");
  assert.equal(p.isReal, false);
});

test("every audit field carries the sample-text marker", async () => {
  const audit = await new MockAiProvider().generateAudit(auditInput);
  for (const [key, value] of Object.entries(audit)) {
    assert.ok(value.startsWith(MOCK_MARKER), `${key} is unmarked mock text`);
  }
});

test("outreach drafts carry the marker so they survive copy-paste", async () => {
  const p = new MockAiProvider();
  const email = await p.generateOutreachEmail(outreachInput);
  const whatsapp = await p.generateOutreachWhatsApp(outreachInput);

  assert.ok(email.subject.startsWith(MOCK_MARKER));
  assert.ok(email.body.startsWith(MOCK_MARKER));
  assert.ok(whatsapp.startsWith(MOCK_MARKER));
});

test("the marker says why the text is a placeholder", () => {
  assert.match(MOCK_MARKER, /SAMPLE TEXT/);
  assert.match(MOCK_MARKER, /no AI provider configured/);
});

test("marking is idempotent", async () => {
  const audit = await new MockAiProvider().generateAudit(auditInput);
  const twice = audit.aiSummary.split(MOCK_MARKER).length - 1;
  assert.equal(twice, 1, "marker should appear exactly once");
});
