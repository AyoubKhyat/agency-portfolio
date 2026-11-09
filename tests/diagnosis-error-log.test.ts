/**
 * The catch-all in runInboundDiagnosis must never write personal data to the server logs. A Prisma
 * validation error's message repeats the values being saved: the draft (which greets the visitor by name),
 * evidence and URLs. The run is driven into that catch with mocked dependencies; no database, no network.
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SECRET_SITE = "https://riad-secret-example.ma";
const PII = ["Samira", "samira@example.ma", "riad-secret-example", "+212600000000", "Bonjour", "Votre site"];

let updateError: Error | null = null;
let auditError: Error | null = null;
const saved: Record<string, unknown>[] = [];
let mod: typeof import("../src/lib/ai-workforce/inbound-diagnosis");

const lead = {
  id: "lead-1", fullName: "Samira Example", email: "samira@example.ma", phone: "+212600000000", status: "NEW",
  subject: "Diagnostic gratuit", message: `Demande de diagnostic gratuit du site.\nSite : ${SECRET_SITE}\nLangue : FR\nProblème décrit : lent`,
};

/** Shaped like Prisma's validation error: the message carries the arguments of the failed call. */
class PrismaClientValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PrismaClientValidationError"; }
}
class PrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, code: string) { super(message); this.name = "PrismaClientKnownRequestError"; this.code = code; }
}

before(async () => {
  process.env.AI_WORKFORCE_ENABLED = "1";
  const tx = {
    $executeRaw: async () => 1,
    aiControl: { findUnique: async () => ({ enabled: true, aiEnabled: false, dailyRunCap: 10, monthlyBudgetMicros: 5_000_000 }) },
    aiRun: {
      updateMany: async () => ({ count: 0 }), count: async () => 0, findFirst: async () => null,
      aggregate: async () => ({ _sum: { costMicros: 0, reservedMicros: 0 } }), create: async () => ({ id: "run-1" }),
    },
  };
  const prisma = {
    lead: { findUnique: async () => lead },
    aiRun: { update: async (args: { data: Record<string, unknown> }) => { saved.push(args.data); if (updateError) throw updateError; return {}; } },
    aiControl: { findUnique: tx.aiControl.findUnique },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  mock.module("@/lib/prisma", { namedExports: { prisma, hasPrisma: () => true } });
  mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async () => {} } });
  mock.module("@/lib/discovery/duplicates", { namedExports: { detectDuplicate: async () => null } });
  mock.module("@/lib/website-audit", {
    namedExports: {
      auditWebsite: async () => {
        if (auditError) throw auditError;
        return { outcome: "COMPLETE", code: null, finalUrl: `${SECRET_SITE}/fr`, gapScore: 10, fitLabel: "COLD",
          evidence: [{ id: "e1", check: "title", status: "fail", observed: "Riad Samira", sourceUrl: SECRET_SITE }] };
      },
    },
  });
  mod = await import("../src/lib/ai-workforce/inbound-diagnosis");
});

beforeEach(() => {
  updateError = null;
  auditError = null;
  saved.length = 0;
});

/** Runs one diagnosis and returns everything console.error printed during it. */
async function runAndCaptureLogs() {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a) ?? String(a))).join(" ")); };
  try {
    const result = await mod.runInboundDiagnosis("lead-1", { userId: "u-team", fullName: "Team One" }, null, { aiKeyPresent: false });
    return { result, logs: lines.join("\n") };
  } finally {
    console.error = original;
  }
}

test("a Prisma validation error while saving the run logs only its type", async () => {
  updateError = new PrismaClientValidationError(
    `Invalid \`prisma.aiRun.update()\` invocation:\n{ data: { finalUrl: "${SECRET_SITE}/fr", draftBody: "Bonjour Samira, Votre site...", evidence: [{ observed: "samira@example.ma +212600000000" }] } }`,
  );
  const { result, logs } = await runAndCaptureLogs();
  assert.deepEqual(result, { kind: "finished", runId: "run-1", status: "FAILED" });
  assert.match(logs, /\[ai-workforce\] run failed: run-1 PrismaClientValidationError/);
  for (const p of PII) assert.ok(!logs.includes(p), `log must not contain ${p}: ${logs}`);
  assert.ok(saved.some((d) => d.status === "FAILED" && d.errorCode === "INTERNAL"), "the run is still marked failed");
});

test("a coded error logs its type and code, nothing else", async () => {
  updateError = new PrismaClientKnownRequestError(`Record for ${SECRET_SITE} by Samira not found`, "P2025");
  const { logs } = await runAndCaptureLogs();
  assert.match(logs, /run failed: run-1 PrismaClientKnownRequestError P2025/);
  for (const p of PII) assert.ok(!logs.includes(p), `log must not contain ${p}`);
});

test("an error thrown while reading the site doesn't log the site's address", async () => {
  auditError = new Error(`fetch failed for ${SECRET_SITE} (Samira)`);
  const { result, logs } = await runAndCaptureLogs();
  assert.equal(result.kind, "finished");
  assert.match(logs, /run failed: run-1 Error$/m);
  for (const p of PII) assert.ok(!logs.includes(p), `log must not contain ${p}`);
});

test("safeErrorSummary drops names and codes that aren't plain identifiers", () => {
  assert.equal(mod.safeErrorSummary(new Error("Samira")), "Error");
  const odd = new Error("x");
  odd.name = "Bonjour Samira";
  assert.equal(mod.safeErrorSummary(odd), "Error");
  assert.equal(mod.safeErrorSummary(Object.assign(new Error("x"), { code: "samira@example.ma" })), "Error");
  assert.equal(mod.safeErrorSummary(Object.assign(new TypeError("x"), { code: "ECONNRESET" })), "TypeError ECONNRESET");
  assert.equal(mod.safeErrorSummary("Bonjour Samira"), "string");
  assert.equal(mod.safeErrorSummary(null), "object");
});

test("no console call in the diagnosis module logs an error message", () => {
  const src = readFileSync(new URL("../src/lib/ai-workforce/inbound-diagnosis.ts", import.meta.url), "utf8");
  const calls = src.match(/console\.(log|error|warn|info)\([^;]*\);/g) ?? [];
  assert.ok(calls.length > 0);
  for (const c of calls) assert.doesNotMatch(c, /\.message|\berr\b(?!\))/, `unsafe log: ${c}`);
});
