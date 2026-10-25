/**
 * /api/admin/projects/[id]/testimonial (one shared testimonial per project): permissions and
 * request handling, with the session and the data layer mocked (an in-memory project; no
 * database). The SQL itself is covered by tests/testimonial-db.test.ts against an isolated database.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { SavePlan, TestimonialState } from "../src/lib/testimonial-approval";

type Session = { userId: string; email: string; fullName: string; role: string; avatarInitials: string } | null;
let session: Session = null;
const admin: Session = { userId: "u-admin", email: "a@x.ma", fullName: "Admin One", role: "admin", avatarInitials: "AO" };
const sales: Session = { userId: "u-sales", email: "s@x.ma", fullName: "Sales One", role: "sales", avatarInitials: "SO" };

let db: TestimonialState;
const audits: { action: string; reason?: string; by: string }[] = [];
const fresh = (): TestimonialState => ({
  projectId: "p1", kind: "CLIENT", author: "Fixture Author", consent: "Fixture consent",
  quote: "Fixture quote.", role: "Fixture role", approvedAt: null, approvedBy: null, hasCanonicalRow: true,
});

mock.module("@/lib/auth", { namedExports: { getSession: async () => session } });
mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async () => {} } });
mock.module("@/lib/dal", {
  namedExports: {
    getTestimonialState: async (id: string) => (id === "p1" ? structuredClone(db) : null),
    saveTestimonialDraft: async (_id: string, plan: SavePlan, actor: { userName: string }) => {
      const was = !!db.approvedAt;
      if (plan.project.author !== undefined) db.author = plan.project.author;
      if (plan.project.consent !== undefined) db.consent = plan.project.consent;
      if (plan.text) Object.assign(db, plan.text);
      if (plan.unpublish) Object.assign(db, { approvedAt: null, approvedBy: null });
      audits.push({ action: "TESTIMONIAL_UPDATED", by: actor.userName });
      if (was && plan.unpublish) audits.push({ action: "TESTIMONIAL_REVOKED", reason: plan.reason, by: actor.userName });
      return was && plan.unpublish;
    },
    approveTestimonial: async (_id: string, exp: { author: string; role: string; quote: string }, actor: { userName: string }) => {
      if (db.quote !== exp.quote || db.role !== exp.role || db.author !== exp.author) return false;
      Object.assign(db, { approvedAt: new Date(), approvedBy: actor.userName });
      audits.push({ action: "TESTIMONIAL_APPROVED", by: actor.userName });
      return true;
    },
    revokeTestimonial: async (_id: string, actor: { userName: string }) => {
      if (!db.approvedAt) return false;
      Object.assign(db, { approvedAt: null, approvedBy: null });
      audits.push({ action: "TESTIMONIAL_REVOKED", reason: "manual", by: actor.userName });
      return true;
    },
  },
});

let route: typeof import("../src/app/api/admin/projects/[id]/testimonial/route");
before(async () => { route = await import("../src/app/api/admin/projects/[id]/testimonial/route"); });
const params = (id = "p1") => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) =>
  new Request("http://x/api/admin/projects/p1/testimonial", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const draft = (over: Record<string, unknown> = {}) => ({ author: db.author, consent: db.consent, quote: db.quote, role: db.role, ...over });
const publishBody = () => ({ action: "approve", expected: { author: db.author, role: db.role, quote: db.quote } });

beforeEach(() => { db = fresh(); audits.length = 0; session = admin; });

test("signed-out requests are refused on every method", async () => {
  session = null;
  assert.equal((await route.GET(req("GET"), params())).status, 401);
  assert.equal((await route.PUT(req("PUT", draft()), params())).status, 401);
  assert.equal((await route.POST(req("POST", publishBody()), params())).status, 401);
  assert.equal(audits.length, 0);
});

test("only admins can publish or hide; a non-admin team member can still edit the draft", async () => {
  session = sales;
  assert.equal((await route.POST(req("POST", publishBody()), params())).status, 403);
  assert.equal((await route.POST(req("POST", { action: "revoke" }), params())).status, 403);
  assert.equal(db.approvedAt, null);
  assert.equal((await route.PUT(req("PUT", draft({ author: "Edited Author" })), params())).status, 200);
  assert.deepEqual(audits.map((x) => x.action), ["TESTIMONIAL_UPDATED"]);
});

test("an admin publishes the single testimonial; the response is the admin state", async () => {
  const res = await route.POST(req("POST", publishBody()), params());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.approvedAt && body.approvedBy === "Admin One");
  assert.equal("locales" in body, false, "no per-language state any more");
  assert.deepEqual(audits, [{ action: "TESTIMONIAL_APPROVED", by: "Admin One" }]);
});

test("publishing is refused with 409 when values changed or prerequisites are missing", async () => {
  const stale = await route.POST(req("POST", { action: "approve", expected: { author: "Fixture Author", role: "Fixture role", quote: "Old text." } }), params());
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /changed since you loaded it/);
  db.consent = "";
  assert.equal((await route.POST(req("POST", publishBody()), params())).status, 409, "no consent reference");
  db = fresh(); db.kind = "CONCEPT";
  assert.equal((await route.POST(req("POST", publishBody()), params())).status, 409, "concept project");
  db = fresh(); db.role = "";
  assert.equal((await route.POST(req("POST", publishBody()), params())).status, 409, "missing role");
  assert.equal(audits.length, 0, "refusals write nothing");
});

test("editing a published quote unpublishes it, with an audit entry", async () => {
  await route.POST(req("POST", publishBody()), params());
  audits.length = 0;
  const res = await route.PUT(req("PUT", draft({ quote: "Fixture quote, edited." })), params());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.unpublished, true);
  assert.equal(body.approvedAt, null);
  assert.deepEqual(audits.map((a) => `${a.action}${a.reason ? ":" + a.reason : ""}`), ["TESTIMONIAL_UPDATED", "TESTIMONIAL_REVOKED:quote_or_role_edited"]);
});

test("changing the author or removing the consent unpublishes it", async () => {
  await route.POST(req("POST", publishBody()), params());
  assert.equal((await (await route.PUT(req("PUT", draft({ author: "Another Author" })), params())).json()).unpublished, true);
  await route.POST(req("POST", publishBody()), params());
  assert.equal((await (await route.PUT(req("PUT", draft({ consent: "" })), params())).json()).unpublished, true);
  assert.equal(db.approvedAt, null);
});

test("manual hide is audited once; hiding again is harmless", async () => {
  await route.POST(req("POST", publishBody()), params());
  audits.length = 0;
  assert.equal((await route.POST(req("POST", { action: "revoke" }), params())).status, 200);
  assert.equal(db.approvedAt, null);
  assert.equal((await route.POST(req("POST", { action: "revoke" }), params())).status, 200);
  assert.deepEqual(audits, [{ action: "TESTIMONIAL_REVOKED", reason: "manual", by: "Admin One" }]);
});

test("a draft cannot smuggle in an approval or per-language data; invalid bodies are rejected", async () => {
  assert.equal((await route.PUT(req("PUT", { ...draft(), approvedAt: "2026-01-01" }), params())).status, 400);
  assert.equal((await route.PUT(req("PUT", { ...draft(), locales: { en: { quote: "x", role: "y" } } }), params())).status, 400);
  assert.equal((await route.PUT(new Request("http://x", { method: "PUT", body: "{not json" }), params())).status, 400);
  assert.equal((await route.POST(req("POST", { action: "approve" }), params())).status, 400);
  assert.equal(db.approvedAt, null);
});

test("unknown project: 404; unchanged save writes nothing; a project without a French row is refused", async () => {
  assert.equal((await route.GET(req("GET"), params("nope"))).status, 404);
  assert.equal((await route.POST(req("POST", publishBody()), params("nope"))).status, 404);
  assert.equal((await route.PUT(req("PUT", draft()), params())).status, 200);
  assert.equal(audits.length, 0);
  db.hasCanonicalRow = false;
  assert.equal((await route.PUT(req("PUT", draft({ quote: "New." })), params())).status, 409);
});
