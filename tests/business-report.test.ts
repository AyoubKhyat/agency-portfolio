/**
 * Reports, Phase 2B — Business report money figures. MAD only with excluded
 * counts, no conversion or fallback, sent-only pipeline, drafts and pending
 * contracts apart, accepted proposals not double counted with their
 * contracts, paid invoices VAT-inclusive and dated by paidAt. Pure: no
 * database. Route and page wiring are checked statically.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildBusinessMoney, madAmount, isMad, monthChange, monthWindows,
  type BRContract, type BRInvoice, type BRProposal,
} from "../src/lib/business-report";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const NOW = new Date(2026, 10, 18, 12); // 18 Nov 2026, local time
const THIS_MONTH = new Date(2026, 10, 3);
const LAST_MONTH = new Date(2026, 9, 20);
const OLDER = new Date(2026, 5, 1);

let n = 0;
const prop = (status: string, amount: number | null, currency: string | null = "MAD", id = `p${++n}`): BRProposal => ({ id, status, amount, currency });
const con = (status: string, amount: number | null, extra: Partial<BRContract> = {}): BRContract => ({
  id: `c${++n}`, status, amount, currency: "MAD", proposalId: null, signedDate: null, createdById: null, sector: null, ...extra,
});
const inv = (status: string, total: number | null, paidAt: Date | null = THIS_MONTH, currency: string | null = "MAD"): BRInvoice => ({ status, total, currency, paidAt });
const build = (x: { proposals?: BRProposal[]; contracts?: BRContract[]; invoices?: BRInvoice[] }) =>
  buildBusinessMoney({ proposals: x.proposals ?? [], contracts: x.contracts ?? [], invoices: x.invoices ?? [] }, NOW);

// ─── Currencies and amounts ─────────────────────────────────────

test("only MAD amounts are summed; others are counted per source, never converted", () => {
  const m = build({
    proposals: [prop("SENT", 1000), prop("SENT", 500, "EUR"), prop("DRAFT", 300, "USD"), prop("SENT", 200, " mad ")],
    contracts: [con("SIGNED", 10000), con("SIGNED", 4000, { currency: "EUR" }), con("PENDING_SIGNATURE", 700, { currency: "" })],
    invoices: [inv("PAID", 1200), inv("PAID", 99, THIS_MONTH, "USD"), inv("PAID", 50, THIS_MONTH, null)],
  });
  assert.equal(m.pipeline.sent.value, 1200);
  assert.equal(m.pipeline.sent.count, 2);
  assert.equal(m.signed.value, 10000);
  assert.equal(m.paidInvoices.value, 1200);
  assert.deepEqual(m.excluded, { proposals: 2, contracts: 2, invoices: 2 });
});

test("missing or invalid amounts are excluded and counted, not treated as zero", () => {
  const m = build({
    proposals: [prop("SENT", null), prop("SENT", Number.NaN), prop("SENT", 100)],
    contracts: [con("SIGNED", null), con("ACTIVE", Number.POSITIVE_INFINITY), con("COMPLETED", 300)],
    invoices: [inv("PAID", null), inv("PAID", 50)],
  });
  assert.deepEqual(m.pipeline.sent, { value: 100, count: 1 });
  assert.deepEqual({ value: m.signed.value, count: m.signed.count }, { value: 300, count: 1 });
  assert.deepEqual({ value: m.paidInvoices.value, count: m.paidInvoices.count }, { value: 50, count: 1 });
  assert.deepEqual(m.excluded, { proposals: 2, contracts: 2, invoices: 1 });
});

test("madAmount and isMad normalise case and spaces only", () => {
  assert.equal(isMad("mad"), true);
  assert.equal(isMad(" MAD "), true);
  assert.equal(isMad("DH"), false);
  assert.equal(isMad(null), false);
  assert.equal(madAmount(0, "MAD"), 0, "a real zero is a valid amount");
  assert.equal(madAmount(5, "EUR"), null);
});

// ─── Pipeline buckets ───────────────────────────────────────────

test("the pipeline is SENT proposals only; drafts are reported apart", () => {
  const m = build({ proposals: [prop("SENT", 1000), prop("DRAFT", 9000), prop("REJECTED", 5000), prop("ARCHIVED", 1)] });
  assert.deepEqual(m.pipeline.sent, { value: 1000, count: 1 });
  assert.deepEqual(m.pipeline.drafts, { value: 9000, count: 1 });
  assert.deepEqual(m.pipeline.acceptedUnsigned, { value: 0, count: 0 });
});

test("signed value is SIGNED, ACTIVE and COMPLETED; DRAFT and CANCELLED contracts are not counted", () => {
  const m = build({ contracts: [con("SIGNED", 1), con("ACTIVE", 10), con("COMPLETED", 100), con("DRAFT", 1000), con("CANCELLED", 10000)] });
  assert.equal(m.signed.value, 111);
  assert.equal(m.signed.count, 3);
  assert.deepEqual(m.pipeline.awaitingSignature, { value: 0, count: 0 });
});

test("no fallback: zero signed contracts stay zero even with accepted proposals", () => {
  const m = build({ proposals: [prop("ACCEPTED", 20000)] });
  assert.equal(m.signed.value, 0);
  assert.deepEqual(m.pipeline.acceptedUnsigned, { value: 20000, count: 1 });
});

// ─── Linked contracts and duplicates ────────────────────────────

test("an accepted proposal is represented by its signed or pending contract, not counted twice", () => {
  const signedP = prop("ACCEPTED", 5000, "MAD", "ps");
  const pendingP = prop("ACCEPTED", 3000, "MAD", "pp");
  const draftP = prop("ACCEPTED", 2000, "MAD", "pd");
  const loneP = prop("ACCEPTED", 1000, "MAD", "pl");
  const m = build({
    proposals: [signedP, pendingP, draftP, loneP],
    contracts: [
      con("SIGNED", 5000, { proposalId: "ps", signedDate: THIS_MONTH }),
      con("PENDING_SIGNATURE", 3000, { proposalId: "pp" }),
      con("DRAFT", 2000, { proposalId: "pd" }), // auto-created on accept: the proposal stands for it
    ],
  });
  assert.equal(m.signed.value, 5000);
  assert.deepEqual(m.pipeline.awaitingSignature, { value: 3000, count: 1 });
  assert.deepEqual(m.pipeline.acceptedUnsigned, { value: 3000, count: 2 }, "the draft-contract one and the lone one");
  const total = m.signed.value + m.pipeline.awaitingSignature.value + m.pipeline.acceptedUnsigned.value;
  assert.equal(total, 11000, "each accepted deal counted exactly once");
});

test("a pending contract for a proposal that is already signed is not counted again", () => {
  const m = build({
    proposals: [prop("ACCEPTED", 4000, "MAD", "px")],
    contracts: [con("SIGNED", 4000, { proposalId: "px" }), con("PENDING_SIGNATURE", 4000, { proposalId: "px" })],
  });
  assert.equal(m.signed.value, 4000);
  assert.deepEqual(m.pipeline.awaitingSignature, { value: 0, count: 0 });
  assert.equal(m.proposalsWithSeveralContracts, 1, "flagged for a manual check");
});

test("duplicate signed contracts for one proposal are all counted and flagged, never silently dropped", () => {
  const m = build({
    proposals: [prop("ACCEPTED", 6000, "MAD", "pdup")],
    contracts: [con("SIGNED", 6000, { proposalId: "pdup" }), con("ACTIVE", 6000, { proposalId: "pdup" }), con("SIGNED", 1000, { proposalId: "other" })],
  });
  assert.equal(m.signed.value, 13000);
  assert.equal(m.signed.count, 3);
  assert.equal(m.proposalsWithSeveralContracts, 1);
  assert.deepEqual(m.pipeline.acceptedUnsigned, { value: 0, count: 0 });
});

test("a non-MAD signed contract still marks its proposal as represented", () => {
  const m = build({
    proposals: [prop("ACCEPTED", 900, "MAD", "pe")],
    contracts: [con("SIGNED", 900, { proposalId: "pe", currency: "EUR" })],
  });
  assert.deepEqual(m.pipeline.acceptedUnsigned, { value: 0, count: 0 });
  assert.equal(m.excluded.contracts, 1);
});

// ─── Periods and dates ──────────────────────────────────────────

test("signed contracts are split by signedDate; undated ones count in the total only", () => {
  const m = build({
    contracts: [
      con("SIGNED", 100, { signedDate: THIS_MONTH }), con("ACTIVE", 200, { signedDate: LAST_MONTH.toISOString() }),
      con("COMPLETED", 400, { signedDate: OLDER }), con("SIGNED", 800, { signedDate: null }), con("SIGNED", 1600, { signedDate: "not a date" }),
    ],
  });
  assert.equal(m.signed.value, 3100);
  assert.deepEqual(m.signed.thisMonth, { value: 100, count: 1 });
  assert.deepEqual(m.signed.lastMonth, { value: 200, count: 1 });
  assert.equal(m.signed.signedWithoutDate, 2);
});

test("paid invoices use paidAt; a PAID invoice without one is in the total only", () => {
  const m = build({
    invoices: [inv("PAID", 1200, THIS_MONTH), inv("PAID", 600, LAST_MONTH), inv("PAID", 300, OLDER), inv("PAID", 150, null), inv("SENT", 9999), inv("OVERDUE", 9999), inv("DRAFT", 9999)],
  });
  assert.equal(m.paidInvoices.value, 2250);
  assert.equal(m.paidInvoices.count, 4);
  assert.deepEqual(m.paidInvoices.thisMonth, { value: 1200, count: 1 });
  assert.deepEqual(m.paidInvoices.lastMonth, { value: 600, count: 1 });
  assert.equal(m.paidInvoices.paidWithoutDate, 1);
});

test("paid invoices are VAT-inclusive totals and never added to contract value", () => {
  const m = build({ contracts: [con("SIGNED", 10000, { signedDate: THIS_MONTH })], invoices: [inv("PAID", 12000)] });
  assert.equal(m.signed.value, 10000, "before tax, unchanged by the invoice");
  assert.equal(m.paidInvoices.value, 12000, "the invoice total, VAT included");
});

test("month windows start on the 1st of this and last month, across a year boundary", () => {
  const w = monthWindows(new Date(2027, 0, 5));
  assert.deepEqual([w.thisMonthStart.getFullYear(), w.thisMonthStart.getMonth(), w.thisMonthStart.getDate()], [2027, 0, 1]);
  assert.deepEqual([w.lastMonthStart.getFullYear(), w.lastMonthStart.getMonth(), w.lastMonthStart.getDate()], [2026, 11, 1]);
});

// ─── Leaderboard and sectors ────────────────────────────────────

test("top salesperson and sectors use MAD signed contracts only", () => {
  const m = build({
    contracts: [
      con("SIGNED", 5000, { createdById: "u1", sector: "Riads" }),
      con("SIGNED", 9000, { createdById: "u2", sector: "Spas", currency: "EUR" }),
      con("ACTIVE", 3000, { createdById: "u2", sector: " Riads " }),
      con("PENDING_SIGNATURE", 50000, { createdById: "u2", sector: "Spas" }),
      con("COMPLETED", 1000, { createdById: null, sector: "" }),
    ],
  });
  assert.deepEqual(m.topSalesperson, { userId: "u1", revenue: 5000, deals: 1 });
  assert.deepEqual(m.sectors, [{ sector: "Riads", revenue: 8000, deals: 2 }]);
});

// ─── Zero data and month change ─────────────────────────────────

test("no data gives zeros, no leader, no sectors and nothing excluded", () => {
  const m = build({});
  assert.deepEqual(m.signed, { value: 0, count: 0, thisMonth: { value: 0, count: 0 }, lastMonth: { value: 0, count: 0 }, signedWithoutDate: 0 });
  assert.deepEqual(m.pipeline.sent, { value: 0, count: 0 });
  assert.equal(m.paidInvoices.value, 0);
  assert.deepEqual(m.excluded, { proposals: 0, contracts: 0, invoices: 0 });
  assert.equal(m.topSalesperson, null);
  assert.deepEqual(m.sectors, []);
  assert.equal(m.proposalsWithSeveralContracts, 0);
});

test("month change is null without a previous month to compare with", () => {
  assert.equal(monthChange(100, 0), null);
  assert.equal(monthChange(0, 0), null);
  assert.equal(monthChange(150, 100), "+50%");
  assert.equal(monthChange(50, 100), "-50%");
  assert.equal(monthChange(100, Number.NaN), null);
});

// ─── Wiring (static) ────────────────────────────────────────────

test("the Business report route reads rows and leaves the money rules to the pure module", () => {
  const route = read("src/app/api/admin/command-center/route.ts");
  assert.match(route, /buildBusinessMoney\(/);
  assert.doesNotMatch(route, /revenueForecast|revenueWon|pipelineValue/);
  assert.doesNotMatch(route, /\$queryRaw/, "sector revenue no longer sums raw, mixed-currency amounts");
  assert.doesNotMatch(route, /_sum: \{ amount: true \}/);
  assert.match(route, /await requireTeam\(\)/);
  const getBody = route.slice(route.indexOf("export async function GET"));
  assert.doesNotMatch(getBody, /\.(create|update|upsert|delete)\w*\(/);
});

test("Business report labels say what each money figure is", () => {
  const page = read("src/app/admin/command-center/page.tsx");
  for (const label of ["Signed contracts", "Pipeline: sent proposals", "Paid invoices", "Money, in detail", "Accepted, not yet signed", "Contracts awaiting signature", "Draft proposals"]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), label);
  }
  assert.match(page, /VAT incl\./);
  assert.doesNotMatch(page, /label="Revenue won"|label="Pipeline value"|label="Revenue forecast"/);
});
