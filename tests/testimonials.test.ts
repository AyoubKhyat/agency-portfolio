/**
 * Homepage testimonials are shown only when explicitly approved (lib/testimonials):
 * a stored quote alone, a concept project or an unapproved locale is never enough.
 * The fixtures below are test data, not testimonials.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { APPROVED_TESTIMONIALS, approvedTestimonials, type TestimonialApproval } from "../src/lib/testimonials";

const projects = [
  { slug: "client-a", kind: "CLIENT", title: "Client A", testimonial: "  Fixture quote A.  " },
  { slug: "client-b", kind: "CLIENT", title: "Client B", testimonial: "" },
  { slug: "concept-c", kind: "CONCEPT", title: "Concept C", testimonial: "Fixture quote C." },
  { slug: "client-d", kind: "CLIENT", title: "Client D", testimonial: "Fixture quote D." },
];
const approval = (over: Partial<TestimonialApproval> = {}): TestimonialApproval => ({
  slug: "client-a", author: "Fixture Author", roles: { fr: "Fixture role FR", en: "Fixture role EN" }, approvedOn: "2026-10-01", ...over,
});

test("nothing is approved: no testimonial is shown, even with quotes stored in the admin", () => {
  assert.deepEqual(approvedTestimonials(projects, "fr", []), []);
  // The real registry: every entry must be complete (and it is empty until a client approves a quote).
  for (const a of APPROVED_TESTIMONIALS) {
    assert.ok(a.author.trim() && a.slug.trim(), "author and project");
    assert.match(a.approvedOn, /^\d{4}-\d{2}-\d{2}$/, "approval date");
    assert.ok(Object.values(a.roles).some((r) => r?.trim()), "at least one approved locale");
  }
});

test("an approved client quote is shown in its approved locales, trimmed, with author and role", () => {
  assert.deepEqual(approvedTestimonials(projects, "fr", [approval()]), [
    { slug: "client-a", project: "Client A", quote: "Fixture quote A.", author: "Fixture Author", role: "Fixture role FR" },
  ]);
  assert.equal(approvedTestimonials(projects, "en", [approval()])[0].role, "Fixture role EN");
  assert.deepEqual(approvedTestimonials(projects, "ar", [approval()]), [], "Arabic was not approved");
});

test("never shown: concept projects, empty or missing quotes, unknown projects, incomplete approvals", () => {
  const cases: TestimonialApproval[] = [
    approval({ slug: "concept-c" }),
    approval({ slug: "client-b" }),
    approval({ slug: "not-a-project" }),
    approval({ author: "  " }),
    approval({ roles: { fr: " " } }),
    approval({ approvedOn: "" }),
    approval({ approvedOn: "soon" }),
    approval({ approvedOn: "2026-13-45" }),
  ];
  for (const a of cases) assert.deepEqual(approvedTestimonials(projects, "fr", [a]), [], JSON.stringify(a));
});

test("order follows the approval list", () => {
  const list = [approval({ slug: "client-d" }), approval()];
  assert.deepEqual(approvedTestimonials(projects, "fr", list).map((t) => t.slug), ["client-d", "client-a"]);
});

test("the removed invented testimonials are not back", () => {
  for (const l of ["fr", "en", "ar"]) {
    const m = JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"));
    assert.equal(m.Testimonials, undefined, `${l}: no Testimonials namespace`);
    for (const k of Object.keys(m.HomeV2)) assert.doesNotMatch(k, /^tst_(q|name|role|author)/, `${l}: HomeV2.${k}`);
  }
  assert.equal(fs.existsSync("src/components/Testimonials.tsx"), false);
});
