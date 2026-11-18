/**
 * Reports, Phase 2A — the Prospecting report reuses Today's "contacted"
 * definition, keeps send evidence apart from status, counts only Replied /
 * In talks / Won as replied, keeps Closed out of replies, and keeps non-MAD
 * proposals out of MAD totals. Pure: no database. Page and route wiring is
 * checked statically.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildProspectingReport, buildProposalReport, rate, formatRate, sectorName, NO_SECTOR,
  type ReportProspect, type ReportProposal,
} from "../src/lib/prospecting-report";
import { isContacted, OUTREACH_EVIDENCE_SINCE } from "../src/lib/prospect-stages";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const RECENT = new Date(OUTREACH_EVIDENCE_SINCE.getTime() + 86_400_000);
const OLD = new Date(OUTREACH_EVIDENCE_SINCE.getTime() - 86_400_000);
const p = (status: string, extra: Partial<ReportProspect> = {}): ReportProspect =>
  ({ sector: "Riads", status, sentAt: null, lastSendAt: null, ...extra });

// ─── Statuses ───────────────────────────────────────────────────

test("ENVOYE alone is marked contacted but is not a recorded send", () => {
  const { totals } = buildProspectingReport([p("ENVOYE")]);
  assert.equal(totals.contacted, 1);
  assert.equal(totals.contactedByStatusOnly, 1);
  assert.equal(totals.sendRecorded, 0);
  assert.equal(totals.legacySendOnly, 0);
  assert.equal(totals.noSendRecord, 1);
  assert.equal(totals.waitingWithoutSendRecord, 1);
  assert.equal(totals.replied, 0);
});

test("Replied, In talks and Won all count as replied; Won is CLIENT and CONVERTI", () => {
  const statuses = ["REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "CLIENT", "CONVERTI"];
  const { totals } = buildProspectingReport(statuses.map((s) => p(s)));
  assert.equal(totals.replied, 6);
  assert.equal(totals.inTalks, 3);
  assert.equal(totals.won, 2);
  assert.equal(totals.contacted, 6, "every replied stage is also contacted");
});

test("LOST, PERDU and REFUSE are closed, never replied, and not contacted by status alone", () => {
  const { totals, funnelAside } = buildProspectingReport([p("LOST"), p("PERDU"), p("REFUSE")]);
  assert.equal(totals.closed, 3);
  assert.equal(funnelAside.closed, 3);
  assert.equal(totals.replied, 0);
  assert.equal(totals.contacted, 0);
});

test("a closed prospect with a first-contact date is contacted, still not replied", () => {
  const { totals } = buildProspectingReport([p("LOST", { sentAt: RECENT })]);
  assert.equal(totals.contacted, 1);
  assert.equal(totals.contactedByStatusOnly, 0);
  assert.equal(totals.replied, 0);
});

test("contacted matches Today's isContacted for every status and signal", () => {
  const rows: ReportProspect[] = [];
  for (const status of ["A_ENVOYER", "ENVOYE", "REPONDU", "MEETING", "CLIENT", "CONVERTI", "LOST", "PAS_DE_WHATSAPP", "WEIRD"]) {
    rows.push(p(status), p(status, { sentAt: OLD }), p(status, { lastSendAt: RECENT }));
  }
  const { totals } = buildProspectingReport(rows);
  assert.equal(totals.contacted, rows.filter((r) => isContacted(r)).length);
});

test("unknown statuses are counted as other, not guessed into a stage", () => {
  const { totals, stages } = buildProspectingReport([p("WEIRD")]);
  assert.equal(totals.other, 1);
  assert.equal(totals.contacted, 0);
  assert.deepEqual(stages, [{ key: "OTHER", label: "Other status", count: 1 }]);
});

// ─── Evidence ───────────────────────────────────────────────────

test("send evidence splits recorded, legacy and none, and sums to contacted", () => {
  const { totals } = buildProspectingReport([
    p("ENVOYE", { lastSendAt: RECENT }),
    p("ENVOYE", { lastSendAt: OLD }),
    p("ENVOYE", { sentAt: RECENT }),
    p("REPONDU"),
    p("A_ENVOYER", { lastSendAt: RECENT }),
    p("A_ENVOYER"),
  ]);
  assert.equal(totals.contacted, 5);
  assert.equal(totals.sendRecorded, 2);
  assert.equal(totals.legacySendOnly, 1);
  assert.equal(totals.noSendRecord, 2);
  assert.equal(totals.sendRecorded + totals.legacySendOnly + totals.noSendRecord, totals.contacted);
  assert.equal(totals.contactedByStatusOnly, 1, "only REPONDU with no date or record");
  assert.equal(totals.waitingWithoutSendRecord, 1, "ENVOYE with only a date has no send record");
  assert.equal(totals.sendRecordedRate, 40);
});

test("a send exactly on the cleanup day counts as recorded", () => {
  const { totals } = buildProspectingReport([p("ENVOYE", { lastSendAt: OUTREACH_EVIDENCE_SINCE })]);
  assert.equal(totals.sendRecorded, 1);
});

// ─── Funnel and sectors ─────────────────────────────────────────

test("funnel steps are nested subsets, closed and unreachable sit outside", () => {
  const { funnel, funnelAside } = buildProspectingReport([
    p("A_ENVOYER"), p("ENVOYE"), p("REPONDU"), p("MEETING"), p("CLIENT"), p("LOST"), p("PAS_DE_WHATSAPP"),
  ]);
  assert.deepEqual(funnel.map((s) => [s.key, s.count]), [
    ["PROSPECTS", 7], ["CONTACTED", 4], ["REPLIED", 3], ["IN_TALKS_OR_WON", 2], ["WON", 1],
  ]);
  for (let i = 1; i < funnel.length; i++) assert.ok(funnel[i].count <= funnel[i - 1].count);
  assert.deepEqual(funnelAside, { closed: 1, unreachable: 1 });
});

test("sector rows use the same definitions and add up to the totals", () => {
  const rows = [
    p("ENVOYE", { sector: "Riads", lastSendAt: RECENT }), p("CONVERTI", { sector: "Riads" }),
    p("A_ENVOYER", { sector: "Spas" }), p("LOST", { sector: "  " }), p("REPONDU", { sector: null }),
  ];
  const { sectors, totals } = buildProspectingReport(rows);
  const riads = sectors.find((s) => s.sector === "Riads")!;
  assert.equal(riads.prospects, 2);
  assert.equal(riads.contacted, 2);
  assert.equal(riads.sendRecorded, 1);
  assert.equal(riads.replied, 1, "CONVERTI is won, and won counts as replied");
  assert.equal(riads.won, 1);
  assert.equal(riads.replyRate, 50);
  const blank = sectors.find((s) => s.sector === NO_SECTOR)!;
  assert.equal(blank.prospects, 2, "blank and null sectors are grouped");
  assert.equal(blank.closed, 1);
  assert.equal(blank.replied, 1);
  for (const key of ["prospects", "contacted", "replied", "won", "sendRecorded"] as const) {
    assert.equal(sectors.reduce((n, s) => n + s[key], 0), totals[key], key);
  }
  assert.deepEqual(sectors.map((s) => s.sector), ["(no sector)", "Riads", "Spas"], "by size, then name");
});

test("sector names are trimmed; blank becomes the no-sector label", () => {
  assert.equal(sectorName(" Spas "), "Spas");
  assert.equal(sectorName(""), NO_SECTOR);
  assert.equal(sectorName(null), NO_SECTOR);
});

// ─── Zero denominators ──────────────────────────────────────────

test("rates are null, never 0% or NaN, when nothing was contacted", () => {
  const empty = buildProspectingReport([]);
  assert.equal(empty.totals.contactedRate, null);
  assert.equal(empty.totals.replyRate, null);
  assert.equal(empty.totals.winRate, null);
  assert.equal(empty.totals.sendRecordedRate, null);
  assert.deepEqual(empty.sectors, []);
  assert.deepEqual(empty.stages, []);

  const notContacted = buildProspectingReport([p("A_ENVOYER")]);
  assert.equal(notContacted.totals.contactedRate, 0);
  assert.equal(notContacted.totals.replyRate, null);
  assert.equal(notContacted.sectors[0].winRate, null);
});

test("rate rounds to one decimal and formatRate shows a dash for null", () => {
  assert.equal(rate(1, 3), 33.3);
  assert.equal(rate(2, 3), 66.7);
  assert.equal(rate(0, 5), 0);
  assert.equal(rate(1, 0), null);
  assert.equal(rate(1, Number.NaN), null);
  assert.equal(formatRate(null), "—");
  assert.equal(formatRate(12.5), "12.5%");
});

// ─── Proposals and currencies ───────────────────────────────────

const pr = (status: string, amount: number | null, currency: string | null = "MAD"): ReportProposal => ({ status, amount, currency });

test("proposals are split into draft, sent, accepted and rejected", () => {
  const r = buildProposalReport([pr("DRAFT", 1000), pr("SENT", 2000), pr("ACCEPTED", 3000), pr("REJECTED", 4000), pr("ARCHIVED", 5)]);
  assert.deepEqual(r.counts, { draft: 1, sent: 1, accepted: 1, rejected: 1, other: 1, total: 5 });
  assert.equal(r.issued, 3);
  assert.equal(r.mad.draftValue, 1000);
  assert.equal(r.mad.openValue, 2000, "open value is sent only, not drafts");
  assert.equal(r.mad.acceptedValue, 3000);
  assert.equal(r.acceptanceRate, 50);
});

test("non-MAD proposals stay out of MAD totals and average, and are counted", () => {
  const r = buildProposalReport([
    pr("SENT", 1000), pr("SENT", 500, "EUR"), pr("ACCEPTED", 3000), pr("ACCEPTED", 900, "USD"),
    pr("REJECTED", 2000, " mad "), pr("DRAFT", 700, "EUR"), pr("SENT", 100, ""), pr("SENT", 100, null),
  ]);
  assert.equal(r.mad.openValue, 1000);
  assert.equal(r.mad.acceptedValue, 3000);
  assert.equal(r.mad.draftValue, 0);
  assert.equal(r.mad.averageIssued, 2000, "(1000 + 3000 + 2000) / 3");
  assert.equal(r.mad.averageBasis, 3);
  assert.equal(r.excludedNonMad, 5);
  assert.equal(r.counts.sent, 4, "excluded proposals still count by status");
});

test("averages exclude drafts and invalid amounts", () => {
  const r = buildProposalReport([pr("DRAFT", 99_000), pr("SENT", 1000), pr("SENT", 2001), pr("SENT", Number.NaN), pr("SENT", null)]);
  assert.equal(r.mad.averageIssued, 1501, "rounded mean of 1000 and 2001");
  assert.equal(r.mad.averageBasis, 2);
  assert.equal(r.excludedNonMad, 2);
});

test("no issued or decided proposals gives null average and acceptance rate", () => {
  const none = buildProposalReport([]);
  assert.equal(none.mad.averageIssued, null);
  assert.equal(none.acceptanceRate, null);
  const draftsOnly = buildProposalReport([pr("DRAFT", 500), pr("SENT", 10, "EUR")]);
  assert.equal(draftsOnly.mad.averageIssued, null);
  assert.equal(draftsOnly.acceptanceRate, null);
});

// ─── Wiring (static) ────────────────────────────────────────────

test("the analytics DAL only reads and hands rows to the pure builders", () => {
  const src = read("src/lib/dal/stats.ts");
  const fn = src.slice(src.indexOf("export async function getAnalyticsData"), src.indexOf("export async function getClients"));
  assert.match(fn, /buildProspectingReport\(/);
  assert.match(fn, /buildProposalReport\(/);
  assert.doesNotMatch(fn, /\.(create|update|upsert|delete)\w*\(/);
  assert.doesNotMatch(fn, /"REPONDU"|"CONVERTI"|"ENVOYE"/, "no hand-written status lists");
});

test("Prospecting report labels say what is counted", () => {
  const page = read("src/app/admin/analytics/page.tsx");
  assert.match(page, /Marked contacted/);
  assert.match(page, /Send recorded/);
  assert.match(page, /How these numbers are counted/);
  assert.doesNotMatch(page, /Messages Sent|Won Revenue|Pipeline Value/);
});

test("Business report funnel is all time and the KPI is not called a conversion rate", () => {
  const page = read("src/app/admin/command-center/page.tsx");
  assert.doesNotMatch(page, /last 90 days/);
  assert.match(page, /title="Meeting → Client funnel" subtitle="All time\."/);
  assert.doesNotMatch(page, /label="Conversion rate"/);
});

test("the old dashboard links to the Prospecting report instead of computing a reply rate", () => {
  const page = read("src/app/admin/overview/page.tsx");
  assert.doesNotMatch(page, /Reply rate:/);
  assert.match(page, /href="\/admin\/analytics"[^>]*>Prospecting report</);
});
