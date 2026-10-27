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

test("public webhook objects never carry the signing secret", () => {
  const row = { id: "w1", name: "n", url: "https://example.test/h", events: "lead.new", isActive: true, secret: "s3cr3t-value", createdAt: new Date(0) };
  const pub = toPublicWebhook(row);
  assert.equal("secret" in pub, false);
  assert.equal(pub.hasSecret, true);
  assert.equal(JSON.stringify(pub).includes("s3cr3t-value"), false);
  assert.equal(toPublicWebhook({ ...row, secret: null }).hasSecret, false);
  assert.equal(toPublicWebhook({ ...row, secret: "" }).hasSecret, false);
});
