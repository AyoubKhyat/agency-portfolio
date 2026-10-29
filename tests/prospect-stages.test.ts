/**
 * CRM simplification, Phase 1 — simple stages are a display layer over the
 * stored statuses; "channel verified" and "send recorded" are two separate
 * facts and neither implies the other; send records from before the
 * 2026-07-07 cleanup are kept but never treated as current evidence. No database: the Today route and nav
 * are checked statically (guard first, read-only queries, no enquiry
 * filtering, every existing tool still in the sidebar).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STAGES, getStage, stageLabel, statusWhere, parseStatusList, stageForStatusParam,
  stageStatusParam, countByStage, isContacted, hasVerifiedChannel, getChannelState, getSendEvidence,
  channelWhere, evidenceWhere, VERIFIED_CHANNEL_WHERE, UNVERIFIED_CHANNEL_WHERE,
  RECORDED_SEND_WHERE, LEGACY_SEND_WHERE, NO_RECORDED_SEND_WHERE, NOT_CURRENT_SEND_WHERE, ANY_SEND_WHERE,
  SEND_ACTION_TYPES, CHANNEL_LABELS, SEND_LABELS, OUTREACH_EVIDENCE_SINCE, latestSendAt,
} from "../src/lib/prospect-stages";
import { POST_REPLY_STATUSES } from "../src/lib/prospect-status-guard";
import { FOLLOW_UP_EXCLUDED_STATUSES } from "../src/lib/follow-up";

/** Every status the Prospects page offers, plus legacy spellings still in data. */
const KNOWN_STATUSES = [
  "A_ENVOYER", "ENVOYE", "REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION",
  "PAS_DE_WHATSAPP", "CLIENT", "CONVERTI", "LOST", "PERDU", "REFUSE",
];

test("every known stored status belongs to exactly one stage", () => {
  for (const status of KNOWN_STATUSES) {
    const owners = STAGES.filter((s) => s.statuses.includes(status));
    assert.equal(owners.length, 1, `${status} is in ${owners.length} stages`);
  }
  const all = STAGES.flatMap((s) => s.statuses);
  assert.equal(new Set(all).size, all.length, "stages overlap");
});

test("stages agree with the existing pipeline guards", () => {
  for (const s of POST_REPLY_STATUSES) {
    assert.ok(["REPLIED", "IN_TALKS", "WON", "CLOSED"].includes(getStage(s)!.key), `${s} is post-reply`);
  }
  for (const s of FOLLOW_UP_EXCLUDED_STATUSES) {
    assert.ok(!["TO_CONTACT", "WAITING"].includes(getStage(s)!.key), `${s} must not look followable`);
  }
});

test("unknown statuses are never guessed into a stage", () => {
  assert.equal(getStage("SOMETHING_NEW"), null);
  assert.equal(stageLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(stageLabel(null), "—");
  assert.equal(stageLabel("ENVOYE"), "Waiting for reply");
});

test("status filter: one value stays an exact match, a stage becomes IN", () => {
  assert.equal(statusWhere(undefined), undefined);
  assert.equal(statusWhere("ALL"), undefined);
  assert.equal(statusWhere(""), undefined);
  assert.equal(statusWhere("A_ENVOYER"), "A_ENVOYER"); // existing links unchanged
  assert.deepEqual(statusWhere("MEETING,PROPOSAL_SENT,NEGOTIATION"), { in: ["MEETING", "PROPOSAL_SENT", "NEGOTIATION"] });
  assert.deepEqual(parseStatusList(" LOST, LOST ,PERDU,"), ["LOST", "PERDU"]);
});

test("a status param selects a stage only on an exact, order-free match", () => {
  const inTalks = STAGES.find((s) => s.key === "IN_TALKS")!;
  assert.equal(stageForStatusParam(stageStatusParam(inTalks))?.key, "IN_TALKS");
  assert.equal(stageForStatusParam("NEGOTIATION,MEETING,PROPOSAL_SENT")?.key, "IN_TALKS");
  assert.equal(stageForStatusParam("MEETING"), null); // part of a stage is a detailed filter
  assert.equal(stageForStatusParam("REPONDU")?.key, "REPLIED");
  assert.equal(stageForStatusParam("ALL"), null);
});

test("countByStage sums stored statuses and keeps unknowns separate", () => {
  const c = countByStage([
    { status: "A_ENVOYER", count: 10 }, { status: "MEETING", count: 2 }, { status: "NEGOTIATION", count: 1 },
    { status: "CONVERTI", count: 1 }, { status: "CLIENT", count: 2 }, { status: "PERDU", count: 4 },
    { status: "WEIRD", count: 3 },
  ]);
  assert.equal(c.TO_CONTACT, 10);
  assert.equal(c.IN_TALKS, 3);
  assert.equal(c.WON, 3);
  assert.equal(c.CLOSED, 4);
  assert.equal(c.other, 3);
  assert.equal(c.WAITING, 0);
});

test("channel state depends only on hand-confirmed channels", () => {
  assert.equal(getChannelState({ whatsappStatus: "VERIFIED", instagramStatus: "UNVERIFIED" }), "VERIFIED");
  assert.equal(getChannelState({ whatsappStatus: "UNVERIFIED", instagramStatus: "VERIFIED" }), "VERIFIED");
  // UNAVAILABLE is known-bad, never verified.
  assert.equal(hasVerifiedChannel({ whatsappStatus: "UNAVAILABLE", instagramStatus: "UNAVAILABLE" }), false);
  assert.equal(hasVerifiedChannel({ whatsappStatus: null, instagramStatus: undefined }), false);
});

const AFTER_CLEANUP = "2026-09-12T10:00:00Z";
const BEFORE_CLEANUP = "2026-06-02T10:00:00Z";

test("a verified channel never counts as a recorded send", () => {
  const verifiedNoRecord = { status: "ENVOYE", sentAt: "2026-05-29T10:00:00Z", whatsappStatus: "VERIFIED", lastSendAt: null };
  assert.equal(getChannelState(verifiedNoRecord), "VERIFIED");
  assert.equal(getSendEvidence(verifiedNoRecord), "NOT_RECORDED");
  // ...and a recorded send never makes the channel verified.
  const recordedUnverified = { status: "ENVOYE", sentAt: null, whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED", lastSendAt: AFTER_CLEANUP };
  assert.equal(getSendEvidence(recordedUnverified), "RECORDED");
  assert.equal(getChannelState(recordedUnverified), "UNVERIFIED");
  // Labels keep the two apart in wording too.
  assert.doesNotMatch(CHANNEL_LABELS.VERIFIED.label, /sent|send|outreach/i);
  assert.match(CHANNEL_LABELS.VERIFIED.title, /does not mean a message was sent/);
  assert.match(SEND_LABELS.RECORDED.title, /not confirmed/);
});

test("send evidence: status alone is not a send record", () => {
  assert.equal(getSendEvidence({ status: "A_ENVOYER", sentAt: null, lastSendAt: null }), "NOT_CONTACTED");
  assert.equal(getSendEvidence({ status: "PAS_DE_WHATSAPP", sentAt: null }), "NOT_CONTACTED");
  assert.equal(getSendEvidence({ status: "ENVOYE", sentAt: null, lastSendAt: null }), "NOT_RECORDED"); // bulk/import
  assert.equal(getSendEvidence({ status: "REPONDU", sentAt: null }), "NOT_RECORDED");
  assert.equal(getSendEvidence({ status: "A_ENVOYER", sentAt: null, lastSendAt: AFTER_CLEANUP }), "RECORDED");
  assert.ok(isContacted({ status: "PAS_DE_WHATSAPP", sentAt: new Date() }));
  assert.ok(isContacted({ status: "A_ENVOYER", sentAt: null, lastSendAt: BEFORE_CLEANUP }));
});

test("send records from before the 2026-07-07 cleanup are legacy, not evidence", () => {
  assert.equal(OUTREACH_EVIDENCE_SINCE.toISOString(), "2026-07-07T00:00:00.000Z");
  assert.equal(getSendEvidence({ status: "ENVOYE", sentAt: BEFORE_CLEANUP, lastSendAt: BEFORE_CLEANUP }), "LEGACY");
  assert.equal(getSendEvidence({ status: "ENVOYE", sentAt: null, lastSendAt: "2026-07-06T23:59:59Z" }), "LEGACY");
  assert.equal(getSendEvidence({ status: "ENVOYE", sentAt: null, lastSendAt: "2026-07-07T00:00:00Z" }), "RECORDED");
  // The latest record decides: a fresh send on an old prospect is current evidence.
  assert.equal(latestSendAt([BEFORE_CLEANUP, null, AFTER_CLEANUP, undefined])?.toISOString(), new Date(AFTER_CLEANUP).toISOString());
  assert.equal(latestSendAt([null, undefined]), null);
  assert.match(SEND_LABELS.LEGACY.title, /no evidence the message arrived/);
});

test("send records come only from send buttons and saved messages, never FOLLOW_UP", () => {
  // The Reply Inbox logs FOLLOW_UP when it merely schedules a date.
  assert.deepEqual([...SEND_ACTION_TYPES], ["SENT_WHATSAPP", "SENT_INSTAGRAM"]);
  const json = JSON.stringify([ANY_SEND_WHERE, RECORDED_SEND_WHERE, LEGACY_SEND_WHERE, NO_RECORDED_SEND_WHERE]);
  assert.doesNotMatch(json, /FOLLOW_UP|STATUS_|whatsappStatus|instagramStatus/); // channel state is never evidence
  assert.match(json, /outreachMessages/);
  // Current evidence is date-bounded on both record kinds.
  const recorded = JSON.stringify(RECORDED_SEND_WHERE);
  assert.equal((recorded.match(/"gte":"2026-07-07T00:00:00.000Z"/g) ?? []).length, 2);
});

test("channel and evidence filters map only their known values", () => {
  assert.equal(channelWhere("verified"), VERIFIED_CHANNEL_WHERE);
  assert.equal(channelWhere("unverified"), UNVERIFIED_CHANNEL_WHERE);
  assert.equal(channelWhere("ALL"), undefined);
  assert.equal(channelWhere("anything"), undefined);
  assert.equal(evidenceWhere("recorded"), RECORDED_SEND_WHERE);
  assert.equal(evidenceWhere("legacy"), LEGACY_SEND_WHERE);
  assert.equal(evidenceWhere("none"), NO_RECORDED_SEND_WHERE);
  assert.equal(evidenceWhere("unbacked"), NOT_CURRENT_SEND_WHERE);
  assert.equal(evidenceWhere("verified"), undefined);
  assert.equal(evidenceWhere(undefined), undefined);
});

// ─── static checks ──────────────────────────────────────────────

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("Today route: team guard first, no bare session check", () => {
  const src = read("src/app/api/admin/today/route.ts");
  const body = src.slice(src.indexOf("export async function GET"));
  const first = body.split("\n").slice(1).find((l) => l.trim() && !l.trim().startsWith("//"));
  assert.match(first ?? "", /await requireTeam\(\)/);
  assert.doesNotMatch(src, /getSession\(/);
  assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/);
});

test("Today summary is read-only and does not filter enquiries", () => {
  const dal = read("src/lib/dal/stats.ts");
  const start = dal.indexOf("export async function getTodaySummary");
  assert.ok(start > 0, "getTodaySummary not found");
  const fn = dal.slice(start, dal.indexOf("\nexport ", start + 1));
  assert.doesNotMatch(fn, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|\$executeRaw|\$queryRaw)\b/);
  // Every lead query selects NEW enquiries only — no attempt to guess test rows.
  const leadWheres = [...fn.matchAll(/db\(\)\.lead\.\w+\(\{ where: (\{[^}]*\})/g)].map((m) => m[1]);
  // Two NEW queries drive the action count; one TEST count only reports hand-marked tests.
  assert.deepEqual(leadWheres, ['{ status: "NEW" }', '{ status: "NEW" }', "{ status: LEAD_TEST_STATUS }"]);
  // Follow-ups are split by send evidence; channel state is never used as evidence.
  assert.match(fn, /recorded: \{ dueToday: dueTodayRecorded, overdue: overdueRecorded \}/);
  assert.match(fn, /unbacked: \{ dueToday: dueToday - dueTodayRecorded, overdue: overdue - overdueRecorded, legacy: dueLegacy \}/);
  assert.equal((fn.match(/status: activeStatus, \.\.\.RECORDED_SEND_WHERE/g) ?? []).length, 3);
  assert.doesNotMatch(fn.slice(fn.indexOf("followUps: {")), /VERIFIED_CHANNEL_WHERE[^\n]*followUp/);
});

test("sidebar: six main entries, a visible secondary section, nothing dropped", () => {
  const src = read("src/app/admin/layout.tsx");
  const labelsIn = (from: string, to: string) =>
    [...src.slice(src.indexOf(from), src.indexOf(to)).matchAll(/label: "([^"]+)", icon/g)].map((m) => m[1]);

  const main = [...labelsIn("const SECTIONS", "const SECONDARY_SECTION"), ...labelsIn("const BOTTOM_NAV", "const HIDDEN_BOTTOM_NAV")];
  assert.deepEqual(main, ["Today", "Prospects", "Find New", "Clients", "Website Portfolio", "Settings"]);

  const secondary = labelsIn("const SECONDARY_SECTION", "const HIDDEN_SECTIONS");
  for (const l of ["Website Enquiries", "Documents", "Meetings", "Tasks", "Reply Inbox"]) {
    assert.ok(secondary.includes(l), `${l} missing from the secondary section`);
  }
  // In Focus Mode the secondary section and the folded "All other tools" group are both rendered.
  assert.match(src, /FOCUS_MODE\s*\?\s*\[\.\.\.SECTIONS, SECONDARY_SECTION, OTHER_TOOLS_SECTION\]/);
  assert.match(src, /items: \[\.\.\.HIDDEN_SECTIONS\.flatMap\(\(s\) => s\.items\), \.\.\.HIDDEN_BOTTOM_NAV\]/);

  // Every page the sidebar linked before Phase 1 is still linked.
  const BEFORE = [
    "/admin", "/admin/prospecting", "/admin/discovery", "/admin/clients", "/admin/projects", "/admin/documents",
    "/admin/command-center", "/admin/outreach", "/admin/inbox", "/admin/leads", "/admin/sales-playbook",
    "/admin/tasks", "/admin/notifications", "/admin/activity", "/admin/meetings", "/admin/pipeline",
    "/admin/contracts", "/admin/invoices", "/admin/revenue", "/admin/analytics", "/admin/marrakech-audit",
    "/admin/city-comparison", "/admin/saturation", "/admin/data-audit", "/admin/prospect-discovery",
    "/admin/settings", "/admin/system-status", "/admin/webhooks",
  ];
  for (const href of [...BEFORE, "/admin/overview"]) {
    assert.ok(src.includes(`href: "${href}"`), `${href} dropped from navigation`);
  }
});
