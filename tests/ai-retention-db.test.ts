/**
 * P5A retention and erasure against a REAL, ISOLATED Postgres: 90-day and 12-month boundaries, dry runs,
 * idempotency, status safety, spend caps, owner checks and audit entries.
 *
 * Skipped unless RETENTION_TEST_DATABASE_URL points at a local database (127.0.0.1 / localhost) that is not
 * the DATABASE_URL of this process or of .env; it refuses anything else, so it can never run against
 * production. It must also differ from DIAGNOSIS_TEST_DATABASE_URL: test files run in parallel and both
 * empty ai_runs, so sharing one database makes them fail each other. Every test empties ai_runs, leads, lead_notes, audit_logs and users (only there).
 * Schema: `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, applied to that database.
 */
import { test, mock, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const URL_ = process.env.RETENTION_TEST_DATABASE_URL ?? "";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
const envFileHost = (() => {
  try {
    return hostOf(/^DATABASE_URL=["']?([^"'\r\n]+)/m.exec(readFileSync(new URL("../.env", import.meta.url), "utf8"))?.[1] ?? "");
  } catch {
    return "";
  }
})();
const host = hostOf(URL_);
const isolated = URL_ !== "" && ["127.0.0.1", "localhost"].includes(host) && URL_ !== process.env.DATABASE_URL && host !== envFileHost
  && URL_ !== process.env.DIAGNOSIS_TEST_DATABASE_URL;
const skip = isolated ? false : "set RETENTION_TEST_DATABASE_URL to its own isolated local database to run";

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any;
let retention: typeof import("../src/lib/ai-workforce/retention");
let controls: typeof import("../src/lib/ai-workforce/controls");
let diagnosis: typeof import("../src/lib/ai-workforce/inbound-diagnosis");

const NOW = new Date("2026-11-09T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const OWNER_ID = "owner-1";
const owner = { userId: OWNER_ID, fullName: "Owner One" };
const actor = { userId: "u-team", fullName: "Team One" };

before(async () => {
  if (!isolated) return;
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_, max: 6 }) });
  mock.module("@/lib/prisma", { namedExports: { prisma: client, hasPrisma: () => true } });
  mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async () => {} } });
  retention = await import("../src/lib/ai-workforce/retention");
  controls = await import("../src/lib/ai-workforce/controls");
  diagnosis = await import("../src/lib/ai-workforce/inbound-diagnosis");
});

after(async () => {
  if (client) await client.$disconnect();
});

beforeEach(async () => {
  if (!isolated) return;
  await client.$executeRawUnsafe(`TRUNCATE ai_runs, lead_notes, leads, audit_logs, users RESTART IDENTITY CASCADE`);
});

const PERSONAL = {
  targetUrl: "https://riad-example.ma", finalUrl: "https://riad-example.ma/fr",
  evidence: [{ id: "e1", check: "title", status: "fail", observed: "Riad Example", sourceUrl: "https://riad-example.ma" }],
  findings: [{ title: "t", explanation: "x", recommendation: "r", evidenceIds: ["e1"] }],
  gapScore: 40, fitLabel: "WARM", duplicateStatus: "EXISTS", duplicateReason: "same domain as Riad Example", duplicateProspectId: "p-1",
  draftSubject: "Votre site", draftBody: "Bonjour Samira,\n\nVotre site...", errorDetail: "riad-example.ma timed out",
};
const WORDING = { approvedSubject: "Votre site", approvedBody: "Bonjour Samira,\n\nVotre site..." };

async function lead(id = "lead-1") {
  return client.lead.create({ data: { id, fullName: "Samira Example", email: "samira@example.ma", phone: "+212600000000", subject: "Diagnostic gratuit", message: "Site : https://riad-example.ma" } });
}
async function run(data: Record<string, unknown>) {
  return client.aiRun.create({
    data: {
      status: "DRAFT_READY", startedById: actor.userId, startedByName: actor.fullName, model: "openai/gpt-oss-120b",
      promptVersion: "inbound-diagnosis-v2", inputTokens: 1000, outputTokens: 100, costMicros: 210, draftLanguage: "fr",
      ...PERSONAL, ...data,
    },
  });
}
const get = (id: string) => client.aiRun.findUniqueOrThrow({ where: { id } });
const pick = (row: Record<string, unknown>, fields: readonly string[]) => Object.fromEntries(fields.map((f) => [f, row[f]]));
const kept = (row: Record<string, unknown>) => pick(row, retention.RETAINED_FIELDS.filter((f) => f !== "status" && f !== "updatedAt" && f !== "leadId"));

function assertContentCleared(row: any) {
  assert.equal(row.targetUrl, "");
  for (const f of ["finalUrl", "findings", "gapScore", "fitLabel", "duplicateStatus", "duplicateReason", "duplicateProspectId", "draftSubject", "draftBody", "errorDetail"]) {
    assert.equal(row[f], null, `${f} should be cleared`);
  }
  assert.deepEqual(row.evidence, []);
}

/* ───────── 90 days and 12 months ───────── */

test("content is cleared strictly after 90 days, and actionable runs expire", { skip }, async () => {
  await lead();
  const cutoff = 90 * DAY;
  const due = await run({ leadId: "lead-1", status: "DRAFT_READY", createdAt: ago(cutoff + 1) });
  const approved = await run({ leadId: "lead-1", status: "APPROVED", ...WORDING, channel: "EMAIL", approvedAt: ago(cutoff), createdAt: ago(cutoff + DAY) });
  const failed = await run({ leadId: "lead-1", status: "FAILED", errorCode: "AI_ERROR", createdAt: ago(cutoff + DAY) });
  const discarded = await run({ leadId: "lead-1", status: "DISCARDED", ...WORDING, createdAt: ago(cutoff + DAY) });
  const atCutoff = await run({ leadId: "lead-1", status: "AUDIT_ONLY", createdAt: ago(cutoff) });
  const recent = await run({ leadId: "lead-1", status: "DRAFT_READY", createdAt: ago(DAY) });
  const before = await Promise.all([due, approved, failed, discarded].map((r) => get(r.id)));

  const res = await retention.applyRetention(client, { now: NOW, apply: true });
  assert.deepEqual(res.counts, { expired: 2, contentCleared: 4, unsentWordingCleared: 2, sentWordingCleared: 0 });

  const after = await Promise.all([due, approved, failed, discarded].map((r) => get(r.id)));
  for (const [i, row] of after.entries()) {
    assertContentCleared(row);
    assert.equal(row.approvedSubject, null);
    assert.equal(row.approvedBody, null);
    assert.equal(row.leadId, "lead-1", "the 90-day pass keeps the lead link");
    assert.deepEqual(kept(row), kept(before[i]), "usage metadata must not change");
  }
  assert.deepEqual(after.map((r) => r.status), ["EXPIRED", "EXPIRED", "FAILED", "DISCARDED"]);
  assert.equal(after[1].approvedAt?.getTime(), before[1].approvedAt?.getTime(), "the approval time is kept");

  for (const r of [atCutoff, recent]) {
    const row = await get(r.id);
    assert.equal(row.targetUrl, PERSONAL.targetUrl, "not yet due");
    assert.equal(row.draftBody, PERSONAL.draftBody);
  }
  assert.equal((await get(atCutoff.id)).status, "AUDIT_ONLY");
});

test("SENT wording is kept until 12 months, then cleared; its content goes at 90 days", { skip }, async () => {
  const twelve = NOW.getTime() - retention.monthsBefore(NOW, 12).getTime();
  const sent100d = await run({ status: "SENT", ...WORDING, channel: "EMAIL", createdAt: ago(100 * DAY) });
  const sentAt12 = await run({ status: "SENT", ...WORDING, channel: "EMAIL", createdAt: ago(twelve) });
  const sentPast12 = await run({ status: "SENT", ...WORDING, channel: "WHATSAPP", createdAt: ago(twelve + 1) });

  await retention.applyRetention(client, { now: NOW, apply: true });

  for (const r of [sent100d, sentAt12]) {
    const row = await get(r.id);
    assertContentCleared(row);
    assert.equal(row.status, "SENT");
    assert.equal(row.approvedBody, WORDING.approvedBody, "SENT wording is kept up to 12 months");
  }
  const old = await get(sentPast12.id);
  assertContentCleared(old);
  assert.equal(old.status, "SENT");
  assert.equal(old.approvedSubject, null);
  assert.equal(old.approvedBody, null);
  assert.equal(old.channel, "WHATSAPP");
});

test("a dry run counts without writing, and a second pass changes nothing", { skip }, async () => {
  await run({ status: "DRAFT_READY", createdAt: ago(91 * DAY) });
  await run({ status: "SENT", ...WORDING, createdAt: ago(400 * DAY) });
  await run({ status: "DENIED", errorCode: "DAILY_CAP", createdAt: ago(200 * DAY) });
  const snapshot = async () => JSON.stringify(await client.aiRun.findMany({ orderBy: { id: "asc" } }));
  const start = await snapshot();

  const dry = await retention.applyRetention(client, { now: NOW });
  assert.equal(dry.applied, false);
  assert.deepEqual(dry.counts, { expired: 1, contentCleared: 3, unsentWordingCleared: 0, sentWordingCleared: 1 });
  assert.equal(await snapshot(), start, "a dry run writes nothing");

  const first = await retention.applyRetention(client, { now: NOW, apply: true });
  assert.deepEqual(first.counts, dry.counts, "the dry run predicts the real one");
  const cleared = await snapshot();
  const second = await retention.applyRetention(client, { now: NOW, apply: true });
  assert.deepEqual(second.counts, { expired: 0, contentCleared: 0, unsentWordingCleared: 0, sentWordingCleared: 0 });
  assert.equal(await snapshot(), cleared, "the second pass leaves rows untouched");
  assert.equal((await client.aiRun.findFirst({ where: { status: "DENIED" } })).status, "DENIED", "DENIED stays out of the caps");
});

test("an expired run refuses every action", { skip }, async () => {
  await lead();
  const r = await run({ leadId: "lead-1", status: "APPROVED", ...WORDING, channel: "EMAIL", approvedAt: ago(91 * DAY), createdAt: ago(91 * DAY) });
  await retention.applyRetention(client, { now: NOW, apply: true });
  const body = "Bonjour Samira,\n\nVotre site a un titre manquant. Nous pouvons regarder de plus près si vous le souhaitez.";
  for (const action of [
    { action: "save", subject: "s", body },
    { action: "approve", subject: "s", body, channel: "EMAIL" },
    { action: "discard" },
    { action: "confirm_sent", approvedAt: ago(91 * DAY).toISOString() },
  ]) {
    const res = await diagnosis.applyRunAction("lead-1", r.id, action as any, actor);
    assert.deepEqual(res, { ok: false, code: "wrong_state" }, `${action.action} must be refused`);
  }
  const row = await get(r.id);
  assert.equal(row.status, "EXPIRED");
  assert.equal(row.approvedBody, null);
  assert.equal(await client.leadNote.count(), 0, "nothing was recorded as sent");
});

test("the retention pass doesn't change spend or the daily count", { skip }, async () => {
  await run({ status: "DRAFT_READY", costMicros: 500, createdAt: ago(2 * 60 * 60 * 1000) });
  await run({ status: "SENT", ...WORDING, costMicros: 300, createdAt: ago(5 * DAY) });
  await run({ status: "DRAFT_READY", costMicros: 900, createdAt: ago(120 * DAY) });
  const before = await controls.usageNow(NOW);
  await retention.applyRetention(client, { now: NOW, apply: true });
  assert.deepEqual(await controls.usageNow(NOW), before);
  const total = await client.aiRun.aggregate({ _sum: { costMicros: true, inputTokens: true, outputTokens: true } });
  assert.deepEqual(total._sum, { costMicros: 1700, inputTokens: 3000, outputTokens: 300 });
});

/* ───────── Erasure ───────── */

test("erasing a lead clears and unlinks its runs, deletes it and its notes, and keeps spend counted", { skip }, async () => {
  await lead();
  await lead("lead-other");
  await client.leadNote.create({ data: { leadId: "lead-1", content: "Diagnosis reply sent by Team One via email:\n\nBonjour Samira" } });
  await client.auditLog.create({ data: { userId: actor.userId, userName: actor.fullName, action: "AI_DIAGNOSIS_RUN", entity: "lead", entityId: "lead-1", details: JSON.stringify({ runId: "r", status: "DRAFT_READY" }) } });
  const draft = await run({ leadId: "lead-1", status: "DRAFT_READY", costMicros: 222, createdAt: ago(60 * 60 * 1000) });
  const sent = await run({ leadId: "lead-1", status: "SENT", ...WORDING, channel: "EMAIL", sentConfirmedById: actor.userId, sentConfirmedByName: actor.fullName, createdAt: ago(3 * DAY) });
  const denied = await run({ leadId: "lead-1", status: "DENIED", errorCode: "LEAD_RECENT_RUN", costMicros: 0, createdAt: ago(30 * 60 * 1000) });
  const other = await run({ leadId: "lead-other", status: "DRAFT_READY", createdAt: ago(DAY) });
  const before = await Promise.all([draft, sent, denied].map((r) => get(r.id)));
  const usage = await controls.usageNow(NOW);

  const plan = await retention.planLeadErasure(client, "lead-1", NOW);
  assert.deepEqual(plan, { found: true, runs: 3, notes: 1, runsInFlight: 0 });
  const res = await retention.eraseLead(client, "lead-1", owner, NOW);
  assert.deepEqual(res, { ok: true, runsCleared: 3, notesDeleted: 1 });

  assert.equal(await client.lead.findUnique({ where: { id: "lead-1" } }), null);
  assert.equal(await client.leadNote.count({ where: { leadId: "lead-1" } }), 0);
  const after = await Promise.all([draft, sent, denied].map((r) => get(r.id)));
  for (const [i, row] of after.entries()) {
    assertContentCleared(row);
    assert.equal(row.approvedSubject, null);
    assert.equal(row.approvedBody, null, "erasure also clears SENT wording");
    assert.equal(row.leadId, null);
    assert.deepEqual(kept(row), kept(before[i]));
  }
  assert.deepEqual(after.map((r) => r.status), ["EXPIRED", "SENT", "DENIED"]);
  assert.deepEqual(await controls.usageNow(NOW), usage, "erasure must not hand back budget or daily slots");

  const otherRow = await get(other.id);
  assert.equal(otherRow.targetUrl, PERSONAL.targetUrl, "another lead's runs are untouched");
  assert.equal(otherRow.leadId, "lead-other");

  const audits = await client.auditLog.findMany({ orderBy: { createdAt: "asc" } });
  assert.equal(audits.length, 2, "the earlier audit entry is kept");
  const erase = audits.find((a: any) => a.action === "ERASE_LEAD");
  assert.equal(erase.userId, OWNER_ID);
  assert.equal(erase.entityId, "lead-1");
  assert.deepEqual(JSON.parse(erase.details), { aiRunsCleared: 3, notesDeleted: 1 });
  for (const leak of ["Samira", "samira@example.ma", "riad-example", "+212600000000"]) {
    assert.ok(!JSON.stringify(audits).includes(leak), `audit must not hold ${leak}`);
  }
});

test("erasure waits for a run still in progress, but not for a dead one", { skip }, async () => {
  await lead();
  const live = await run({ leadId: "lead-1", status: "RUNNING", reservedMicros: 3_600, createdAt: ago(60 * 1000) });
  assert.deepEqual(await retention.eraseLead(client, "lead-1", owner, NOW), { ok: false, code: "run_in_progress" });
  assert.ok(await client.lead.findUnique({ where: { id: "lead-1" } }), "nothing was erased");
  assert.equal((await get(live.id)).targetUrl, PERSONAL.targetUrl);

  await client.aiRun.update({ where: { id: live.id }, data: { createdAt: ago(6 * 60 * 1000) } });
  const res = await retention.eraseLead(client, "lead-1", owner, NOW);
  assert.equal(res.ok, true);
  const row = await get(live.id);
  assert.equal(row.reservedMicros, 3_600, "a dead run's reservation stays counted");
  assert.equal(row.leadId, null);
});

test("erasing twice is safe, and an unknown lead changes nothing", { skip }, async () => {
  await lead();
  await run({ leadId: "lead-1", createdAt: ago(DAY) });
  assert.equal((await retention.eraseLead(client, "lead-1", owner, NOW)).ok, true);
  assert.deepEqual(await retention.eraseLead(client, "lead-1", owner, NOW), { ok: false, code: "not_found" });
  assert.deepEqual(await retention.planLeadErasure(client, "lead-1", NOW), { found: false, runs: 0, notes: 0, runsInFlight: 0 });
  assert.equal(await client.auditLog.count({ where: { action: "ERASE_LEAD" } }), 1);
});

test("only the active owner, by OWNER_USER_ID and matching email, may erase", { skip }, async () => {
  await client.user.create({ data: { id: OWNER_ID, fullName: "Owner One", email: "owner@ibda3.test", passwordHash: "x", avatarInitials: "OO", role: "admin" } });
  await client.user.create({ data: { id: "admin-2", fullName: "Admin Two", email: "admin@ibda3.test", passwordHash: "x", avatarInitials: "AT", role: "admin" } });

  assert.deepEqual(await retention.verifyOwner(client, "owner@ibda3.test", OWNER_ID), { ok: true, owner: { userId: OWNER_ID, fullName: "Owner One" } });
  assert.equal((await retention.verifyOwner(client, "admin@ibda3.test", OWNER_ID)).ok, false, "an admin is not the owner");
  assert.equal((await retention.verifyOwner(client, "admin@ibda3.test", "admin-2")).ok, true, "the check follows OWNER_USER_ID");
  assert.equal((await retention.verifyOwner(client, "owner@ibda3.test", undefined)).ok, false);
  assert.equal((await retention.verifyOwner(client, "owner@ibda3.test", "  ")).ok, false);
  assert.equal((await retention.verifyOwner(client, "", OWNER_ID)).ok, false);
  assert.equal((await retention.verifyOwner(client, "OWNER@ibda3.test", OWNER_ID)).ok, false, "same exact-match rule as isOwner");

  await client.user.update({ where: { id: OWNER_ID }, data: { isActive: false } });
  assert.equal((await retention.verifyOwner(client, "owner@ibda3.test", OWNER_ID)).ok, false, "an inactive owner can't erase");
});
