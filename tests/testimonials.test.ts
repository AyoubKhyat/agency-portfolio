/**
 * The public gate (lib/testimonials): only rows approved for the page's locale, on visible
 * Client projects, with a quote, an author and a role, ever reach the homepage.
 * The fixtures below are test data, not testimonials.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publicTestimonials, type PublishedTestimonialInput } from "../src/lib/testimonials";

const row = (over: Partial<PublishedTestimonialInput> = {}): PublishedTestimonialInput => ({
  slug: "client-a", kind: "CLIENT", visible: true, project: "Client A",
  author: "Fixture Author", role: "Fixture role", quote: "  Fixture quote A.  ", approvedAt: new Date("2026-10-01"), ...over,
});

test("an approved client quote is shown, trimmed, with author, role and project", () => {
  assert.deepEqual(publicTestimonials([row()]), [
    { slug: "client-a", project: "Client A", quote: "Fixture quote A.", author: "Fixture Author", role: "Fixture role" },
  ]);
  assert.equal(publicTestimonials([row({ approvedAt: "2026-10-01T10:00:00.000Z" })]).length, 1, "serialized dates too");
});

test("never shown: unapproved, concept or hidden projects, missing or empty parts, oversize text", () => {
  const cases: Partial<PublishedTestimonialInput>[] = [
    { approvedAt: null },
    { approvedAt: "not a date" },
    { kind: "CONCEPT" },
    { kind: null },
    { visible: false },
    { visible: undefined },
    { quote: null }, { quote: "   " },
    { author: null }, { author: " " },
    { role: null }, { role: "" },
    { quote: "x".repeat(701) },
    { role: "x".repeat(121) },
    { author: "x".repeat(81) },
  ];
  for (const c of cases) assert.deepEqual(publicTestimonials([row(c)]), [], JSON.stringify(c));
});

test("one testimonial per project, in the order given (admin order)", () => {
  const list = [row({ slug: "client-d", project: "Client D" }), row(), row({ quote: "A second quote for A." })];
  assert.deepEqual(publicTestimonials(list).map((t) => [t.slug, t.quote]), [["client-d", "Fixture quote A."], ["client-a", "Fixture quote A."]]);
});

test("the removed invented testimonials and the code-level approval list are not back", () => {
  for (const l of ["fr", "en", "ar"]) {
    const m = JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"));
    assert.equal(m.Testimonials, undefined, `${l}: no Testimonials namespace`);
    for (const k of Object.keys(m.HomeV2)) assert.doesNotMatch(k, /^tst_(q|name|role|author)/, `${l}: HomeV2.${k}`);
  }
  assert.equal(fs.existsSync("src/components/Testimonials.tsx"), false);
  assert.doesNotMatch(fs.readFileSync("src/lib/testimonials.ts", "utf8"), /APPROVED_TESTIMONIALS\s*[:=]/, "approval lives in the database now");
});
