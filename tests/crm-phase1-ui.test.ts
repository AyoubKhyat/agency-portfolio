/**
 * CRM simplification, Phase 1 — final UI rules, checked without a database:
 *  - internal-test enquiries are a hand-set status, never guessed, never bulk-applied;
 *  - Prospects keeps search, stage and contact readiness visible and folds every
 *    other filter (all still present) into "Advanced filters";
 *  - historical follow-up metrics are labelled as dates/statuses, counts unchanged.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEAD_STATUSES, LEAD_TEST_STATUS, LEAD_BOARD_STATUSES, leadStatusLabel,
} from "../src/lib/lead-status";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ─── Internal-test enquiries ────────────────────────────────────

test("TEST is an extra lead status; the existing four are unchanged", () => {
  assert.deepEqual([...LEAD_STATUSES], ["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "TEST"]);
  assert.deepEqual([...LEAD_BOARD_STATUSES], ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]);
  assert.equal(LEAD_TEST_STATUS, "TEST");
  assert.equal(leadStatusLabel("TEST"), "Internal test");
  assert.equal(leadStatusLabel("NEW"), "New");
  assert.equal(leadStatusLabel("SOMETHING_ELSE"), "SOMETHING_ELSE"); // unknown values shown as stored
});

test("marking a test is one enquiry at a time, confirmed, through the existing PATCH", () => {
  const route = read("src/app/api/admin/leads/[id]/route.ts");
  assert.match(route, /z\.enum\(LEAD_STATUSES\)/);
  assert.doesNotMatch(route, /updateMany|deleteMany/);
  const page = read("src/app/admin/leads/[id]/page.tsx");
  assert.match(page, /newStatus === LEAD_TEST_STATUS && !confirm\(/);
  // No code path picks tests by content (name, email, subject...) or marks several at once.
  for (const rel of ["src/lib/dal/leads.ts", "src/lib/dal/stats.ts", "src/lib/dal/prospects.ts", "src/app/admin/page.tsx", "src/app/admin/leads/page.tsx", "src/lib/lead-status.ts"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /status:\s*(LEAD_TEST_STATUS|"TEST")\s*}\s*,?\s*data:/, `${rel} writes TEST in bulk`);
    assert.doesNotMatch(src, /(email|fullName|subject|message):\s*\{[^}]*contains/, `${rel} filters leads by content`);
    assert.doesNotMatch(src, /\/[^/\n]*test[^/\n]*\/i?\.test\(|\.(includes|match)\(\s*["'`/][^)]*test/i, `${rel} pattern-matches "test" in content`);
  }
});

test("tests stay visible in the inbox, off the board, out of new-enquiry counts", () => {
  const inbox = read("src/app/admin/leads/page.tsx");
  assert.match(inbox, /const COLUMNS = LEAD_BOARD_STATUSES/);
  assert.match(inbox, /value: LEAD_TEST_STATUS, label: "Internal tests"/);
  assert.match(inbox, /kept off this board/);
  const overview = read("src/app/admin/overview/page.tsx");
  assert.match(overview, /getTotal\(data\?\.leadsByStatus\) - getCount\(data\?\.leadsByStatus, "TEST"\)/);
});

// ─── Prospects filters ──────────────────────────────────────────

test("Prospects: search, stage and contact readiness visible; the rest under Advanced filters", () => {
  const src = read("src/app/admin/prospecting/page.tsx");
  const adv = src.indexOf("{/* Advanced filters");
  const advEnd = src.indexOf("</details>", adv);
  assert.ok(adv > 0 && advEnd > adv, "Advanced filters block not found");
  const before = src.slice(src.indexOf("{/* Search */}"), adv);
  const inside = src.slice(adv, advEnd);

  assert.match(before, /placeholder="Search by name/);
  assert.match(before, /STAGES\.map/);
  assert.match(before, />Contact readiness</);

  // Every other existing filter is still there, now inside the panel.
  for (const [name, marker] of [
    ["segment", "PROSPECT_SEGMENTS.map"],
    ["detailed status", "STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s]"],
    ["outreach record", '{ id: "legacy", label: "Old send, unconfirmed" }'],
    ["sector", "SECTORS.map"],
    ["quality", '{ id: "HOT", label: "🔥 HOT only"'],
    ["owner", '{ id: "UNASSIGNED", label: "Unassigned"'],
  ] as const) {
    assert.ok(inside.includes(marker), `${name} filter missing from Advanced filters`);
    assert.ok(!before.includes(marker), `${name} filter still in the always-visible area`);
  }
  // The panel opens by itself when a URL arrives with an advanced filter set.
  assert.match(inside, /open=\{advancedCount > 0 \|\| undefined\}/);
  for (const f of ["segmentFilter", "evidenceFilter", "sectorFilter", "qualityFilter", "ownerFilter"]) {
    assert.match(src, new RegExp(`${f} !== "ALL",`), `${f} not counted as an advanced filter`);
  }
  // URL parameters are unchanged.
  for (const q of ["status", "sector", "qualityLabel", "segment", "due", "channel", "evidence", "owner", "page"]) {
    assert.ok(src.includes(`qs.set("${q}"`), `URL parameter ${q} no longer written`);
  }
});

// ─── Historical metric labels ───────────────────────────────────

test("historical follow-up metrics are labelled as dates or statuses and point to Today", () => {
  const overview = read("src/app/admin/overview/page.tsx");
  assert.doesNotMatch(overview, /follow-ups due<\/div>/);
  assert.match(overview, /still marked &ldquo;Sent&rdquo;/);
  assert.match(overview, /Overdue follow-up dates/);
  assert.match(overview, /<Link href="\/admin" [^>]*>Today<\/Link> shows which are backed by a recorded send/);

  const ccRoute = read("src/app/api/admin/command-center/route.ts");
  assert.match(ccRoute, /label: "Overdue follow-up dates", +count: overdueFollowUps/);
  const ccPage = read("src/app/admin/command-center/page.tsx");
  assert.match(ccPage, /<Link href="\/admin" [^>]*>Today<\/Link> shows which are backed by a recorded send/);

  const prospects = read("src/app/admin/prospecting/page.tsx");
  assert.match(prospects, /label: "Overdue dates", value: kpis\?\.overdueFollowups/);
});
