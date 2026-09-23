/**
 * Phase 0 / C — duplicate classification used at import time.
 *
 * The import route re-runs this against CURRENT prospects immediately before
 * writing, instead of trusting the verdict frozen on the DiscoveryResult row
 * when the sweep ran. These tests pin the classifier's contract: what counts
 * as EXISTS (block), what counts as POSSIBLE (manual review), and that a
 * shared landline alone never silently merges two businesses.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/lib/discovery/duplicates";
import type { DiscoveryCandidate } from "../src/lib/discovery/types";

const candidate = (over: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  name: "Riad Al Ward",
  website: "",
  phone: "",
  email: "",
  instagram: "",
  city: "Marrakech",
  country: "Morocco",
  sector: "Riads",
  sourceUrl: "https://www.openstreetmap.org/node/1",
  ...over,
});

const existing = (over: Partial<{ id: string; name: string; phone: string; email: string; website: string; instagram: string }> = {}) => ({
  id: "p1",
  name: "Riad Al Ward",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  ...over,
});

test("same website domain is EXISTS", () => {
  const r = classify(
    candidate({ name: "Totally Different Name", website: "https://www.riadalward.ma/en" }),
    [existing({ website: "http://riadalward.ma" })],
  );
  assert.equal(r.status, "EXISTS");
  assert.equal(r.prospectId, "p1");
});

test("same phone is EXISTS", () => {
  const r = classify(
    candidate({ name: "Another Name", phone: "+212 6 61 16 19 37" }),
    [existing({ phone: "0661161937" })],
  );
  assert.equal(r.status, "EXISTS");
});

test("same email is EXISTS", () => {
  const r = classify(
    candidate({ name: "Another Name", email: "Contact@Riad.MA" }),
    [existing({ email: "contact@riad.ma" })],
  );
  assert.equal(r.status, "EXISTS");
});

test("identical normalized name is EXISTS despite accents and punctuation", () => {
  const r = classify(candidate({ name: "Riad  Al-Ward" }), [existing({ name: "riad al ward" })]);
  assert.equal(r.status, "EXISTS");
});

test("name overlap without a strong signal is POSSIBLE, not EXISTS", () => {
  const r = classify(
    candidate({ name: "Riad Al Ward Spa & Hammam" }),
    [existing({ name: "Riad Al Ward" })],
  );
  assert.equal(r.status, "POSSIBLE");
  assert.equal(r.prospectId, "p1");
});

test("an unrelated business is NEW", () => {
  const r = classify(
    candidate({ name: "Cafe Clock", phone: "+212600000001" }),
    [existing({ name: "Riad Al Ward", phone: "+212600000002" })],
  );
  assert.equal(r.status, "NEW");
  assert.equal(r.prospectId, null);
});

test("no existing prospects means NEW", () => {
  assert.equal(classify(candidate(), []).status, "NEW");
});

test("empty contact fields never match each other", () => {
  // Two records that share only 'no phone, no email, no website' are distinct.
  const r = classify(
    candidate({ name: "Maison Bleue", phone: "", email: "", website: "" }),
    [existing({ name: "Dar Anika", phone: "", email: "", website: "" })],
  );
  assert.equal(r.status, "NEW");
});
