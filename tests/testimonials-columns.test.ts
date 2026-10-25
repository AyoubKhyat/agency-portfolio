/**
 * The scrolling testimonial columns (components/ui/testimonials-columns-1):
 * every quote at every breakpoint, scrolling only when a column can loop,
 * the loop copy hidden from screen readers, and none of the reference
 * component's demo content shipped. Fixtures are test data, not testimonials.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COLUMN_DURATIONS, TestimonialsColumns, splitColumns, type TestimonialItem } from "../src/components/ui/testimonials-columns-1";

const items = (n: number): TestimonialItem[] =>
  Array.from({ length: n }, (_, i) => ({ text: `Fixture quote ${i + 1}.`, name: `Fixture Author ${i + 1}`, role: `Fixture role ${i + 1}` }));
const render = (n: number) => renderToStaticMarkup(createElement(TestimonialsColumns, { testimonials: items(n) }));
const layouts = (markup: string) => [...markup.matchAll(/data-columns="(\d)" class="([^"]*)"/g)].map((m) => ({ cols: Number(m[1]), cls: m[2] }));

test("round-robin split keeps every testimonial, once, in order per column", () => {
  assert.deepEqual(splitColumns([1, 2, 3, 4, 5, 6, 7], 3), [[1, 4, 7], [2, 5], [3, 6]]);
  assert.deepEqual(splitColumns([1, 2], 3), [[1], [2]], "never an empty column");
  assert.deepEqual(splitColumns([], 3), []);
});

test("1 / 2 / 3 columns by breakpoint, each layout showing every quote", () => {
  const markup = render(9);
  assert.deepEqual(layouts(markup).map((l) => l.cols), [1, 2, 3]);
  assert.match(layouts(markup)[0].cls, /\bflex md:hidden\b/);
  assert.match(layouts(markup)[1].cls, /\bhidden md:flex lg:hidden\b/);
  assert.match(layouts(markup)[2].cls, /\bhidden lg:flex\b/);
  for (let i = 1; i <= 9; i++) {
    // 3 layouts × 2 copies (scrolling): every quote is in every layout.
    assert.equal(markup.split(`Fixture quote ${i}.`).length - 1, 6, `quote ${i}`);
  }
  assert.deepEqual([...COLUMN_DURATIONS], [15, 19, 17], "slightly different durations per column");
});

test("columns scroll only when they can loop; the loop copy is aria-hidden", () => {
  const many = render(6); // 1×6, 2×3, 3×2: every layout scrolls
  assert.equal((many.match(/aria-hidden="true" class="contents"/g) ?? []).length, 1 + 2 + 3);
  assert.equal((many.match(/mask-image/g) ?? []).length, 3);
  const few = render(2); // the 2- and 3-column layouts hold one card per column: static
  assert.equal((few.match(/aria-hidden="true" class="contents"/g) ?? []).length, 1, "only the phone layout (2 cards) scrolls");
  const one = render(1);
  assert.ok(!one.includes('aria-hidden="true"'), "a single quote is a static card");
  assert.ok(!one.includes("mask-image"));
});

test("no portrait unless one is supplied", () => {
  assert.ok(!render(3).includes("<img"));
  const withImage = renderToStaticMarkup(createElement(TestimonialsColumns, { testimonials: [{ ...items(1)[0], image: "/clients/a.webp" }] }));
  assert.match(withImage, /<img[^>]*src="\/clients\/a\.webp"[^>]*alt=""/);
});

test("none of the reference demo content ships", () => {
  const read = (files: string[]) => files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const code = read(["src/components/ui/testimonials-columns-1.tsx", "src/components/home-v2/HomeV2.tsx", "src/lib/testimonials.ts"]);
  // The translations legitimately tag a real portfolio project "ERP"; they are checked for names and stock photos only.
  const copy = read(["fr", "en", "ar"].map((l) => `src/messages/${l}.json`));
  const people = /unsplash|randomuser|pravatar|Briana Patton|Bilal Ahmed|Saman Malik|Omar Raza|Zainab Hussain|Aliza Khan|Farhan Siddiqui|Sana Sheikh|Hassan Ali/i;
  assert.doesNotMatch(code, people);
  assert.doesNotMatch(code, /\bERP\b/);
  assert.doesNotMatch(copy, people);
});
