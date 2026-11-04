/**
 * Inbound Diagnosis end to end against a REAL, ISOLATED Postgres, a local test website and a fake AI:
 * the kill switch, the database-backed budgets under real concurrency, run logging, and the approval
 * gate through the real API routes.
 *
 * Skipped unless DIAGNOSIS_TEST_DATABASE_URL points at a local database (127.0.0.1 / localhost) that is
 * not the DATABASE_URL of this process or of .env; it refuses anything else, so it can never run against
 * production. Every test empties leads and ai_runs (only there). No test makes a paid AI call: `generate`
 * is always injected, and the routes that don't inject it run with no API key.
 * Schema = base schema + prisma/sql/20261105_add_ai_workforce.sql. Example:
 *   docker run -d --name ibda3-diagnosis-testdb -e POSTGRES_USER=test -e POSTGRES_PASSWORD=testonly \n *     -e POSTGRES_DB=ibda3_diagnosis_test -p 127.0.0.1:55441:5432 --tmpfs /var/lib/postgresql/data postgres:16-alpine
 *   DIAGNOSIS_TEST_DATABASE_URL=postgresql://test:testonly@127.0.0.1:55441/ibda3_diagnosis_test npm test
 */
import { test, mock, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import Anthropic from "@anthropic-ai/sdk"; // a static import, so these are the same error classes the library sees

const URL_ = process.env.DIAGNOSIS_TEST_DATABASE_URL ?? "";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
const envFileHost = (() => {
  try {
    return hostOf(/^DATABASE_URL=["']?([^"'\r\n]+)/m.exec(readFileSync(new URL("../.env", import.meta.url), "utf8"))?.[1] ?? "");
  } catch {
    return "";
  }
})();
const host = hostOf(URL_);
const isolated = URL_ !== "" && ["127.0.0.1", "localhost"].includes(host) && URL_ !== process.env.DATABASE_URL && host !== envFileHost;
const skip = isolated ? false : "set DIAGNOSIS_TEST_DATABASE_URL to an isolated local database to run";

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any;
let mod: typeof import("../src/lib/ai-workforce/inbound-diagnosis");
let controls: typeof import("../src/lib/ai-workforce/controls");
let start: typeof import("../src/app/api/admin/leads/[id]/diagnosis/route");
let act: typeof import("../src/app/api/admin/leads/[id]/diagnosis/[runId]/route");
let aiControls: typeof import("../src/app/api/admin/ai-controls/route");
let fetcher: import("../src/lib/website-audit/safe-fetch").SafeFetch;
let strictFetcher: import("../src/lib/website-audit/safe-fetch").SafeFetch;
let server: http.Server;
let port = 0;
let siteHits = 0;
let robotsBody = "User-agent: *\nDisallow:";
const audits: string[] = [];
let session: { userId: string; email: string; fullName: string; role: string; avatarInitials: string } | null = null;
let ownerAllowed = true;
const actor = { userId: "u-team", fullName: "Team One" };

const GOOD_PAGE = `<!doctype html><html lang="fr"><head><title>Riad Atlas</title><meta name="viewport" content="width=device-width"></head><body><h1>Riad</h1><p>${"Texte du site. ".repeat(40)}</p></body></html>`;

before(async () => {
  if (!isolated) return;
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_, max: 12 }) });
  mock.module("@/lib/prisma", { namedExports: { prisma: client, hasPrisma: () => true } });
  mock.module("@/lib/auth", { namedExports: { getSession: async () => session } });
  mock.module("@/lib/account-security", { namedExports: { isOwner: async () => ownerAllowed } });
  mock.module("@/lib/audit", {
    namedExports: { getClientIp: () => "127.0.0.1", logAudit: async (a: { action: string }) => { audits.push(a.action); } },
  });

  server = http.createServer((req, res) => {
    siteHits++;
    if (req.url === "/robots.txt") { res.writeHead(200, { "content-type": "text/plain" }); return res.end(robotsBody); }
    if (req.url === "/sitemap.xml") { res.writeHead(404, { "content-type": "text/html" }); return res.end("no"); }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(GOOD_PAGE);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;

  const sf = await import("../src/lib/website-audit/safe-fetch");
  const resolve = async () => [{ address: "127.0.0.1", family: 4 }];
  fetcher = sf.createSafeFetcher({ allowedPorts: [80, 443, port], resolve, isAllowedHostname: () => true, isAllowedAddress: (a) => a === "127.0.0.1" });
  strictFetcher = sf.createSafeFetcher({ allowedPorts: [80, 443, port], resolve, isAllowedHostname: () => true });

  mod = await import("../src/lib/ai-workforce/inbound-diagnosis");
  controls = await import("../src/lib/ai-workforce/controls");
  start = await import("../src/app/api/admin/leads/[id]/diagnosis/route");
  act = await import("../src/app/api/admin/leads/[id]/diagnosis/[runId]/route");
  aiControls = await import("../src/app/api/admin/ai-controls/route");
});
after(async () => {
  server?.closeAllConnections();
  server?.close();
  await client?.$disconnect();
});

const on = { enabled: true, aiEnabled: true, dailyRunCap: 10, monthlyBudgetMicros: 5_000_000 };
beforeEach(async () => {
  if (!isolated) return;
  delete process.env.ANTHROPIC_API_KEY; // nothing here may ever reach the real API
  process.env.AI_WORKFORCE_ENABLED = "1";
  robotsBody = "User-agent: *\nDisallow:";
  await client.aiRun.deleteMany({});
  await client.lead.deleteMany({});
  await client.aiControl.deleteMany({});
  await client.aiControl.create({ data: { id: "singleton", ...on } });
  audits.length = 0;
  siteHits = 0;
  session = { userId: "u-team", email: "t@x.ma", fullName: "Team One", role: "sales", avatarInitials: "TO" };
  ownerAllowed = true;
});

const newLead = (over: Record<string, unknown> = {}, problem = "Le site est lent") =>
  client.lead.create({
    data: {
      fullName: "Sara Bennani", email: "sara@riad.ma", phone: "0612345678", subject: "Diagnostic gratuit",
      message: `Demande de diagnostic gratuit du site (vérification par l'équipe).\nSite : http://riad-atlas.ma:${port}/\nLangue : FR\nProblème décrit : ${problem}`,
      ...over,
    },
  });

/** Fake AI: cites real failed evidence and records what it was given. */
const aiCalls: { system: string; user: string }[] = [];
const fakeAi = async (args: { system: string; user: string }) => {
  aiCalls.push(args);
  return {
    raw: {
      findings: [{ title: "Pas de description", explanation: "Aucune description.", recommendation: "En ajouter une.", evidenceIds: ["E_DESCRIPTION"] }],
      draft: { subject: "Votre site riad-atlas.ma", body: "Bonjour Sara, sur riad-atlas.ma la page n'a pas de description." },
    },
    stopReason: "end_turn", model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 500,
  };
};
const run = (leadId: string, deps: Record<string, unknown> = {}) =>
  mod.runInboundDiagnosis(leadId, actor, { fetcher, generate: fakeAi, aiKeyPresent: true, ...deps });
const row = (id: string) => client.aiRun.findUnique({ where: { id } });
const finished = (r: Awaited<ReturnType<typeof run>>) => {
  assert.equal(r.kind, "finished", JSON.stringify(r));
  return r as Extract<typeof r, { kind: "finished" }>;
};

test("a full run: evidence from the local site, a validated draft, costs logged, nothing sent", { skip }, async () => {
  const lead = await newLead();
  aiCalls.length = 0;
  const r = finished(await run(lead.id));
  assert.equal(r.status, "DRAFT_READY");
  const saved = await row(r.runId);
  assert.ok(saved.evidence.length >= 10);
  assert.equal(saved.evidence.find((e: any) => e.id === "E_DESCRIPTION").status, "fail");
  assert.equal(saved.findings[0].evidenceIds[0], "E_DESCRIPTION");
  assert.match(saved.draftBody, /Bonjour Sara/);
  assert.match(saved.draftBody, /vérification automatique/, "the limits of the check are always stated");
  assert.match(saved.draftBody, /L'équipe Ibda3 Digital$/);
  assert.equal(saved.model, "claude-sonnet-5-5");
  assert.equal(saved.promptVersion, "inbound-diagnosis-v1");
  assert.equal(saved.inputTokens, 1000);
  assert.equal(saved.costMicros, 1000 * 2 + 500 * 10);
  assert.equal(saved.reservedMicros, 0);
  assert.ok(saved.durationMs >= 0);
  assert.equal(saved.startedById, "u-team");
  assert.equal(saved.approvedById, null);
  assert.equal(saved.sentConfirmedAt, null);
  assert.equal((await client.lead.findUnique({ where: { id: lead.id } })).status, "NEW", "starting a run changes nothing on the lead");
  assert.deepEqual(audits, ["AI_DIAGNOSIS_RUN"]);
  assert.equal(aiCalls.length, 1);
  assert.doesNotMatch(aiCalls[0].user, /sara@riad\.ma|Bennani|0612345678|<html/);
});

test("kill switch: env off, database off, or a missing row means no fetch and no AI, and leaves a log", { skip }, async () => {
  aiCalls.length = 0;
  const check = async (reason: string) => {
    const lead = await newLead();
    const r = await run(lead.id);
    assert.equal(r.kind, "denied");
    assert.equal((r as any).reason, reason);
    const saved = await row((r as any).runId);
    assert.equal(saved.status, "DENIED");
    assert.equal(saved.errorCode, reason);
    assert.equal(saved.reservedMicros, 0);
  };
  delete process.env.AI_WORKFORCE_ENABLED;
  await check("KILL_SWITCH_ENV");
  process.env.AI_WORKFORCE_ENABLED = "1";
  await client.aiControl.update({ where: { id: "singleton" }, data: { enabled: false } });
  await check("KILL_SWITCH");
  await client.aiControl.deleteMany({});
  await check("KILL_SWITCH");
  assert.equal(siteHits, 0, "no site was contacted");
  assert.equal(aiCalls.length, 0);
});

test("AI switch off, or no key: the audit runs, no paid call, nothing reserved", { skip }, async () => {
  aiCalls.length = 0;
  await client.aiControl.update({ where: { id: "singleton" }, data: { aiEnabled: false } });
  const off = finished(await run((await newLead()).id));
  assert.equal(off.status, "AUDIT_ONLY");
  assert.equal((await row(off.runId)).errorCode, "AI_DISABLED");
  assert.ok((await row(off.runId)).evidence.length > 0);

  await client.aiControl.update({ where: { id: "singleton" }, data: { aiEnabled: true } });
  const noKey = finished(await run((await newLead()).id, { aiKeyPresent: false }));
  assert.equal((await row(noKey.runId)).errorCode, "NO_API_KEY");
  assert.equal(aiCalls.length, 0);
});

test("the kill switch pulled during the site read stops the paid call", { skip }, async () => {
  aiCalls.length = 0;
  const lead = await newLead();
  const pulling: typeof fetcher = async (url, opts) => {
    await client.aiControl.update({ where: { id: "singleton" }, data: { aiEnabled: false } });
    return fetcher(url, opts);
  };
  const r = finished(await run(lead.id, { fetcher: pulling }));
  assert.equal(r.status, "AUDIT_ONLY");
  assert.equal((await row(r.runId)).errorCode, "KILL_SWITCH");
  assert.equal((await row(r.runId)).reservedMicros, 0, "the reservation goes back");
  assert.equal(aiCalls.length, 0);
});

test("10 runs in 24 hours, even under 25 simultaneous requests", { skip }, async () => {
  const leads = await Promise.all(Array.from({ length: 25 }, () => newLead()));
  const results = await Promise.all(leads.map((l) => controls.reserveRun({
    agent: "INBOUND_DIAGNOSIS", leadId: l.id, targetUrl: "https://riad.ma/", startedById: "u", startedByName: "U", aiKeyPresent: true,
  })));
  assert.equal(results.filter((r) => r.allowed).length, 10);
  assert.equal(results.filter((r) => !r.allowed && r.reason === "DAILY_CAP").length, 15);
  assert.equal(await client.aiRun.count({ where: { status: "RUNNING" } }), 10);
  assert.equal(await client.aiRun.count({ where: { status: "DENIED", errorCode: "DAILY_CAP" } }), 15, "refusals are logged too");
});

test("a run outside the 24-hour window stops counting; a refused one never counted", { skip }, async () => {
  const lead = await newLead();
  const old = new Date(Date.now() - controls.RUN_WINDOW_MS - 1000);
  for (let i = 0; i < 10; i++) {
    await client.aiRun.create({ data: { status: "AUDIT_ONLY", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U", createdAt: old } });
    await client.aiRun.create({ data: { status: "DENIED", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U" } });
  }
  assert.equal(finished(await run(lead.id)).status, "DRAFT_READY");
});

test("the owner's cap can't go above the ceiling, even if the row says so", { skip }, async () => {
  await client.aiControl.update({ where: { id: "singleton" }, data: { dailyRunCap: 999, monthlyBudgetMicros: 999_000_000 } });
  assert.equal((await controls.readControls()).dailyRunCap, 10);
  assert.equal((await controls.readControls()).monthlyBudgetMicros, 5_000_000);
  for (let i = 0; i < 10; i++) await client.aiRun.create({ data: { status: "FAILED", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U" } });
  const r = await run((await newLead()).id);
  assert.equal((r as any).reason, "DAILY_CAP");
});

test("one run per enquiry per 24 hours, whatever its outcome", { skip }, async () => {
  const lead = await newLead();
  finished(await run(lead.id, { generate: async () => { throw new Error("boom"); } }));
  const again = await run(lead.id);
  assert.equal(again.kind, "denied");
  assert.equal((again as any).reason, "LEAD_RECENT_RUN");
});

test("$5 a month: at the limit no paid call is made, and the audit still runs", { skip }, async () => {
  aiCalls.length = 0;
  const lastCent = 5_000_000 - controls.RESERVATION_MICROS + 1;
  await client.aiRun.create({ data: { status: "SENT", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U", costMicros: lastCent } });
  const stopped = finished(await run((await newLead()).id));
  assert.equal(stopped.status, "AUDIT_ONLY");
  assert.equal((await row(stopped.runId)).errorCode, "BUDGET_EXHAUSTED");
  assert.equal(aiCalls.length, 0);
});

test("simultaneous runs can't overspend the month, because each holds its maximum until settled", { skip }, async () => {
  const room = controls.RESERVATION_MICROS * 3;
  await client.aiRun.create({ data: { status: "SENT", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U", costMicros: 5_000_000 - room } });
  await client.aiControl.update({ where: { id: "singleton" }, data: { dailyRunCap: 10 } });
  const leads = await Promise.all(Array.from({ length: 8 }, () => newLead()));
  const results = await Promise.all(leads.map((l) => controls.reserveRun({
    agent: "INBOUND_DIAGNOSIS", leadId: l.id, targetUrl: "https://riad.ma/", startedById: "u", startedByName: "U", aiKeyPresent: true,
  })));
  const allowed = results.filter((r) => r.allowed) as Extract<(typeof results)[number], { allowed: true }>[];
  assert.equal(allowed.filter((r) => r.aiWithheld === null).length, 3);
  assert.equal(allowed.filter((r) => r.aiWithheld === "BUDGET_EXHAUSTED").length, allowed.length - 3);
  const month = await controls.usageNow();
  assert.ok(month.monthSpentMicros <= 5_000_000);
});

test("last month's spending doesn't count against this month", { skip }, async () => {
  const lastMonth = new Date(controls.monthStart(new Date()).getTime() - 1000);
  await client.aiRun.create({ data: { status: "SENT", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U", costMicros: 5_000_000, createdAt: lastMonth } });
  assert.equal(finished(await run((await newLead()).id)).status, "DRAFT_READY");
});

test("a dead function's reservation stays counted, and its run is marked stale", { skip }, async () => {
  const old = new Date(Date.now() - controls.STALE_RUN_MS - 1000);
  const dead = await client.aiRun.create({ data: { status: "RUNNING", targetUrl: "https://x.ma/", startedById: "u", startedByName: "U", reservedMicros: 56_000, createdAt: old } });
  await run((await newLead()).id);
  const after = await row(dead.id);
  assert.equal(after.status, "FAILED");
  assert.equal(after.errorCode, "STALE");
  assert.equal(after.reservedMicros, 56_000, "it may have been billed, so it stays against the budget");
  assert.ok((await controls.usageNow()).monthSpentMicros >= 56_000);
});

test("SSRF: a site resolving to a private address is BLOCKED, with no AI and no money held", { skip }, async () => {
  aiCalls.length = 0;
  const lead = await newLead();
  const r = finished(await run(lead.id, { fetcher: strictFetcher }));
  assert.equal(r.status, "BLOCKED");
  const saved = await row(r.runId);
  assert.equal(saved.errorCode, "BLOCKED_ADDRESS");
  assert.equal(saved.reservedMicros, 0);
  assert.deepEqual(saved.evidence, []);
  assert.equal(siteHits, 0);
  assert.equal(aiCalls.length, 0);
});

test("a leads address that fails the rules is refused before any run starts", { skip }, async () => {
  const lead = await newLead({ message: "x\nSite : http://169.254.169.254/\nLangue : FR\nProblème décrit : x" });
  assert.equal((await run(lead.id)).kind, "not_diagnosis");
  const other = await newLead({ subject: "Autre sujet" });
  assert.equal((await run(other.id)).kind, "not_diagnosis");
  assert.equal(await client.aiRun.count(), 0);
});

test("robots.txt disallow: the page isn't read and no AI runs", { skip }, async () => {
  robotsBody = "User-agent: *\nDisallow: /";
  aiCalls.length = 0;
  const r = finished(await run((await newLead()).id));
  assert.equal(r.status, "AUDIT_ONLY");
  assert.equal((await row(r.runId)).errorCode, "ROBOTS_DISALLOWED");
  assert.equal(siteHits, 1, "only robots.txt was read");
  assert.equal(aiCalls.length, 0);
});

test("a bad AI answer is thrown away, charged, and never becomes a draft", { skip }, async () => {
  const cases: [string, any][] = [
    ["AI_VALIDATION", { raw: { findings: [{ title: "T", explanation: "E", recommendation: "R", evidenceIds: ["E_INVENTED"] }], draft: { subject: "s", body: "b" } }, stopReason: "end_turn" }],
    ["AI_VALIDATION", { raw: null, stopReason: "end_turn" }],
    ["AI_REFUSED", { raw: null, stopReason: "refusal" }],
    ["AI_TRUNCATED", { raw: null, stopReason: "max_tokens" }],
  ];
  for (const [errorCode, answer] of cases) {
    const r = finished(await run((await newLead()).id, { generate: async () => ({ model: "claude-sonnet-5-5", inputTokens: 100, outputTokens: 50, ...answer }) }));
    const saved = await row(r.runId);
    assert.equal(saved.status, "FAILED");
    assert.equal(saved.errorCode, errorCode);
    assert.equal(saved.draftBody, null);
    assert.equal(saved.findings, null);
    assert.equal(saved.costMicros, 100 * 2 + 50 * 10);
    assert.equal(saved.reservedMicros, 0);
    assert.ok(saved.evidence.length > 0, "the evidence is still useful to a person");
  }
});

test("AI failures settle the budget correctly: an API error frees it, a lost connection keeps it", { skip }, async () => {
  const apiError = finished(await run((await newLead()).id, { generate: async () => { throw new Anthropic.InternalServerError(500, {}, "x", new Headers()); } }));
  assert.equal((await row(apiError.runId)).errorCode, "AI_ERROR");
  assert.equal((await row(apiError.runId)).costMicros, 0);

  const lost = finished(await run((await newLead()).id, { generate: async () => { throw new Anthropic.APIConnectionTimeoutError(); } }));
  assert.equal((await row(lost.runId)).errorCode, "AI_CONNECTION");
  assert.equal((await row(lost.runId)).costMicros, controls.RESERVATION_MICROS);
});

test("a duplicate of an existing prospect is flagged for the person", { skip }, async () => {
  const prospect = await client.prospect.create({ data: { name: "Riad Atlas", phone: "", whatsappLink: "", sector: "Riad", email: "sara@riad.ma" } });
  const r = finished(await run((await newLead()).id));
  assert.equal((await row(r.runId)).duplicateStatus, "EXISTS");
  await client.prospect.delete({ where: { id: prospect.id } });
});

/* ───────────────── The approval gate, through the real routes ───────────────── */

const req = (body: unknown) => new Request("http://x/api", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctxFor = (id: string, runId: string) => ({ params: Promise.resolve({ id, runId }) });
const patch = (leadId: string, runId: string, body: unknown) => act.PATCH(req(body), ctxFor(leadId, runId));
const text = { subject: "Votre site", body: "Bonjour Sara, voici notre retour sur votre site et ce que nous avons observé." };

test("no sign-in, no access: every route answers 401, and the owner route 403 to others", { skip }, async () => {
  const lead = await newLead();
  session = null;
  const params = Promise.resolve({ id: lead.id });
  assert.equal((await start.GET(new Request("http://x"), { params })).status, 401);
  assert.equal((await start.POST(new Request("http://x", { method: "POST" }), { params })).status, 401);
  assert.equal((await patch(lead.id, "r", { action: "discard" })).status, 401);
  assert.equal((await aiControls.GET()).status, 401);
  assert.equal(await client.aiRun.count(), 0);
  session = { userId: "u-team", email: "t@x.ma", fullName: "Team One", role: "sales", avatarInitials: "TO" };
  ownerAllowed = false;
  assert.equal((await aiControls.GET()).status, 403);
  assert.equal((await aiControls.PATCH(req({ enabled: true }))).status, 403);
});

test("the real start route never reaches a paid call without a key, even with everything on", { skip }, async () => {
  // Port 443 on a reserved name: the production fetcher refuses it before connecting.
  const lead = await newLead({ message: "x\nSite : https://riad.internal/\nLangue : FR\nProblème décrit : x" });
  const res = await start.POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: lead.id }) });
  assert.equal(res.status, 201);
  const { runId, status } = await res.json();
  assert.equal(status, "BLOCKED");
  assert.equal((await row(runId)).errorCode, "BLOCKED_HOST");
});

test("the owner can switch off at once and lower caps, but not raise them past the ceiling", { skip }, async () => {
  const off = await aiControls.PATCH(req({ enabled: false }));
  assert.equal(off.status, 200);
  assert.equal((await client.aiControl.findUnique({ where: { id: "singleton" } })).enabled, false);
  assert.ok(audits.includes("AI_CONTROLS_CHANGED"));
  assert.equal((await run((await newLead()).id)).kind, "denied", "the very next run sees it");

  assert.equal((await aiControls.PATCH(req({ dailyRunCap: 11 }))).status, 400);
  assert.equal((await aiControls.PATCH(req({ monthlyBudgetMicros: 5_000_001 }))).status, 400);
  assert.equal((await aiControls.PATCH(req({ somethingElse: true }))).status, 400);
  assert.equal((await aiControls.PATCH(req({ dailyRunCap: 3 }))).status, 200);
  const status = await (await aiControls.GET()).json();
  assert.equal(status.dailyRunCap, 3);
  assert.equal(status.model, "claude-sonnet-5-5");
  assert.equal(status.keyPresent, false);
});

test("nothing can be marked sent before a person approves it", { skip }, async () => {
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  assert.equal((await patch(lead.id, runId, { action: "confirm_sent" })).status, 409);
  const saved = await row(runId);
  assert.equal(saved.status, "DRAFT_READY");
  assert.equal(saved.sentConfirmedAt, null);
  assert.equal(await client.leadNote.count({ where: { leadId: lead.id } }), 0);
  assert.equal((await client.lead.findUnique({ where: { id: lead.id } })).status, "NEW");
});

test("approve, then confirm: exact text stored, one note, status moves once, a repeat adds nothing", { skip }, async () => {
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  const edited = { ...text, body: `${text.body} Texte relu par une personne.` };

  assert.equal((await patch(lead.id, runId, { action: "approve", channel: "EMAIL", ...edited })).status, 200);
  let saved = await row(runId);
  assert.equal(saved.status, "APPROVED");
  assert.equal(saved.approvedBody, edited.body);
  assert.equal(saved.approvedById, "u-team");
  assert.equal(saved.channel, "EMAIL");
  assert.equal((await client.lead.findUnique({ where: { id: lead.id } })).status, "NEW", "approving isn't sending");

  const first = await patch(lead.id, runId, { action: "confirm_sent" });
  assert.equal(first.status, 200);
  saved = await row(runId);
  assert.equal(saved.status, "SENT");
  assert.equal(saved.sentConfirmedById, "u-team");
  assert.equal((await client.lead.findUnique({ where: { id: lead.id } })).status, "CONTACTED");
  const notes = await client.leadNote.findMany({ where: { leadId: lead.id } });
  assert.equal(notes.length, 1);
  assert.match(notes[0].content, /Texte relu par une personne/);

  const repeat = await patch(lead.id, runId, { action: "confirm_sent" });
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).duplicate, true);
  assert.equal(await client.leadNote.count({ where: { leadId: lead.id } }), 1);
  assert.equal(audits.filter((a) => a === "AI_DIAGNOSIS_SENT_CONFIRMED").length, 1);
});

test("two simultaneous confirmations record one send", { skip }, async () => {
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  await patch(lead.id, runId, { action: "approve", channel: "EMAIL", ...text });
  const all = await Promise.all(Array.from({ length: 6 }, () => patch(lead.id, runId, { action: "confirm_sent" })));
  assert.ok(all.every((r) => r.status === 200));
  assert.equal(await client.leadNote.count({ where: { leadId: lead.id } }), 1);
});

test("a later lead status is never pulled back by a confirmed send", { skip }, async () => {
  const lead = await newLead({ status: "QUALIFIED" });
  const { runId } = finished(await run(lead.id));
  await patch(lead.id, runId, { action: "approve", channel: "EMAIL", ...text });
  await patch(lead.id, runId, { action: "confirm_sent" });
  assert.equal((await client.lead.findUnique({ where: { id: lead.id } })).status, "QUALIFIED");
});

test("editing an approved draft takes the approval away", { skip }, async () => {
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  await patch(lead.id, runId, { action: "approve", channel: "EMAIL", ...text });
  assert.equal((await patch(lead.id, runId, { action: "save", subject: "Autre", body: "Bonjour Sara, autre texte." })).status, 200);
  const saved = await row(runId);
  assert.equal(saved.status, "DRAFT_READY");
  assert.equal(saved.approvedBody, null);
  assert.equal(saved.approvedById, null);
  assert.equal((await patch(lead.id, runId, { action: "confirm_sent" })).status, 409);
});

test("approval checks: blocking quality errors, WhatsApp needs a phone, wrong lead or status refused", { skip }, async () => {
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  const noName = await patch(lead.id, runId, { action: "approve", channel: "EMAIL", subject: "S", body: "Un message qui ne nomme personne du tout." });
  assert.equal(noName.status, 422);
  assert.equal((await noName.json()).error, "quality");
  assert.equal((await row(runId)).status, "DRAFT_READY");

  const noPhone = await newLead({ phone: null });
  const second = finished(await run(noPhone.id));
  const whatsapp = await patch(noPhone.id, second.runId, { action: "approve", channel: "WHATSAPP", ...text });
  assert.equal((await whatsapp.json()).error, "no_phone");

  assert.equal((await patch(noPhone.id, runId, { action: "discard" })).status, 404, "a run belongs to its own enquiry");
  assert.equal((await patch(lead.id, runId, { action: "somethingElse" })).status, 400);
  assert.equal((await patch(lead.id, runId, { action: "approve", channel: "SMS", ...text })).status, 400);
  assert.equal((await patch(lead.id, runId, { action: "discard" })).status, 200);
  assert.equal((await patch(lead.id, runId, { action: "approve", channel: "EMAIL", ...text })).status, 409, "a discarded draft stays discarded");
});

test("a run with no draft can't be approved until a person writes one; BLOCKED and FAILED never can", { skip }, async () => {
  await client.aiControl.update({ where: { id: "singleton" }, data: { aiEnabled: false } });
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  assert.equal((await row(runId)).draftBody, null);
  assert.equal((await patch(lead.id, runId, { action: "approve", channel: "EMAIL", subject: "", body: "" })).status, 400);
  assert.equal((await patch(lead.id, runId, { action: "approve", channel: "EMAIL", ...text })).status, 200);

  const blockedLead = await newLead();
  const blocked = finished(await run(blockedLead.id, { fetcher: strictFetcher }));
  assert.equal((await patch(blockedLead.id, blocked.runId, { action: "approve", channel: "EMAIL", ...text })).status, 409);
});

test("deleting a lead keeps its spend in the budget", { skip }, async () => {
  const lead = await newLead();
  const { runId } = finished(await run(lead.id));
  await client.lead.delete({ where: { id: lead.id } });
  const saved = await row(runId);
  assert.equal(saved.leadId, null);
  assert.equal((await controls.usageNow()).monthSpentMicros, saved.costMicros);
});
