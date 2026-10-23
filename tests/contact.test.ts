/**
 * Contact form reliability: what the visitor is told for every combination of
 * CRM save + EmailJS result, and how /api/contact handles malformed bodies,
 * duplicates, concurrent resubmissions, storage failures and rate limits.
 * Data access, notifications and webhooks are mocked: no database, no email.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseApiResponse,
  resolveOutcome,
  shouldReportEmailFailure,
  shouldSendEmail,
  shouldTrackLead,
  type ApiResult,
  type EmailResult,
} from "../src/lib/contact-outcome";

// ─── Pure outcome logic ──────────────────────────────────────────

const stored: ApiResult = { kind: "stored", leadId: "lead1", duplicate: false };
const duplicate: ApiResult = { kind: "stored", leadId: "lead1", duplicate: true };
const notStored: ApiResult = { kind: "not_stored" };
const limited: ApiResult = { kind: "rate_limited" };
const rejected: ApiResult = { kind: "rejected" };

test("outcome matrix: CRM save × EmailJS", () => {
  const cases: [ApiResult, EmailResult, string][] = [
    [stored, "sent", "success"],
    [stored, "failed", "success"], // saved: confirm receipt (failure is logged server-side)
    [stored, "not_configured", "success"],
    [duplicate, "skipped", "success"],
    [notStored, "sent", "email_only"], // emailed but not confirmed in the CRM
    [notStored, "failed", "error"],
    [notStored, "not_configured", "error"],
    [limited, "skipped", "rate_limited"],
    [rejected, "skipped", "error"],
  ];
  for (const [api, email, want] of cases) assert.equal(resolveOutcome(api, email), want, `${api.kind}/${email}`);
});

test("email is sent for new or unsaved inquiries only", () => {
  assert.equal(shouldSendEmail(stored), true);
  assert.equal(shouldSendEmail(notStored), true); // email is then the only channel
  assert.equal(shouldSendEmail(duplicate), false); // already emailed the first time
  assert.equal(shouldSendEmail(limited), false);
  assert.equal(shouldSendEmail(rejected), false);
});

test("a saved inquiry whose email did not go out is reported to the server", () => {
  assert.equal(shouldReportEmailFailure(stored, "failed"), true);
  assert.equal(shouldReportEmailFailure(stored, "not_configured"), true);
  assert.equal(shouldReportEmailFailure(stored, "sent"), false);
  assert.equal(shouldReportEmailFailure(duplicate, "skipped"), false);
  assert.equal(shouldReportEmailFailure(notStored, "failed"), false);
});

test("a lead is counted once: not for duplicates or failures", () => {
  assert.equal(shouldTrackLead(stored, "success"), true);
  assert.equal(shouldTrackLead(notStored, "email_only"), true);
  assert.equal(shouldTrackLead(duplicate, "success"), false);
  assert.equal(shouldTrackLead(notStored, "error"), false);
  assert.equal(shouldTrackLead(limited, "rate_limited"), false);
});

test("parseApiResponse reads every server answer", async () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  assert.deepEqual(await parseApiResponse(json(201, { stored: true, leadId: "abc", duplicate: false })), { kind: "stored", leadId: "abc", duplicate: false });
  assert.deepEqual(await parseApiResponse(json(200, { stored: true, leadId: "abc", duplicate: true })), { kind: "stored", leadId: "abc", duplicate: true });
  assert.deepEqual(await parseApiResponse(json(503, { stored: false })), { kind: "not_stored" });
  assert.deepEqual(await parseApiResponse(json(500, {})), { kind: "not_stored" });
  assert.deepEqual(await parseApiResponse(json(429, {})), { kind: "rate_limited" });
  assert.deepEqual(await parseApiResponse(json(400, {})), { kind: "rejected" });
  assert.deepEqual(await parseApiResponse(null), { kind: "not_stored" }); // network error
  assert.deepEqual(await parseApiResponse(new Response("not json", { status: 201 })), { kind: "not_stored" });
  assert.deepEqual(await parseApiResponse(json(200, { success: true })), { kind: "not_stored" }); // no stored flag
});

// ─── /api/contact route ──────────────────────────────────────────

const db = {
  leads: [] as { id: string; email: string; subject: string; message: string; createdAt: number }[],
  createError: null as unknown,
  createDelayMs: 0,
  notified: [] as string[],
  lastCreate: null as Record<string, unknown> | null,
};
function reset() {
  db.leads = [];
  db.createError = null;
  db.createDelayMs = 0;
  db.notified = [];
  db.lastCreate = null;
}

mock.module("@/lib/dal", {
  namedExports: {
    getLeastLoadedUser: async () => ({ id: "u1", fullName: "Sales" }),
    findRecentDuplicateLead: async (email: string, message: string, subject: string, since: Date) =>
      db.leads.find((l) => l.email.toLowerCase() === email.toLowerCase() && l.message === message && l.subject === subject && l.createdAt >= since.getTime())?.id ?? null,
    createLead: async (data: { email: string; subject: string; message: string }) => {
      if (db.createDelayMs) await new Promise((r) => setTimeout(r, db.createDelayMs));
      if (db.createError) throw db.createError;
      db.lastCreate = data;
      const lead = { id: `lead${db.leads.length + 1}xxxxxxxxxxxxxxxxxxxx`, email: data.email, subject: data.subject, message: data.message, createdAt: Date.now() };
      db.leads.push(lead);
      return lead;
    },
  },
});
mock.module("@/lib/notify", { namedExports: { notifyNewLead: async (l: { id: string }) => { db.notified.push(l.id); return 1; } } });
mock.module("@/lib/webhooks", { namedExports: { dispatchWebhook: () => {} } });

const prismaFake = { leadCreatedAt: new Date() as Date | null };
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => true,
    prisma: { lead: { findUnique: async () => (prismaFake.leadCreatedAt ? { createdAt: prismaFake.leadCreatedAt } : null) } },
  },
});

const routes = Promise.all([import("../src/app/api/contact/route"), import("../src/app/api/contact/notification-status/route")]);
let ipCounter = 0;
const post = async (body: unknown, ip = `10.0.0.${++ipCounter}`) =>
  (await routes)[0].POST(new Request("http://x/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
const valid = (over: Record<string, unknown> = {}) => ({
  fullName: "Test Visitor", email: "visitor@example.com", subject: "Sites Web", message: "Bonjour, je voudrais un site pour mon restaurant.", ...over,
});

test("malformed JSON is 400, not an unhandled 500", async () => {
  reset();
  const res = await post("{not json");
  assert.equal(res.status, 400);
  assert.equal(db.leads.length, 0);
});

test("invalid input is 400 and nothing is saved", async () => {
  reset();
  assert.equal((await post(valid({ email: "nope" }))).status, 400);
  assert.equal((await post(valid({ message: "short" }))).status, 400);
  assert.equal(db.leads.length, 0);
});

test("honeypot: silent success, nothing saved or notified", async () => {
  reset();
  const res = await post(valid({ website: "http://spam.example" }));
  assert.equal(res.status, 200);
  assert.equal(db.leads.length, 0);
  assert.equal(db.notified.length, 0);
});

test("new inquiry: 201 stored, one admin notification, fields trimmed", async () => {
  reset();
  const res = await post(valid({ fullName: "  Test Visitor  ", message: "  Bonjour, je voudrais un site pour mon restaurant.  " }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.stored, true);
  assert.equal(body.duplicate, false);
  assert.equal(typeof body.leadId, "string");
  assert.equal(db.leads.length, 1);
  assert.deepEqual(db.notified, [body.leadId]);
  assert.equal(db.lastCreate?.fullName, "Test Visitor");
  assert.equal(db.lastCreate?.message, "Bonjour, je voudrais un site pour mon restaurant.");
});

test("same email + message + service within 10 minutes: duplicate, no new lead, no second notification", async () => {
  reset();
  const first = await (await post(valid())).json();
  const again = await post(valid({ email: "VISITOR@example.com" }));
  assert.equal(again.status, 200);
  const body = await again.json();
  assert.equal(body.duplicate, true);
  assert.equal(typeof first.leadId, "string");
  assert.equal(body.leadId, null, "a resubmission never learns the existing lead id");
  assert.equal(db.leads.length, 1);
  assert.equal(db.notified.length, 1);
});

test("same email + message for a different service is a separate lead", async () => {
  reset();
  await post(valid({ subject: "Sites Web" }));
  const res = await post(valid({ subject: "Montage Reels" }));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).duplicate, false);
  assert.equal(db.leads.length, 2);
  assert.equal(db.notified.length, 2);
  assert.deepEqual(db.leads.map((l) => l.subject), ["Sites Web", "Montage Reels"]);
});

test("same message sent at the same moment for two services: two leads", async () => {
  reset();
  db.createDelayMs = 30;
  const [a, b] = await Promise.all([post(valid({ subject: "Sites Web" })), post(valid({ subject: "Design graphique" }))]);
  assert.deepEqual([a.status, b.status], [201, 201]);
  assert.equal(db.leads.length, 2);
});

test("service is compared after trimming: the same chip resent is still a duplicate", async () => {
  reset();
  await post(valid({ subject: "Montage Reels" }));
  const res = await post(valid({ subject: "  Montage Reels " }));
  assert.equal(res.status, 200);
  assert.equal(db.leads.length, 1);
});

test("a different message from the same person is a new lead", async () => {
  reset();
  await post(valid());
  const res = await post(valid({ message: "Et aussi un devis pour des Reels Instagram, merci." }));
  assert.equal(res.status, 201);
  assert.equal(db.leads.length, 2);
});

test("the same message after the 10-minute window is a new lead", async () => {
  reset();
  await post(valid());
  db.leads[0].createdAt -= 11 * 60 * 1000;
  assert.equal((await post(valid())).status, 201);
  assert.equal(db.leads.length, 2);
});

test("two identical submissions at the same moment create one lead", async () => {
  reset();
  db.createDelayMs = 50;
  const [a, b] = await Promise.all([post(valid()), post(valid())]);
  const bodies = await Promise.all([a.json(), b.json()]);
  assert.equal(db.leads.length, 1);
  assert.equal(db.notified.length, 1);
  assert.deepEqual(bodies.map((x) => x.duplicate).sort(), [false, true]);
  assert.deepEqual(bodies.map((x) => typeof x.leadId).sort(), ["object", "string"], "only the creating request gets the id");
});

test("storage failure: 503 stored:false (never a false success)", async () => {
  reset();
  db.createError = new Error("connect ECONNREFUSED postgres://user:secret@host/db");
  const res = await post(valid());
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.stored, false);
  assert.doesNotMatch(JSON.stringify(body), /secret|postgres/);
});

test("concurrent identical submissions share a storage failure", async () => {
  reset();
  db.createDelayMs = 30;
  db.createError = new Error("db down");
  const [a, b] = await Promise.all([post(valid()), post(valid())]);
  assert.deepEqual([a.status, b.status], [503, 503]);
});

test("rate limiting is preserved: 4th submission in a minute from one IP is 429", async () => {
  reset();
  const ip = "192.0.2.77";
  for (let i = 0; i < 3; i++) await post(valid({ message: `Message numéro ${i} pour tester la limite.` }), ip);
  const res = await post(valid({ message: "Message numéro 4 pour tester la limite." }), ip);
  assert.equal(res.status, 429);
});

// ─── /api/contact/notification-status ────────────────────────────

const status = async (body: unknown, ip = `10.1.0.${++ipCounter}`) =>
  (await routes)[1].POST(new Request("http://x/api/contact/notification-status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

test("notification-status logs a failed email for a recent lead", async () => {
  prismaFake.leadCreatedAt = new Date();
  const logged: string[] = [];
  const orig = console.error;
  console.error = (m: string) => logged.push(String(m));
  try {
    const res = await status({ leadId: "cmlead0000000000000000001", status: "failed" });
    assert.equal(res.status, 204);
  } finally {
    console.error = orig;
  }
  assert.ok(logged.some((l) => l.includes("contact_email_notification_failed") && l.includes("cmlead0000000000000000001")));
});

test("notification-status: a replayed report is accepted but logged once; it cannot touch notifications", async () => {
  prismaFake.leadCreatedAt = new Date();
  const logged: string[] = [];
  const orig = console.error;
  console.error = (m: string) => logged.push(String(m));
  try {
    for (let i = 0; i < 3; i++) assert.equal((await status({ leadId: "cmlead0000000000000000009", status: "failed" })).status, 204);
  } finally {
    console.error = orig;
  }
  assert.equal(logged.filter((l) => l.includes("cmlead0000000000000000009")).length, 1);
  assert.equal(db.notified.includes("cmlead0000000000000000009"), false);
  const src = fs.readFileSync("src/app/api/contact/notification-status/route.ts", "utf8");
  assert.doesNotMatch(src, /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/, "read-only on the database");
});

test("notification-status: 5 reports per minute per IP", async () => {
  prismaFake.leadCreatedAt = new Date();
  const ip = "198.51.100.9";
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) codes.push((await status({ leadId: `cmlead00000000000000001${i}`, status: "failed" }, ip)).status);
  assert.deepEqual(codes, [204, 204, 204, 204, 204, 429]);
});

test("notification-status rejects bad input and unknown or old leads", async () => {
  assert.equal((await status("{bad")).status, 400);
  assert.equal((await status({ leadId: "../etc", status: "failed" })).status, 400);
  assert.equal((await status({ leadId: "cmlead0000000000000000001", status: "boom" })).status, 400);
  prismaFake.leadCreatedAt = null;
  assert.equal((await status({ leadId: "cmlead0000000000000000002", status: "failed" })).status, 404);
  prismaFake.leadCreatedAt = new Date(Date.now() - 60 * 60 * 1000);
  assert.equal((await status({ leadId: "cmlead0000000000000000003", status: "failed" })).status, 404);
});

test("the database duplicate query matches email (case-insensitive), message and service", () => {
  const dal = fs.readFileSync("src/lib/dal.ts", "utf8");
  const fn = dal.slice(dal.indexOf("export async function findRecentDuplicateLead"));
  assert.match(fn.slice(0, 600), /where: \{ email: \{ equals: email, mode: "insensitive" \}, message, subject, createdAt: \{ gte: since \} \}/);
});
