/**
 * /api/admin/projects/[id]/testimonial: permissions and request handling, with the session
 * and the data layer mocked (an in-memory project; no database). The SQL itself is covered
 * by tests/testimonial-db.test.ts against an isolated database.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { SavePlan, TestimonialLocale, TestimonialState } from "../src/lib/testimonial-approval";

type Session = { userId: string; email: string; fullName: string; role: string; avatarInitials: string } | null;
let session: Session = null;
const admin: Session = { userId: "u-admin", email: "a@x.ma", fullName: "Admin One", role: "admin", avatarInitials: "AO" };
const sales: Session = { userId: "u-sales", email: "s@x.ma", fullName: "Sales One", role: "sales", avatarInitials: "SO" };

let db: TestimonialState;
const audits: { action: string; locale?: string; reason?: string; by: string }[] = [];
const fresh = (): TestimonialState => ({
  projectId: "p1", kind: "CLIENT", author: "Fixture Author", consent: "Fixture consent",
  locales: {
    fr: { quote: "Citation FR.", role: "Rôle FR", approvedAt: null, approvedBy: null },
    en: { quote: "Quote EN.", role: "Role EN", approvedAt: null, approvedBy: null },
    ar: { quote: "", role: "", approvedAt: null, approvedBy: null },
  },
});
const clone = (s: TestimonialState): TestimonialState => structuredClone(s);

mock.module("@/lib/auth", { namedExports: { getSession: async () => session } });
mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async () => {} } });
mock.module("@/lib/dal", {
  namedExports: {
    getTestimonialState: async (id: string) => (id === "p1" ? clone(db) : null),
    saveTestimonialDraft: async (_id: string, plan: SavePlan, actor: { userName: string }) => {
      const was = [...plan.locales.map((l) => l.locale), ...plan.clearOnly].filter((l) => db.locales[l]?.approvedAt);
      if (plan.project.author !== undefined) db.author = plan.project.author;
      if (plan.project.consent !== undefined) db.consent = plan.project.consent;
      for (const l of plan.locales) db.locales[l.locale] = { quote: l.quote, role: l.role, approvedAt: null, approvedBy: null };
      for (const l of plan.clearOnly) Object.assign(db.locales[l]!, { approvedAt: null, approvedBy: null });
      audits.push({ action: "TESTIMONIAL_UPDATED", by: actor.userName });
      for (const l of was) audits.push({ action: "TESTIMONIAL_REVOKED", locale: l, reason: "edited", by: actor.userName });
      return was;
    },
    approveTestimonial: async (_id: string, locale: TestimonialLocale, exp: { author: string; role: string; quote: string }, actor: { userName: string }) => {
      const l = db.locales[locale]!;
      if (l.quote !== exp.quote || l.role !== exp.role || db.author !== exp.author) return false;
      Object.assign(l, { approvedAt: new Date(), approvedBy: actor.userName });
      audits.push({ action: "TESTIMONIAL_APPROVED", locale, by: actor.userName });
      return true;
    },
    revokeTestimonial: async (_id: string, locale: TestimonialLocale, actor: { userName: string }) => {
      const l = db.locales[locale]!;
      if (!l.approvedAt) return false;
      Object.assign(l, { approvedAt: null, approvedBy: null });
      audits.push({ action: "TESTIMONIAL_REVOKED", locale, reason: "manual", by: actor.userName });
      return true;
    },
  },
});

let route: typeof import("../src/app/api/admin/projects/[id]/testimonial/route");
before(async () => { route = await import("../src/app/api/admin/projects/[id]/testimonial/route"); });
const params = (id = "p1") => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) =>
  new Request("http://x/api/admin/projects/p1/testimonial", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const draft = (over: Record<string, unknown> = {}) => ({
  author: db.author, consent: db.consent,
  locales: Object.fromEntries(Object.entries(db.locales).map(([l, v]) => [l, { quote: v!.quote, role: v!.role }])),
  ...over,
});
const approveBody = (locale: TestimonialLocale) => ({
  action: "approve", locale, expected: { author: db.author, role: db.locales[locale]!.role, quote: db.locales[locale]!.quote },
});

beforeEach(() => { db = fresh(); audits.length = 0; session = admin; });

test("signed-out requests are refused on every method", async () => {
  session = null;
  assert.equal((await route.GET(req("GET"), params())).status, 401);
  assert.equal((await route.PUT(req("PUT", draft()), params())).status, 401);
  assert.equal((await route.POST(req("POST", approveBody("fr")), params())).status, 401);
  assert.equal(audits.length, 0);
});

test("only admins can publish or hide; a non-admin team member can still edit the draft", async () => {
  session = sales;
  const a = await route.POST(req("POST", approveBody("fr")), params());
  assert.equal(a.status, 403);
  const r = await route.POST(req("POST", { action: "revoke", locale: "fr" }), params());
  assert.equal(r.status, 403);
  assert.equal(db.locales.fr!.approvedAt, null);
  const p = await route.PUT(req("PUT", draft({ author: "Edited Author" })), params());
  assert.equal(p.status, 200);
  assert.deepEqual(audits.map((x) => x.action), ["TESTIMONIAL_UPDATED"]);
});

test("an admin approves one locale; the response never includes anything but the admin state", async () => {
  const res = await route.POST(req("POST", approveBody("fr")), params());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.locales.fr.approvedAt && body.locales.fr.approvedBy === "Admin One");
  assert.equal(body.locales.en.approvedAt, null, "EN not touched");
  assert.deepEqual(audits, [{ action: "TESTIMONIAL_APPROVED", locale: "fr", by: "Admin One" }]);
});

test("approval is refused with 409 when the values changed, or prerequisites are missing", async () => {
  const stale = await route.POST(req("POST", { ...approveBody("fr"), expected: { author: "Fixture Author", role: "Rôle FR", quote: "Old text." } }), params());
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /changed since you loaded it/);
  const emptyAr = await route.POST(req("POST", approveBody("ar")), params());
  assert.equal(emptyAr.status, 409);
  db.consent = "";
  assert.equal((await route.POST(req("POST", approveBody("fr")), params())).status, 409);
  db = fresh(); db.kind = "CONCEPT";
  assert.equal((await route.POST(req("POST", approveBody("fr")), params())).status, 409);
  assert.equal(audits.length, 0, "refusals write nothing");
});

test("editing an approved quote revokes it, with an audit entry; other locales keep theirs", async () => {
  await route.POST(req("POST", approveBody("fr")), params());
  await route.POST(req("POST", approveBody("en")), params());
  audits.length = 0;
  const d = draft();
  d.locales.fr = { quote: "Citation FR, modifiée.", role: "Rôle FR" };
  const res = await route.PUT(req("PUT", d), params());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.revoked, ["fr"]);
  assert.equal(body.locales.fr.approvedAt, null);
  assert.ok(body.locales.en.approvedAt, "EN still published");
  assert.deepEqual(audits.map((a) => `${a.action}:${a.locale ?? ""}`), ["TESTIMONIAL_UPDATED:", "TESTIMONIAL_REVOKED:fr"]);
});

test("changing the author revokes every published locale", async () => {
  await route.POST(req("POST", approveBody("fr")), params());
  await route.POST(req("POST", approveBody("en")), params());
  const res = await route.PUT(req("PUT", draft({ author: "Another Author" })), params());
  assert.deepEqual((await res.json()).revoked.sort(), ["en", "fr"]);
});

test("manual revoke hides the locale and is audited; revoking again is harmless", async () => {
  await route.POST(req("POST", approveBody("fr")), params());
  audits.length = 0;
  assert.equal((await route.POST(req("POST", { action: "revoke", locale: "fr" }), params())).status, 200);
  assert.equal(db.locales.fr!.approvedAt, null);
  assert.equal((await route.POST(req("POST", { action: "revoke", locale: "fr" }), params())).status, 200);
  assert.deepEqual(audits, [{ action: "TESTIMONIAL_REVOKED", locale: "fr", reason: "manual", by: "Admin One" }]);
});

test("a draft cannot smuggle in an approval, and invalid bodies are rejected", async () => {
  const sneaky = draft();
  (sneaky.locales.fr as Record<string, unknown>).approvedAt = "2026-01-01";
  assert.equal((await route.PUT(req("PUT", sneaky), params())).status, 400);
  assert.equal((await route.PUT(req("PUT", { ...draft(), approved: true }), params())).status, 400);
  assert.equal((await route.PUT(new Request("http://x", { method: "PUT", body: "{not json" }), params())).status, 400);
  assert.equal((await route.POST(req("POST", { action: "approve", locale: "fr" }), params())).status, 400, "approve without expected values");
  assert.equal(db.locales.fr!.approvedAt, null);
});

test("unknown project: 404; saving unchanged values writes and audits nothing", async () => {
  assert.equal((await route.GET(req("GET"), params("nope"))).status, 404);
  assert.equal((await route.POST(req("POST", approveBody("fr")), params("nope"))).status, 404);
  const res = await route.PUT(req("PUT", draft()), params());
  assert.equal(res.status, 200);
  assert.equal(audits.length, 0);
});

test("a testimonial for a locale the project was never saved in is refused", async () => {
  delete db.locales.ar;
  const res = await route.PUT(req("PUT", { ...draft(), locales: { ...draft().locales, ar: { quote: "اقتباس", role: "مديرة" } } }), params());
  assert.equal(res.status, 409);
});
