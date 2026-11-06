/**
 * A paid draft needs real evidence: with every switch on, a bot check or a thin page must never reach the AI.
 * Runs the real run code with the database and the AI faked: no database, network or paid call.
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { SafeFetch, SafeResponse } from "../src/lib/website-audit/safe-fetch";

/* eslint-disable @typescript-eslint/no-explicit-any */
let saved: Record<string, any> = {};
let mod: typeof import("../src/lib/ai-workforce/inbound-diagnosis");
let client: typeof import("../src/lib/ai-workforce/client");

const LEAD = {
  id: "lead-1", subject: "Diagnostic gratuit", fullName: "Sara Bennani", email: "sara@riad.ma", phone: null,
  message: "Demande de diagnostic\nSite : https://site.ma/\nLangue : FR\nProblème décrit : non précisé",
};
const CONTROL = { id: "singleton", enabled: true, aiEnabled: true, dailyRunCap: 10, monthlyBudgetMicros: 5_000_000 };

before(async () => {
  process.env.AI_WORKFORCE_ENABLED = "1";
  const aiRun = {
    create: async ({ data }: any) => { saved = { ...data, id: "run-1" }; return saved; },
    update: async ({ data }: any) => { saved = { ...saved, ...data }; return saved; },
    updateMany: async () => ({ count: 0 }),
    count: async () => 0,
    aggregate: async () => ({ _sum: { costMicros: 0, reservedMicros: 0 } }),
  };
  const aiControl = { findUnique: async () => CONTROL };
  const tx = { $executeRaw: async () => 0, aiRun, aiControl };
  mock.module("@/lib/prisma", {
    namedExports: {
      hasPrisma: () => true,
      prisma: { lead: { findUnique: async () => LEAD }, aiRun, aiControl, $transaction: async (fn: any) => fn(tx) },
    },
  });
  mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async () => {} } });
  mod = await import("../src/lib/ai-workforce/inbound-diagnosis");
  client = await import("../src/lib/ai-workforce/client");
});
beforeEach(() => { saved = {}; });

const res = (url: string, body: string, over: Partial<SafeResponse> = {}): SafeResponse => ({
  requestedUrl: url, finalUrl: url, status: 200, headers: {}, body, bytes: body.length, truncated: false, ms: 100, hops: 0, ...over,
} as SafeResponse);

const siteAnswering = (main: (url: string) => SafeResponse): SafeFetch => async (url) => {
  const path = new URL(url).pathname;
  if (path === "/robots.txt") return res(url, "User-agent: *\nDisallow:");
  if (path === "/") return main(url);
  return res(url, "", { status: 404 });
};

const run = async (main: (url: string) => SafeResponse, generate?: () => Promise<never>) => {
  let aiCalls = 0;
  const result = await mod.runInboundDiagnosis("lead-1", { userId: "u1", fullName: "Team" }, null, {
    fetcher: siteAnswering(main),
    aiKeyPresent: true,
    generate: async () => { aiCalls++; if (generate) return generate(); return { raw: null, stopReason: "stop", model: "fake", inputTokens: 1, outputTokens: 1 }; },
  });
  return { result, aiCalls };
};

const WAF = '<html lang="en"><head><meta name="viewport" content="width=device-width"><script src="https://x.awswaf.com/challenge.js"></script></head><body></body></html>';
const SHELL = '<html lang="fr"><head><title>App</title><meta name="viewport" content="width=device-width"><script src="/a.js"></script></head><body><div id="root"></div></body></html>';
const REAL = `<!doctype html><html lang="fr"><head><title>Riad</title></head><body><h1>Riad</h1><p>${"Un riad à Marrakech. ".repeat(20)}</p></body></html>`;

for (const [label, main, code] of [
  ["bot check, as Dribbble answered", (u: string) => res(u, WAF, { status: 202, headers: { "x-amzn-waf-action": "challenge" } }), "BOT_CHALLENGE"],
  ["bot check behind a plain 200", (u: string) => res(u, WAF), "BOT_CHALLENGE"],
  ["empty page", (u: string) => res(u, ""), "NO_PAGE_CONTENT"],
  ["JavaScript shell with too little to read", (u: string) => res(u, SHELL), "INSUFFICIENT_EVIDENCE"],
] as const) {
  test(`${label}: audit only, no paid call, nothing reserved or spent`, async () => {
    const { result, aiCalls } = await run(main);
    assert.equal(aiCalls, 0, "the AI was not called");
    assert.deepEqual(result, { kind: "finished", runId: "run-1", status: "AUDIT_ONLY" });
    assert.equal(saved.errorCode, code);
    assert.equal(saved.gapScore, null);
    assert.equal(saved.fitLabel, null);
    assert.equal(saved.reservedMicros, 0, "the reservation was released");
    assert.ok(!saved.costMicros, "nothing was spent");
    assert.ok(!saved.draftBody, "no draft");
  });
}

test("control: a real page does reach the AI, so these tests aren't passing because nothing ever does", async () => {
  const { aiCalls } = await run((u) => res(u, REAL));
  assert.equal(aiCalls, 1);
});

for (const [label, make, code, cost] of [
  ["rate limit", () => new client.WorkforceApiError(429, "rate_limit_exceeded", 30), "AI_RATE_LIMITED", false],
  ["retired model", () => new client.WorkforceApiError(400, "model_decommissioned", null), "AI_MODEL_UNAVAILABLE", false],
  ["server error", () => new client.WorkforceApiError(503, null, null), "AI_ERROR", false],
  ["lost connection", () => new client.WorkforceConnectionError(), "AI_CONNECTION", true],
] as const) {
  test(`${label}: one attempt, failed run, no draft, and the reservation settled`, async () => {
    const { result, aiCalls } = await run((u) => res(u, REAL), async () => { throw make(); });
    assert.equal(aiCalls, 1, "never retried");
    assert.deepEqual(result, { kind: "finished", runId: "run-1", status: "FAILED" });
    assert.equal(saved.errorCode, code);
    assert.equal(saved.reservedMicros, 0);
    assert.equal(saved.costMicros > 0, cost, "only a lost connection may have been processed");
    assert.ok(!saved.draftBody, "no draft");
    assert.ok(!saved.findings, "no findings");
  });
}
