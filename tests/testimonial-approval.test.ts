/**
 * Testimonial rules (lib/testimonial-approval): one shared testimonial per project. What a save
 * writes and unpublishes, and when it may be published. Fixtures are test data, not testimonials.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_LOCALE,
  approvalFingerprint,
  approvalProblem,
  approvalSchema,
  draftSchema,
  planTestimonialSave,
  testimonialStatus,
  type TestimonialDraft,
  type TestimonialState,
} from "../src/lib/testimonial-approval";

const published = new Date("2026-10-20T10:00:00Z");
const state = (over: Partial<TestimonialState> = {}): TestimonialState => ({
  projectId: "p1",
  kind: "CLIENT",
  author: "Fixture Author",
  consent: "Fixture consent reference",
  quote: "Fixture quote.",
  role: "Fixture role",
  approvedAt: published,
  approvedBy: "Admin",
  hasCanonicalRow: true,
  ...over,
});
const draftFrom = (s: TestimonialState): TestimonialDraft => ({ author: s.author, consent: s.consent, quote: s.quote, role: s.role });
const expectedFrom = (s: TestimonialState) => ({ author: s.author, role: s.role, quote: s.quote });

test("the shared testimonial lives on the French row", () => {
  assert.equal(CANONICAL_LOCALE, "fr");
});

test("saving unchanged values writes and unpublishes nothing", () => {
  const plan = planTestimonialSave(state(), draftFrom(state()));
  assert.deepEqual(plan, { project: {}, unpublish: false, changed: false });
});

test("editing the quote or the role unpublishes it", () => {
  for (const edit of [{ quote: "Fixture quote, edited." }, { role: "Another role" }]) {
    const plan = planTestimonialSave(state(), { ...draftFrom(state()), ...edit });
    assert.equal(plan.unpublish, true, JSON.stringify(edit));
    assert.equal(plan.reason, "quote_or_role_edited");
    assert.ok(plan.text && plan.changed);
  }
});

test("changing the author unpublishes it", () => {
  const plan = planTestimonialSave(state(), { ...draftFrom(state()), author: "Another Author" });
  assert.deepEqual([plan.unpublish, plan.reason, plan.project.author, plan.text], [true, "author_edited", "Another Author", undefined]);
});

test("removing the consent reference unpublishes it; editing it does not", () => {
  let plan = planTestimonialSave(state(), { ...draftFrom(state()), consent: "" });
  assert.deepEqual([plan.unpublish, plan.reason], [true, "consent_removed"]);
  plan = planTestimonialSave(state(), { ...draftFrom(state()), consent: "Updated reference" });
  assert.deepEqual([plan.unpublish, plan.reason, plan.project.consent], [false, undefined, "Updated reference"]);
});

test("an edit always clears the publication, even if it was not published when read (no reason recorded)", () => {
  const plan = planTestimonialSave(state({ approvedAt: null, approvedBy: null }), { ...draftFrom(state()), quote: "New." });
  assert.deepEqual([plan.unpublish, plan.reason], [true, undefined]);
});

test("draft validation trims, enforces limits and rejects locales or approval fields", () => {
  assert.deepEqual(
    draftSchema.parse({ author: "  A  ", consent: " c ", quote: " q ", role: " r " }),
    { author: "A", consent: "c", quote: "q", role: "r" },
  );
  for (const bad of [
    { author: "A", consent: "", quote: "q", role: "r", approvedAt: "2026-01-01" },
    { author: "A", consent: "", quote: "q", role: "r", locales: { fr: { quote: "q", role: "r" } } },
    { author: "A", consent: "", quote: "q" },
    { author: "x".repeat(81), consent: "", quote: "q", role: "r" },
    { author: "A", consent: "", quote: "x".repeat(701), role: "r" },
  ]) assert.equal(draftSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 80));
});

test("approval requests: publish needs the expected values; no locale is accepted", () => {
  assert.equal(approvalSchema.safeParse({ action: "approve" }).success, false);
  assert.equal(approvalSchema.safeParse({ action: "approve", expected: { author: "a", role: "r", quote: "q" } }).success, true);
  assert.equal(approvalSchema.safeParse({ action: "approve", locale: "fr", expected: { author: "a", role: "r", quote: "q" } }).success, false);
  assert.equal(approvalSchema.safeParse({ action: "revoke" }).success, true);
  assert.equal(approvalSchema.safeParse({ action: "revoke", locale: "en" }).success, false);
  assert.equal(approvalSchema.safeParse({ action: "publish" }).success, false);
});

test("publishing needs a Client project, a consent reference, author, role, quote and unchanged values", () => {
  const s = state({ approvedAt: null, approvedBy: null });
  assert.equal(approvalProblem(s, expectedFrom(s)), null);
  assert.match(approvalProblem(state({ kind: "CONCEPT" }), expectedFrom(s))!, /Client/);
  assert.match(approvalProblem(state({ consent: "  " }), expectedFrom(s))!, /consent/);
  assert.match(approvalProblem(state({ author: "" }), { ...expectedFrom(s), author: "" })!, /author/);
  assert.match(approvalProblem(state({ role: "" }), { ...expectedFrom(s), role: "" })!, /role/);
  assert.match(approvalProblem(state({ quote: " " }), { ...expectedFrom(s), quote: " " })!, /quote/);
  assert.match(approvalProblem(state({ hasCanonicalRow: false }), expectedFrom(s))!, /French/);
  assert.match(approvalProblem(s, { ...expectedFrom(s), quote: "Old text." })!, /changed since you loaded it/);
  assert.match(approvalProblem(s, { ...expectedFrom(s), author: "Someone else" })!, /changed since you loaded it/);
  assert.match(approvalProblem(state({ quote: "x".repeat(701) }), { ...expectedFrom(s), quote: "x".repeat(701) })!, /too long/);
});

test("status, and a stable approval fingerprint that never contains the text", async () => {
  assert.equal(testimonialStatus({ quote: " ", role: "", approvedAt: null }), "empty");
  assert.equal(testimonialStatus({ quote: "q", role: "", approvedAt: null }), "draft");
  assert.equal(testimonialStatus(state()), "published");
  const a = await approvalFingerprint({ author: "A", role: "R", quote: "Q" });
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await approvalFingerprint({ author: "A", role: "R", quote: "Q" }));
  assert.notEqual(a, await approvalFingerprint({ author: "A", role: "R", quote: "Q." }));
});
