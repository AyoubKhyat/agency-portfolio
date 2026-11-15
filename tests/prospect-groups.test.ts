/**
 * Display groups, evidence labels and next-action labels. Display only, no database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONFIRMED_SEND_SINCE, DISPLAY_GROUPS, VISIBLE_GROUPS, countByDisplayGroup, displayGroupOf, displayGroupWhere,
  getVisibleSendEvidence, groupStatuses, nextActionFor, replyStateOf,
} from "../src/lib/prospect-groups";
import { STAGES } from "../src/lib/prospect-stages";
import { classifyProspect, type ProspectRow } from "../src/lib/next-action";

const TODAY = "2026-11-15";
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const row = (over: Partial<ProspectRow> = {}): ProspectRow => ({
  id: "p", name: "Demo", sector: "Riad", neighborhood: "", phone: "", instagram: "", status: "A_ENVOYER",
  whatsappLink: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED", qualityLabel: null, score: null,
  hasSentAt: false, followup1Done: false, followup2Done: false, followup3Done: false, createdDay: "2026-01-01",
  followUpDay: null, lastSendDay: null, lastSendChannel: null, replyReason: null, repliedDay: null,
  messageReplied: false, anyMessage: false, anySendActivity: false, replyWasReset: false, replyReviewed: false,
  followUpStopped: false, liveMeeting: false, hasProposal: false, ...over,
});
const g = (status: string, messageReplied = false) => displayGroupOf({ status, messageReplied });

// ─── Groups ──────────────────────────────────────────────────────────────

test("four visible groups, in order, plus a hidden Archived", () => {
  assert.deepEqual(VISIBLE_GROUPS.map((x) => x.label), ["New Leads", "Contacted", "Conversations", "Clients"]);
  assert.equal(DISPLAY_GROUPS.find((x) => x.key === "ARCHIVED")?.visible, false);
});

test("every stage belongs to exactly one group", () => {
  const used = DISPLAY_GROUPS.flatMap((x) => x.stages);
  assert.deepEqual([...used].sort(), STAGES.map((s) => s.key).sort());
  assert.equal(new Set(used).size, used.length);
});

test("stored statuses map to the approved groups", () => {
  assert.equal(g("A_ENVOYER"), "NEW_LEADS");
  assert.equal(g("ENVOYE"), "CONTACTED");
  for (const s of ["REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION"]) assert.equal(g(s), "CONVERSATIONS", s);
  for (const s of ["CLIENT", "CONVERTI"]) assert.equal(g(s), "CLIENTS", s);
  for (const s of ["PAS_DE_WHATSAPP", "LOST", "PERDU", "REFUSE"]) assert.equal(g(s), "ARCHIVED", s);
});

test("unknown or empty statuses are archived, never guessed", () => {
  assert.equal(g("SOMETHING_NEW"), "ARCHIVED");
  assert.equal(displayGroupOf({ status: null, messageReplied: false }), "ARCHIVED");
  assert.equal(g("SOMETHING_NEW", true), "ARCHIVED");
});

test("a recorded reply leaves Contacted for Conversations even if the status still says sent", () => {
  assert.equal(g("ENVOYE", true), "CONVERSATIONS");
  assert.equal(g("A_ENVOYER", true), "CONVERSATIONS");
});

test("a recorded reply never reopens a client, a closed lead or an unreachable one", () => {
  assert.equal(g("CLIENT", true), "CLIENTS");
  assert.equal(g("LOST", true), "ARCHIVED");
  // Regression: Unreachable stays Archived even with a recorded reply (approved 2026-11-15).
  assert.equal(g("PAS_DE_WHATSAPP", true), "ARCHIVED");
  assert.equal(g("PAS_DE_WHATSAPP", false), "ARCHIVED");
  assert.doesNotMatch(JSON.stringify(displayGroupWhere("CONVERSATIONS")), /PAS_DE_WHATSAPP/);
  assert.match(JSON.stringify(displayGroupWhere("ARCHIVED")), /PAS_DE_WHATSAPP/);
});

test("counts add up per group", () => {
  const c = countByDisplayGroup([
    { status: "A_ENVOYER", messageReplied: false, count: 3 },
    { status: "ENVOYE", messageReplied: false, count: 2 },
    { status: "ENVOYE", messageReplied: true, count: 1 },
    { status: "CLIENT", messageReplied: false },
    { status: "WEIRD", messageReplied: false },
  ]);
  assert.deepEqual(c, { NEW_LEADS: 3, CONTACTED: 2, CONVERSATIONS: 1, CLIENTS: 1, ARCHIVED: 1 });
});

test("group where-fragments use the same statuses and the reply rule", () => {
  assert.deepEqual(groupStatuses("CONVERSATIONS"), ["REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION"]);
  assert.deepEqual(displayGroupWhere("CONTACTED"), {
    AND: [{ status: { in: ["ENVOYE"] } }, { outreachMessages: { none: { replied: true } } }],
  });
  const archived = JSON.stringify(displayGroupWhere("ARCHIVED"));
  assert.match(archived, /"notIn"/);
  assert.match(archived, /PAS_DE_WHATSAPP/);
});

// ─── Evidence (stricter rule) ────────────────────────────────────────────

test("confirmed-send date matches the lead queue SQL", () => {
  assert.equal(CONFIRMED_SEND_SINCE.toISOString().slice(0, 10), "2026-08-20");
  assert.match(read("src/lib/lead-queue-sql.ts"), /sent_at >= timestamp '2026-08-20'/);
});

test("only an outreach message since 2026-08-20 is a confirmed send", () => {
  const base = { status: "ENVOYE", sentAt: "2026-07-01" };
  assert.equal(getVisibleSendEvidence({ ...base, lastMessageAt: "2026-08-20T00:00:00Z" }), "CONFIRMED");
  // Between the two cleanups: the older label would say "Send recorded"; the visible label does not.
  assert.equal(getVisibleSendEvidence({ ...base, lastMessageAt: "2026-07-15T00:00:00Z" }), "UNCONFIRMED");
  // A recent send-button click is not a confirmed send.
  assert.equal(getVisibleSendEvidence({ ...base, lastSendAt: "2026-11-01T00:00:00Z" }), "UNCONFIRMED");
  assert.equal(getVisibleSendEvidence({ status: "ENVOYE", sentAt: null }), "UNCONFIRMED");
  assert.equal(getVisibleSendEvidence({ status: "A_ENVOYER", sentAt: null }), "NOT_CONTACTED");
});

// ─── Replies ─────────────────────────────────────────────────────────────

test("confirmed replies and possible old replies are told apart", () => {
  assert.equal(replyStateOf(row({ status: "REPONDU" })), "CONFIRMED");
  assert.equal(replyStateOf(row({ status: "ENVOYE", messageReplied: true })), "CONFIRMED");
  assert.equal(replyStateOf(row({ status: "ENVOYE", replyWasReset: true })), "POSSIBLE_OLD");
  assert.equal(replyStateOf(row({ status: "ENVOYE", replyWasReset: true, replyReviewed: true })), "NONE");
  assert.equal(replyStateOf(row({ status: "ENVOYE" })), "NONE");
});

test("a possible old reply stays in Contacted and asks for a check, not a reply", () => {
  const p = row({ status: "ENVOYE", hasSentAt: true, replyWasReset: true });
  assert.equal(displayGroupOf(p), "CONTACTED");
  const a = nextActionFor(p, TODAY);
  assert.equal(a.key, "reply_review");
  assert.equal(a.label, "Check if they replied");
});

// ─── Next action ─────────────────────────────────────────────────────────

const sent = { status: "ENVOYE", hasSentAt: true, anyMessage: true, lastSendDay: "2026-11-01", lastSendChannel: "WHATSAPP" };

test("queue cases reuse the Leads Command Center rule", () => {
  const cases: [Partial<ProspectRow>, string, string][] = [
    [{ status: "REPONDU" }, "reply", "Reply to them"],
    [{ ...sent, followUpDay: "2026-11-10" }, "follow_up_overdue", "Follow up (1st)"],
    [{ ...sent, followUpDay: TODAY, followup1Done: true }, "follow_up_today", "Follow up (2nd)"],
    [{ ...sent }, "follow_up_decision", "Decide: follow up or stop"],
    [{ whatsappLink: "https://wa.me/212600000000", whatsappStatus: "VERIFIED" }, "ready", "Send first message"],
  ];
  for (const [over, key, label] of cases) {
    const p = row(over);
    assert.equal(classifyProspect(p, TODAY), key);
    const a = nextActionFor(p, TODAY);
    assert.equal(a.key, key);
    assert.equal(a.label, label);
    assert.equal(a.actionable, true);
  }
});

test("never contacted without a confirmed channel: confirm one first", () => {
  const a = nextActionFor(row({ phone: "0600000000" }), TODAY);
  assert.equal(a.key, "confirm_channel");
});

test("marked contacted but no confirmed send: check it, never a follow-up", () => {
  for (const over of [{ status: "ENVOYE", hasSentAt: true }, { status: "ENVOYE", anySendActivity: true, followUpDay: "2026-11-01" }]) {
    const a = nextActionFor(row(over), TODAY);
    assert.equal(a.key, "confirm_send");
    assert.doesNotMatch(a.label, /Follow up/);
  }
});

test("follow-up safety: a reply is never followed up", () => {
  const a = nextActionFor(row({ ...sent, messageReplied: true, followUpDay: "2026-11-10" }), TODAY);
  assert.equal(a.key, "reply");
  const no = nextActionFor(row({ ...sent, status: "REPONDU", replyReason: "NOT_INTERESTED", messageReplied: true }), TODAY);
  assert.equal(no.key, "reply_negative");
  assert.equal(no.actionable, false);
});

test("quiet states explain why there is nothing to do", () => {
  const cases: [Partial<ProspectRow>, string][] = [
    [{ status: "CLIENT" }, "client"],
    [{ status: "LOST" }, "closed"],
    [{ status: "MEETING" }, "in_talks"],
    [{ status: "ENVOYE", hasSentAt: true, hasProposal: true }, "in_talks"],
    [{ status: "PAS_DE_WHATSAPP" }, "unreachable"],
    [{ ...sent, followUpStopped: true }, "follow_ups_stopped"],
    [{ ...sent, followUpDay: "2026-11-20" }, "wait_until"],
    [{ ...sent, lastSendDay: "2026-11-14" }, "wait_for_reply"],
  ];
  for (const [over, key] of cases) assert.equal(nextActionFor(row(over), TODAY).key, key, key);
  assert.equal(nextActionFor(row({ ...sent, followUpDay: "2026-11-20" }), TODAY).label, "Wait until 20 Nov");
  assert.equal(nextActionFor(row({ status: "CLIENT" }), TODAY).actionable, false);
});

test("an unknown status asks for a check instead of guessing a step", () => {
  const a = nextActionFor(row({ ...sent, status: "SOMETHING_NEW", followUpDay: "2026-11-10" }), TODAY);
  assert.equal(a.key, "check_status");
});

test("every prospect gets exactly one non-empty action", () => {
  const statuses = [...STAGES.flatMap((s) => s.statuses), "UNKNOWN"];
  for (const status of statuses) {
    for (const extra of [{}, sent, { messageReplied: true }, { replyWasReset: true, hasSentAt: true }]) {
      const a = nextActionFor(row({ ...extra, status }), TODAY);
      assert.ok(a.label.length > 0 && a.hint.length > 0, `${status} ${JSON.stringify(extra)}`);
    }
  }
});
