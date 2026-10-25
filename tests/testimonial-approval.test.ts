/**
 * Testimonial rules (lib/testimonial-approval): what a save writes and revokes, and when a
 * locale may be approved. Fixtures are test data, not testimonials.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approvalFingerprint,
  approvalProblem,
  approvalSchema,
  draftSchema,
  localeStatus,
  planTestimonialSave,
  type TestimonialDraft,
  type TestimonialState,
} from "../src/lib/testimonial-approval";

const approved = new Date("2026-10-20T10:00:00Z");
const state = (over: Partial<TestimonialState> = {}): TestimonialState => ({
  projectId: "p1",
  kind: "CLIENT",
  author: "Fixture Author",
  consent: "Fixture consent reference",
  locales: {
    fr: { quote: "Citation FR.", role: "Rôle FR", approvedAt: approved, approvedBy: "Admin" },
    en: { quote: "Quote EN.", role: "Role EN", approvedAt: approved, approvedBy: "Admin" },
    ar: { quote: "", role: "", approvedAt: null, approvedBy: null },
  },
  ...over,
});
const draftFrom = (s: TestimonialState): TestimonialDraft => ({
  author: s.author,
  consent: s.consent,
  locales: Object.fromEntries(Object.entries(s.locales).map(([l, v]) => [l, { quote: v!.quote, role: v!.role }])),
});

test("saving unchanged values writes and revokes nothing", () => {
  const plan = planTestimonialSave(state(), draftFrom(state()));
  assert.equal(plan.changed, false);
  assert.deepEqual([plan.locales, plan.revoked, plan.clearOnly, plan.project], [[], [], [], {}]);
});

test("editing an approved quote revokes that locale only (language isolation)", () => {
  const d = draftFrom(state());
  d.locales.fr = { quote: "Citation FR modifiée.", role: "Rôle FR" };
  const plan = planTestimonialSave(state(), d);
  assert.deepEqual(plan.locales, [{ locale: "fr", quote: "Citation FR modifiée.", role: "Rôle FR" }]);
  assert.deepEqual(plan.revoked, [{ locale: "fr", reason: "quote_or_role_edited" }]);
  assert.deepEqual(plan.clearOnly, [], "EN keeps its approval and its text is not written");
});

test("editing an approved role revokes that locale", () => {
  const d = draftFrom(state());
  d.locales.en = { quote: "Quote EN.", role: "Founder" };
  assert.deepEqual(planTestimonialSave(state(), d).revoked, [{ locale: "en", reason: "quote_or_role_edited" }]);
});

test("editing a draft locale writes it; no revocation is recorded because none was approved", () => {
  const d = draftFrom(state());
  d.locales.ar = { quote: "اقتباس.", role: "مديرة" };
  const plan = planTestimonialSave(state(), d);
  assert.deepEqual(plan.locales.map((l) => l.locale), ["ar"]);
  assert.deepEqual(plan.revoked, []);
});

test("changing the author revokes every approved locale", () => {
  const d = { ...draftFrom(state()), author: "Another Author" };
  const plan = planTestimonialSave(state(), d);
  assert.equal(plan.project.author, "Another Author");
  assert.deepEqual(plan.clearOnly.sort(), ["ar", "en", "fr"]);
  assert.deepEqual(plan.revoked.map((r) => [r.locale, r.reason]).sort(), [["en", "author_edited"], ["fr", "author_edited"]]);
});

test("removing the consent reference revokes every approved locale; editing it does not", () => {
  let plan = planTestimonialSave(state(), { ...draftFrom(state()), consent: "" });
  assert.deepEqual(plan.revoked.map((r) => r.reason), ["consent_removed", "consent_removed"]);
  plan = planTestimonialSave(state(), { ...draftFrom(state()), consent: "Updated reference" });
  assert.equal(plan.project.consent, "Updated reference");
  assert.deepEqual([plan.revoked, plan.clearOnly], [[], []]);
});

test("a locale without a saved translation cannot receive a testimonial", () => {
  const s = state({ locales: { fr: state().locales.fr } });
  const plan = planTestimonialSave(s, { ...draftFrom(s), locales: { fr: { quote: "Citation FR.", role: "Rôle FR" }, en: { quote: "New", role: "x" } } });
  assert.deepEqual(plan.missingLocales, ["en"]);
});

test("nothing is copied between locales: a draft with only FR leaves EN and AR untouched", () => {
  const plan = planTestimonialSave(state(), { author: "Fixture Author", consent: "Fixture consent reference", locales: { fr: { quote: "Nouvelle citation.", role: "Rôle FR" } } });
  assert.deepEqual(plan.locales.map((l) => l.locale), ["fr"]);
});

test("draft validation trims, enforces limits and rejects unknown fields and locales", () => {
  const ok = draftSchema.parse({ author: "  A  ", consent: " c ", locales: { fr: { quote: " q ", role: " r " } } });
  assert.deepEqual(ok, { author: "A", consent: "c", locales: { fr: { quote: "q", role: "r" } } });
  for (const bad of [
    { author: "A", consent: "", locales: { de: { quote: "q", role: "r" } } },
    { author: "A", consent: "", locales: {}, approvedAt: "2026-01-01" },
    { author: "A", consent: "", locales: { fr: { quote: "q", role: "r", approvedAt: "2026-01-01" } } },
    { author: "x".repeat(81), consent: "", locales: {} },
    { author: "A", consent: "", locales: { fr: { quote: "x".repeat(701), role: "" } } },
  ]) assert.equal(draftSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 80));
});

test("approval requests: approve needs the expected values; nothing else is accepted", () => {
  assert.equal(approvalSchema.safeParse({ action: "approve", locale: "fr" }).success, false);
  assert.equal(approvalSchema.safeParse({ action: "approve", locale: "fr", expected: { author: "a", role: "r", quote: "q" } }).success, true);
  assert.equal(approvalSchema.safeParse({ action: "revoke", locale: "ar" }).success, true);
  assert.equal(approvalSchema.safeParse({ action: "publish", locale: "fr" }).success, false);
  assert.equal(approvalSchema.safeParse({ action: "revoke", locale: "de" }).success, false);
});

test("approval preconditions: client project, consent, author, role, quote, unchanged values", () => {
  const s = state();
  const exp = { author: "Fixture Author", role: "Rôle FR", quote: "Citation FR." };
  assert.equal(approvalProblem(s, "fr", exp), null);
  assert.match(approvalProblem(state({ kind: "CONCEPT" }), "fr", exp)!, /Client/);
  assert.match(approvalProblem(state({ consent: "  " }), "fr", exp)!, /consent/);
  assert.match(approvalProblem(state({ author: "" }), "fr", { ...exp, author: "" })!, /author/);
  assert.match(approvalProblem(s, "ar", { author: "Fixture Author", role: "", quote: "" })!, /role/);
  const noQuote = state({ locales: { fr: { quote: "", role: "Rôle FR", approvedAt: null, approvedBy: null } } });
  assert.match(approvalProblem(noQuote, "fr", { ...exp, quote: "" })!, /quote/);
  assert.match(approvalProblem(s, "fr", { ...exp, quote: "Citation FR (old)." })!, /changed since you loaded it/);
  assert.match(approvalProblem(s, "fr", { ...exp, author: "Someone else" })!, /changed since you loaded it/);
  assert.match(approvalProblem(state({ locales: {} }), "fr", exp)!, /Save the project in this language/);
});

test("status per locale, and a stable approval fingerprint that never contains the text", async () => {
  assert.equal(localeStatus(undefined), "empty");
  assert.equal(localeStatus(state().locales.ar), "empty");
  assert.equal(localeStatus(state().locales.fr), "published");
  assert.equal(localeStatus({ quote: "q", role: "", approvedAt: null, approvedBy: null }), "draft");
  const a = await approvalFingerprint({ author: "A", role: "R", quote: "Q" });
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await approvalFingerprint({ author: "A", role: "R", quote: "Q" }));
  assert.notEqual(a, await approvalFingerprint({ author: "A", role: "R", quote: "Q." }));
});
