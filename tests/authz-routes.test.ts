/**
 * Static guard checks for the owner tier: every handler of these routes must start with requireOwner()
 * and none may fall back to a bare getSession() check. Plus the webhook secret never appears in a
 * public webhook object. No database; behaviour end to end is in tests/account-db.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toPublicWebhook } from "../src/lib/webhooks";

/** Customer-data exports, full backup, audit log, debug, and all webhook management. */
const OWNER_ROUTES = [
  "export/route.ts",
  "export/csv/route.ts",
  "export/backup/route.ts",
  "audit/route.ts",
  "debug/route.ts",
  "webhooks/route.ts",
  "webhooks/[id]/route.ts",
  "webhooks/test/route.ts",
  "ai-controls/route.ts",
];

test("every handler of an owner-tier route is guarded by requireOwner()", () => {
  for (const rel of OWNER_ROUTES) {
    const src = readFileSync(new URL(`../src/app/api/admin/${rel}`, import.meta.url), "utf8");
    const handlers = src.split(/\nexport\s+async\s+function\s+/).slice(1);
    assert.ok(handlers.length > 0, `${rel}: no handlers found`);
    for (const h of handlers) {
      const name = h.slice(0, h.indexOf("("));
      const open = /\)\s*(?::[^{\n]*)?\{\s*\n/.exec(h); // end of the (possibly multi-line) signature
      assert.ok(open, `${rel} ${name}: signature not found`);
      const body = h.slice(open.index + open[0].length);
      const firstStatement = body.split("\n").find((l) => l.trim() && l.trim() !== "{" && !l.trim().startsWith("//") && !l.trim().startsWith(")"));
      assert.match(firstStatement ?? "", /await requireOwner\(\)/, `${rel} ${name}: must start with requireOwner()`);
    }
    assert.doesNotMatch(src, /getSession\(/, `${rel}: no bare getSession() checks`);
  }
});

/** The first statement of handler `name` in a route file (signature may span lines). */
function firstStatementOf(rel: string, name: string): string {
  const src = readFileSync(new URL(`../src/app/api/admin/${rel}`, import.meta.url), "utf8");
  const h = src.split(/\nexport\s+async\s+function\s+/).slice(1).find((x) => x.startsWith(`${name}(`));
  assert.ok(h, `${rel} ${name}: handler not found`);
  const open = /\)\s*(?::[^{\n]*)?\{\s*\n/.exec(h);
  assert.ok(open, `${rel} ${name}: signature not found`);
  return h.slice(open.index + open[0].length).split("\n").find((l) => l.trim() && !l.trim().startsWith("//")) ?? "";
}

/** Legacy discovery writes: live or paid searches, bulk prospect writes and fixes. Owner or admin only. */
const OWNER_OR_ADMIN_HANDLERS: [string, string][] = [
  ["prospect-discovery/search/route.ts", "POST"],
  ["prospect-discovery/sweeps/route.ts", "POST"],
  ["prospect-discovery/import/route.ts", "POST"],
  ["prospect-discovery/campaigns/route.ts", "POST"],
  ["prospect-discovery/targets/route.ts", "PUT"],
  ["discovery/search/route.ts", "POST"],
  ["discovery/preview/route.ts", "POST"],
  ["discovery/import/route.ts", "POST"],
  ["data-audit/route.ts", "POST"],
];
/** Reads next to them stay open to the whole team, and so does the Daily Lead Agent's Today import. */
const TEAM_HANDLERS: [string, string][] = [
  ["prospect-discovery/sweeps/route.ts", "GET"],
  ["prospect-discovery/sweeps/check/route.ts", "POST"],
  ["prospect-discovery/campaigns/route.ts", "GET"],
  ["prospect-discovery/targets/route.ts", "GET"],
  ["prospect-discovery/coverage/route.ts", "GET"],
  ["prospect-discovery/sectors/route.ts", "GET"],
  ["data-audit/route.ts", "GET"],
  ["daily-leads/route.ts", "GET"],
  ["daily-leads/route.ts", "POST"],
];

test("legacy discovery writes start with requireOwnerOrAdmin(); their reads and Today stay team", () => {
  for (const [rel, name] of OWNER_OR_ADMIN_HANDLERS) {
    assert.match(firstStatementOf(rel, name), /^\s*const auth = await requireOwnerOrAdmin\(\);/, `${rel} ${name}`);
  }
  for (const [rel, name] of TEAM_HANDLERS) {
    assert.match(firstStatementOf(rel, name), /^\s*const auth = await requireTeam\(\);/, `${rel} ${name}`);
  }
});

test("the shared import helper is server code with no route and no guard of its own; Today calls it, not the API", () => {
  const helper = readFileSync(new URL("../src/lib/prospect-import.ts", import.meta.url), "utf8");
  assert.match(helper, /export async function importCandidates\(input: unknown, session: ImportSession, opts: ImportOptions = \{\}\)/,
    "the third argument is server-side options only (notes the caller writes), never part of the request body");
  assert.doesNotMatch(helper, /\bexport (async )?function (GET|POST|PUT|PATCH|DELETE)\b/, "not a route handler");
  assert.doesNotMatch(helper, /"use client"/);
  const daily = readFileSync(new URL("../src/app/api/admin/daily-leads/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(daily, /prospect-discovery\/import\/route/, "Today no longer goes through the owner-or-admin API");
  assert.match(daily, /importCandidates\(\{ candidates: \[importCandidate\(lead\)\], allowPossibleDuplicates: false \}, auth\.session,\s*\{ serverNotes: \(sourceId\) => \(sourceId === lead\.osmId \? notes : \[\]\) \}\)/,
    "duplicates are still re-checked; the notes come from the server's own copy of the lead");
  assert.match(daily, /const notes = importNotes\(lead\);/);
});

test("public webhook objects never carry the signing secret", () => {
  const row = { id: "w1", name: "n", url: "https://example.test/h", events: "lead.new", isActive: true, secret: "s3cr3t-value", createdAt: new Date(0) };
  const pub = toPublicWebhook(row);
  assert.equal("secret" in pub, false);
  assert.equal(pub.hasSecret, true);
  assert.equal(JSON.stringify(pub).includes("s3cr3t-value"), false);
  assert.equal(toPublicWebhook({ ...row, secret: null }).hasSecret, false);
  assert.equal(toPublicWebhook({ ...row, secret: "" }).hasSecret, false);
});
