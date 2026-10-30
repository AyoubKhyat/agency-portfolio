/**
 * Split storefront: the public form forwards its lead to the admin app (shared key, server to
 * server), and the admin's internal route creates, de-duplicates, assigns and announces it.
 * Data access, notifications and webhooks are mocked. Needs --experimental-test-module-mocks.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const KEY = "k".repeat(40);
const db = { leads: [] as { id: string; email: string; subject: string; message: string }[], notified: [] as string[], assigned: [] as (string | undefined)[] };

mock.module("@/lib/dal", {
  namedExports: {
    getLeastLoadedUser: async () => ({ id: "u1", fullName: "Sales" }),
    findRecentDuplicateLead: async (email: string, message: string, subject: string) =>
      db.leads.find((l) => l.email.toLowerCase() === email.toLowerCase() && l.message === message && l.subject === subject)?.id ?? null,
    createLead: async (d: { email: string; subject: string; message: string; assignedToId?: string }) => {
      db.assigned.push(d.assignedToId);
      const lead = { id: `lead${db.leads.length + 1}xxxxxxxxxxxxxxxxxxxx`, email: d.email, subject: d.subject, message: d.message };
      db.leads.push(lead);
      return lead;
    },
  },
});
mock.module("@/lib/notify", { namedExports: { notifyNewLead: async (l: { id: string }) => { db.notified.push(l.id); return 1; } } });
mock.module("@/lib/webhooks", { namedExports: { dispatchWebhook: () => {} } });

const internal = import("../src/app/api/internal/leads/route");
const contact = import("../src/app/api/contact/route");

const payload = { fullName: "Test Visitor", email: "visitor@example.com", subject: "Sites Web", message: "Bonjour, je voudrais un site pour mon restaurant." };
const call = async (headers: Record<string, string>, body: unknown = payload) =>
  (await internal).POST(new Request("http://admin/api/internal/leads", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
const reset = () => { db.leads = []; db.notified = []; db.assigned = []; delete process.env.INTERNAL_API_KEY; delete process.env.ADMIN_API_URL; };

test("internal route is disabled (404) without INTERNAL_API_KEY", async () => {
  reset();
  assert.equal((await call({ authorization: `Bearer ${KEY}` })).status, 404);
  assert.equal(db.leads.length, 0);
});

test("internal route rejects a missing, wrong or too short key with 401", async () => {
  reset();
  process.env.INTERNAL_API_KEY = KEY;
  assert.equal((await call({})).status, 401);
  assert.equal((await call({ authorization: "Bearer nope" })).status, 401);
  assert.equal((await call({ authorization: `Bearer ${KEY}x` })).status, 401);
  process.env.INTERNAL_API_KEY = "short";
  assert.equal((await call({ authorization: "Bearer short" })).status, 401);
  assert.equal(db.leads.length, 0);
});

test("internal route: valid key creates the lead, assigns it and notifies; a repeat is a duplicate", async () => {
  reset();
  process.env.INTERNAL_API_KEY = KEY;
  const res = await call({ authorization: `Bearer ${KEY}` });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.duplicate, false);
  assert.equal(db.leads.length, 1);
  assert.deepEqual(db.assigned, ["u1"]);
  assert.deepEqual(db.notified, [body.leadId]);

  const again = await call({ authorization: `Bearer ${KEY}` });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
  assert.equal(db.leads.length, 1);
  assert.equal(db.notified.length, 1);
});

test("internal route validates the payload", async () => {
  reset();
  process.env.INTERNAL_API_KEY = KEY;
  assert.equal((await call({ authorization: `Bearer ${KEY}` }, { ...payload, email: "nope" })).status, 400);
  assert.equal(db.leads.length, 0);
});

test("with ADMIN_API_URL the public form forwards to the admin and saves nothing locally", async () => {
  reset();
  process.env.ADMIN_API_URL = "https://admin.example.test";
  process.env.INTERNAL_API_KEY = KEY;
  const seen: { url: string; auth: string | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
    seen.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify({ leadId: "remote1", duplicate: false }), { status: 201 });
  }) as typeof fetch;
  try {
    const res = await (await contact).POST(new Request("http://site/api/contact", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.0.1" }, body: JSON.stringify(payload) }));
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { success: true, stored: true, duplicate: false, leadId: "remote1" });
    assert.deepEqual(seen, [{ url: "https://admin.example.test/api/internal/leads", auth: `Bearer ${KEY}` }]);
    assert.equal(db.leads.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("if the admin is unreachable the form reports 'not stored' (503), never a false success", async () => {
  reset();
  process.env.ADMIN_API_URL = "https://admin.example.test";
  process.env.INTERNAL_API_KEY = KEY;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
  try {
    const res = await (await contact).POST(new Request("http://site/api/contact", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.0.2" }, body: JSON.stringify(payload) }));
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { success: false, stored: false });
  } finally {
    globalThis.fetch = realFetch;
  }
});
