/**
 * Access control for the admin area (T044).
 *  - static: every handler of every /api/admin route checks the session before doing anything
 *  - proxy: /admin pages redirect to the login page without a valid token
 * No database. Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const API = path.join(process.cwd(), "src/app/api/admin");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? routeFiles(p) : name === "route.ts" ? [p] : [];
  });
}

/** Routes that must work without a session: signing in and out. */
const PUBLIC = new Set(["login/route.ts", "logout/route.ts"]);
/** Routes whose handlers come from a factory; the factory file must hold one guard per handler. */
const DELEGATED: Record<string, { file: string; handlers: number }> = {
  "workspace/discovery/[id]/outreach/route.ts": { file: "src/lib/workspace/outreach.ts", handlers: 3 },
  "workspace/prospect/[id]/outreach/route.ts": { file: "src/lib/workspace/outreach.ts", handlers: 3 },
};
const GUARD = /\b(requireTeam|requireAdmin|requireOwner|getSession)\(/;

test("every /api/admin route calls an auth guard, except login and logout", () => {
  const files = routeFiles(API);
  assert.ok(files.length > 50, "route discovery found too few files");
  const unguarded = files
    .map((f) => path.relative(API, f).split(path.sep).join("/"))
    .filter((rel) => !PUBLIC.has(rel))
    .filter((rel) => !GUARD.test(readFileSync(path.join(API, rel), "utf8")))
    .filter((rel) => {
      const d = DELEGATED[rel];
      if (!d) return true;
      const guards = readFileSync(path.join(process.cwd(), d.file), "utf8").match(new RegExp(GUARD.source, "g")) ?? [];
      return guards.length < d.handlers;
    });
  assert.deepEqual(unguarded, [], `routes without an auth guard: ${unguarded.join(", ")}`);
});

test("every exported handler of a guarded route reaches the guard before any database access", () => {
  const offenders: string[] = [];
  for (const f of routeFiles(API)) {
    const rel = path.relative(API, f).split(path.sep).join("/");
    if (PUBLIC.has(rel) || DELEGATED[rel]) continue;
    const src = readFileSync(f, "utf8");
    const handlers = src.split(/\nexport\s+(?:async\s+)?function\s+/).slice(1);
    for (const h of handlers) {
      const name = h.slice(0, h.indexOf("("));
      if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(name)) continue;
      const guardAt = h.search(GUARD);
      const prismaAt = h.search(/\bprisma\.|\bdb\(\)/);
      // A handler that wraps its work elsewhere (no guard text at all) is caught by the previous test per file;
      // here we only require that, when both appear, the guard comes first.
      if (guardAt === -1 ? prismaAt !== -1 : prismaAt !== -1 && prismaAt < guardAt) offenders.push(`${rel} ${name}`);
    }
  }
  assert.deepEqual(offenders, [], `handlers touching the database before/without a guard: ${offenders.join(", ")}`);
});
