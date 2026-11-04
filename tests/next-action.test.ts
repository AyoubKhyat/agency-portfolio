/**
 * Leads Command Center rules and the confirmed-send flow. No database. The cases
 * are anonymised shapes from the production audit of 2026-11-04.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDays, buildLeadQueue, channelsFor, classifyProspect, daysBetween, instagramUrl, isLandline, nextFollowUpStep,
  whatsappUrl, type EnquiryRow, type ProspectRow,
} from "../src/lib/next-action";
import { browserToday, recordConfirmedSend, type RequestFn } from "../src/lib/lead-actions";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const TODAY = "2026-11-04";

const row = (over: Partial<ProspectRow> = {}): ProspectRow => ({
  id: "p", name: "Demo", sector: "Riad", neighborhood: "", phone: "", instagram: "", status: "ENVOYE",
  whatsappLink: "", whatsappStatus: "UNVERIFIED", instagramStatus: "UNVERIFIED", qualityLabel: null, score: null,
  hasSentAt: true, followup1Done: false, followup2Done: false, followup3Done: false, createdDay: "2026-01-01",
  followUpDay: null, lastSendDay: null, lastSendChannel: null, replyReason: null, repliedDay: null,
  messageReplied: false, anyMessage: false, anySendActivity: false, replyWasReset: false, replyReviewed: false,
  followUpStopped: false, liveMeeting: false, hasProposal: false, ...over,
});
const enquiry = (over: Partial<EnquiryRow> = {}): EnquiryRow => ({
  id: "e", fullName: "Sara", email: "s@example.com", phone: null, subject: "Site", message: "Bonjour", createdDay: "2026-10-25", fromTeamEmail: false, ...over,
});
const sentAndConfirmed = { lastSendDay: "2026-11-01", lastSendChannel: "INSTAGRAM", anyMessage: true };

// ─── Audit cases ─────────────────────────────────────────────────────────

test("a date older than the latest confirmed send is never overdue", () => {
  const p = row({ ...sentAndConfirmed, followUpDay: "2026-06-12" }); // the audit's "145 days late"
  assert.equal(classifyProspect(p, TODAY), "follow_up_decision");
  const q = buildLeadQueue([p], [], TODAY);
  assert.doesNotMatch(q.items[0].detail, /overdue/i);
  assert.match(q.items[0].detail, /Sent 3 days ago on Instagram/);
});

test("a past date with no confirmed send is left out, and counted so the list stays honest", () => {
  const clickOnly = row({ followUpDay: "2026-07-01", anySendActivity: true });
  const legacy = row({ id: "b", followUpDay: "2026-01-01", anyMessage: true });
  const q = buildLeadQueue([clickOnly, legacy], [], TODAY);
  assert.equal(q.counts.all, 0);
  assert.equal(q.notes.hiddenOldDates, 2);
});

test("a date on or after the latest send is real: overdue, then due today, then scheduled", () => {
  const base = { ...sentAndConfirmed };
  assert.equal(classifyProspect(row({ ...base, followUpDay: "2026-11-02" }), TODAY), "follow_up_overdue");
  assert.equal(classifyProspect(row({ ...base, followUpDay: TODAY }), TODAY), "follow_up_today");
  assert.equal(classifyProspect(row({ ...base, followUpDay: "2026-11-09" }), TODAY), null);
  assert.equal(buildLeadQueue([row({ ...base, followUpDay: "2026-11-09" })], [], TODAY).notes.scheduled, 1);
});

test("a confirmed send with no date waits three days, then asks for a decision", () => {
  assert.equal(classifyProspect(row({ ...sentAndConfirmed, lastSendDay: "2026-11-02" }), TODAY), null);
  assert.equal(classifyProspect(row({ ...sentAndConfirmed, lastSendDay: "2026-11-01" }), TODAY), "follow_up_decision");
  assert.equal(buildLeadQueue([row({ ...sentAndConfirmed, lastSendDay: "2026-11-02" })], [], TODAY).notes.recentlySent, 1);
});

test("a reply reset by an old send button comes back for review, and can be dismissed", () => {
  const reset = row({ replyWasReset: true, followUpDay: "2026-06-01" });
  assert.equal(classifyProspect(reset, TODAY), "reply_review");
  assert.equal(classifyProspect({ ...reset, replyReviewed: true }, TODAY), null);
  assert.equal(classifyProspect({ ...reset, followUpDay: "2026-11-10" }, TODAY), null, "a future date is a decision");
});

test("no more follow-ups stays stopped, until a newer confirmed send", () => {
  const stopped = row({ ...sentAndConfirmed, followUpStopped: true });
  assert.equal(classifyProspect(stopped, TODAY), null);
  assert.equal(classifyProspect({ ...stopped, followUpStopped: false }, TODAY), "follow_up_decision");
  const q = buildLeadQueue([stopped], [], TODAY);
  assert.equal(q.counts.all, 0);
  assert.equal(q.notes.recentlySent, 0);
});

test("a landline or empty prospect is not ready, however good its label", () => {
  const landline = row({ status: "A_ENVOYER", hasSentAt: false, phone: "0524 000 000", qualityLabel: "HOT", score: 90 });
  assert.equal(classifyProspect(landline, TODAY), null);
  assert.equal(classifyProspect(row({ status: "A_ENVOYER", hasSentAt: false }), TODAY), null);
  assert.equal(buildLeadQueue([landline], [], TODAY).notes.toSendNoChannel, 1);
});

test("an unconfirmed channel does not make a prospect ready; a score or label never does", () => {
  const p = row({ status: "A_ENVOYER", hasSentAt: false, phone: "0612345678", qualityLabel: "HOT", score: 99 });
  assert.equal(classifyProspect(p, TODAY), null);
  assert.equal(classifyProspect({ ...p, whatsappStatus: "VERIFIED" }, TODAY), "ready");
});

test("a prospect with any send record is never ready, even at A_ENVOYER", () => {
  const p = row({ status: "A_ENVOYER", hasSentAt: false, phone: "0612345678", whatsappStatus: "VERIFIED" });
  assert.equal(classifyProspect({ ...p, anySendActivity: true }, TODAY), null);
  assert.equal(classifyProspect({ ...p, anyMessage: true }, TODAY), null);
});

// ─── Replies ─────────────────────────────────────────────────────────────

test("a reply counts from either signal, so one marked on a message is not missed", () => {
  assert.equal(classifyProspect(row({ status: "REPONDU" }), TODAY), "reply");
  assert.equal(classifyProspect(row({ messageReplied: true, repliedDay: "2026-11-03" }), TODAY), "reply");
});

test("a reply is not chased: it never appears as a follow-up", () => {
  const p = row({ ...sentAndConfirmed, messageReplied: true, followUpDay: "2026-11-02" });
  assert.equal(classifyProspect(p, TODAY), "reply");
  const q = buildLeadQueue([p], [], TODAY);
  assert.equal(q.counts.followUps, 0);
  assert.equal(q.items.length, 1);
});

test("handled replies leave the list: meeting, proposal, future callback, negative answer, closed", () => {
  const r = { status: "REPONDU" };
  assert.equal(classifyProspect(row({ ...r, liveMeeting: true }), TODAY), null);
  assert.equal(classifyProspect(row({ ...r, hasProposal: true }), TODAY), null);
  assert.equal(classifyProspect(row({ ...r, followUpDay: "2026-11-10" }), TODAY), null);
  for (const replyReason of ["NOT_INTERESTED", "HAS_PROVIDER", "TOO_EXPENSIVE", "NO_BUDGET"]) {
    assert.equal(classifyProspect(row({ messageReplied: true, replyReason }), TODAY), null, replyReason);
  }
  for (const status of ["CONVERTI", "CLIENT", "LOST", "PERDU", "REFUSE"]) {
    assert.equal(classifyProspect(row({ status, messageReplied: true }), TODAY), null, status);
  }
});

test("a reply with no recorded date says so instead of inventing one", () => {
  const q = buildLeadQueue([row({ status: "REPONDU" })], [], TODAY);
  assert.equal(q.items[0].why, "Marked as replied. Nothing is booked yet.");
  assert.equal(q.items[0].detail, "Replied");
});

test("PAS_DE_WHATSAPP is left alone", () => {
  assert.equal(classifyProspect(row({ ...sentAndConfirmed, status: "PAS_DE_WHATSAPP", followUpDay: TODAY }), TODAY), null);
});

// ─── Priority ────────────────────────────────────────────────────────────

test("priority order, and each person appears once at the highest", () => {
  const prospects = [
    row({ id: "ready", status: "A_ENVOYER", hasSentAt: false, instagram: "x", instagramStatus: "VERIFIED" }),
    row({ id: "decision", ...sentAndConfirmed }),
    row({ id: "today", ...sentAndConfirmed, followUpDay: TODAY }),
    row({ id: "overdue", ...sentAndConfirmed, followUpDay: "2026-11-02" }),
    row({ id: "review", replyWasReset: true }),
    row({ id: "reply", status: "REPONDU", ...sentAndConfirmed, followUpDay: "2026-11-02" }),
  ];
  const q = buildLeadQueue(prospects, [enquiry()], TODAY);
  assert.deepEqual(q.items.map((i) => i.id), ["reply", "e", "review", "overdue", "today", "decision", "ready"]);
  assert.equal(new Set(q.items.map((i) => i.key)).size, q.items.length);
  assert.deepEqual(q.counts, { all: 7, replies: 1, enquiries: 1, verify: 1, followUps: 3, ready: 1 });
});

test("warmest reply first; oldest overdue first; freshest undecided send first", () => {
  const replies = buildLeadQueue([
    row({ id: "unknown", status: "REPONDU" }),
    row({ id: "interested", messageReplied: true, replyReason: "INTERESTED" }),
    row({ id: "meeting", messageReplied: true, replyReason: "MEETING_REQUESTED" }),
  ], [], TODAY);
  assert.deepEqual(replies.items.map((i) => i.id), ["meeting", "interested", "unknown"]);

  const overdue = buildLeadQueue([
    row({ id: "recent", ...sentAndConfirmed, followUpDay: "2026-11-03" }),
    row({ id: "older", ...sentAndConfirmed, followUpDay: "2026-11-01" }),
  ], [], TODAY);
  assert.deepEqual(overdue.items.map((i) => i.id), ["older", "recent"]);

  const decisions = buildLeadQueue([
    row({ id: "cold", ...sentAndConfirmed, lastSendDay: "2026-08-20" }),
    row({ id: "warm", ...sentAndConfirmed, lastSendDay: "2026-11-01" }),
  ], [], TODAY);
  assert.deepEqual(decisions.items.map((i) => i.id), ["warm", "cold"]);
});

test("enquiries: oldest first, and a team email sinks to the end with a plain warning", () => {
  const q = buildLeadQueue([], [
    enquiry({ id: "team", createdDay: "2026-10-01", fromTeamEmail: true }),
    enquiry({ id: "new", createdDay: "2026-10-25" }),
    enquiry({ id: "old", createdDay: "2026-10-15" }),
  ], TODAY);
  assert.deepEqual(q.items.map((i) => i.id), ["old", "new", "team"]);
  assert.match(q.items[2].why, /may be a test/);
});

test("an empty database gives an empty queue, not an error", () => {
  const q = buildLeadQueue([], [], TODAY);
  assert.deepEqual(q.items, []);
  assert.equal(q.counts.all, 0);
});

// ─── Channels ────────────────────────────────────────────────────────────

test("a channel is trusted only if confirmed by hand or used by a confirmed send", () => {
  const p = row({ phone: "0612345678", instagram: "@demo" });
  assert.deepEqual(channelsFor(p).map((c) => c.trusted), [false, false]);
  assert.deepEqual(channelsFor({ ...p, whatsappStatus: "VERIFIED" }).find((c) => c.channel === "WHATSAPP")?.trusted, true);
  const used = channelsFor({ ...p, lastSendChannel: "INSTAGRAM" });
  assert.equal(used[0].channel, "INSTAGRAM", "the trusted channel comes first");
  assert.equal(used[0].trusted, true);
  assert.equal(used[1].trusted, false);
});

test("an unavailable channel is not offered", () => {
  assert.deepEqual(channelsFor(row({ phone: "0612345678", whatsappStatus: "UNAVAILABLE" })), []);
});

test("WhatsApp addresses: mobile yes, landline no, stored link wins", () => {
  assert.equal(whatsappUrl({ phone: "06 12 34 56 78" }), "https://wa.me/212612345678");
  assert.equal(whatsappUrl({ phone: "212612345678" }), "https://wa.me/212612345678");
  assert.equal(whatsappUrl({ phone: "0524000000" }), "");
  assert.equal(whatsappUrl({ phone: "" }), "");
  assert.equal(whatsappUrl({ whatsappLink: "https://wa.me/212600000000/?x=1", phone: "0524000000" }), "https://wa.me/212600000000");
  assert.equal(whatsappUrl({ phone: "0612345678" }, "Bonjour à vous"), "https://wa.me/212612345678?text=Bonjour%20%C3%A0%20vous");
  assert.equal(isLandline("+212 524 00 00 00"), true);
  assert.equal(instagramUrl("@demo"), "https://ig.me/m/demo");
  assert.equal(instagramUrl(""), "");
});

test("sequence steps and calendar days", () => {
  assert.equal(nextFollowUpStep({ followup1Done: false, followup2Done: false, followup3Done: false }), "followup1");
  assert.equal(nextFollowUpStep({ followup1Done: true, followup2Done: true, followup3Done: false }), "followup3");
  assert.equal(nextFollowUpStep({ followup1Done: true, followup2Done: true, followup3Done: true }), null);
  assert.equal(daysBetween("2026-10-31", "2026-11-04"), 4);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(browserToday(new Date(2026, 10, 4, 23, 59)), "2026-11-04");
});

// ─── Release review, 2026-11-04 ──────────────────────────────────────────

test("someone with a booked meeting or a proposal never asks for a follow-up decision", () => {
  const today = { ...sentAndConfirmed, lastSendDay: "2026-10-20" };
  for (const over of [{ status: "MEETING" }, { status: "PROPOSAL_SENT" }, { status: "NEGOTIATION" }, { liveMeeting: true }, { hasProposal: true }]) {
    assert.equal(classifyProspect(row({ ...today, ...over }), TODAY), null, JSON.stringify(over));
    assert.equal(classifyProspect(row({ ...today, ...over, followUpDay: "2026-10-30" }), TODAY), null, "no overdue either");
  }
  const q = buildLeadQueue([row({ ...today, status: "MEETING", followUpDay: "2026-01-01" })], [], TODAY);
  assert.equal(q.counts.all, 0);
  assert.deepEqual(q.notes, { hiddenOldDates: 0, toSendNoChannel: 0, scheduled: 0, recentlySent: 0 }, "nor is it listed as waiting for an answer");
});

test("a reset status is shown as a possible reply, never as a reply waiting for an answer", () => {
  const q = buildLeadQueue([row({ replyWasReset: true })], [], TODAY);
  const item = q.items[0];
  assert.equal(item.kind, "reply_review");
  assert.match(item.action, /Check if Demo replied/);
  assert.equal(item.detail, "Possible old reply, not confirmed");
  assert.equal(item.group, "verify", "never counted among replies");
  assert.match(item.why, /No reply text is saved/);
  const today = read("src/app/admin/page.tsx");
  assert.match(today, /const replyItems = queue\?\.items\.filter\(\(i\) => i\.kind === "reply"\)/, "Replies waiting for you counts recorded replies only");
});

test("a possible old reply waits behind a new enquiry", () => {
  const q = buildLeadQueue([row({ id: "old", replyWasReset: true })], [enquiry({ id: "new" })], TODAY);
  assert.deepEqual(q.items.map((i) => i.id), ["new", "old"]);
  assert.equal(q.counts.replies, 0);
  assert.equal(q.counts.verify, 1);
});

test("the send route cannot record one send twice", () => {
  // Proved against a real database by tests/integration/db_check.py. This keeps every caller on the protected path.
  const route = read("src/app/api/admin/prospecting/[id]/outreach/route.ts");
  assert.match(route, /createMessageOnce\(/);
  assert.doesNotMatch(route, /outreachMessage\.create/);
  const once = read("src/lib/record-send.ts");
  assert.match(once, /pg_advisory_xact_lock/, "the check and the write must not interleave");
  assert.match(once, /SAME_SEND_WINDOW_MS = 10 \* 60 \* 1000/);
  assert.match(read("src/app/api/admin/prospecting/[id]/route.ts"), /repeatSend/, "a repeat adds no second activity");
});

test("the failure message never claims nothing was saved", () => {
  // The first request can reach the database even when its answer is lost.
  assert.doesNotMatch(read("src/lib/lead-actions.ts"), /Nothing was saved/);
});

test("the floating confirm names the prospect and restarts for each one", () => {
  // Reusing the panel kept the first prospect's "Yes, sent", so one click could record the second.
  for (const page of ["src/app/admin/prospecting/page.tsx", "src/app/admin/saturation/page.tsx"]) {
    assert.match(read(page), /<SendConfirm\s+key=\{/, page);
    assert.match(read(page), /name=\{pendingSend\.name\}|name=\{pendingSend\.prospect\.name\}/, page);
  }
});

// ─── Confirmed sends ─────────────────────────────────────────────────────

function fakeRequest(failOn?: (url: string, body: Record<string, unknown>) => boolean, prospect: Record<string, unknown> = {}) {
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  const request: RequestFn = async (url, init) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, method: String(init.method), body });
    return { ok: !failOn?.(url, body), json: async () => prospect };
  };
  return { request, calls };
}
const base = "/api/admin/prospecting/p1";

test("first send: message, then status, then the automatic date in 3 days", async () => {
  const { request, calls } = fakeRequest();
  const r = await recordConfirmedSend(request, { kind: "first", prospectId: "p1", channel: "WHATSAPP", body: "Bonjour", today: TODAY });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(calls.map((c) => c.url), [`${base}/outreach`, base, base]);
  assert.deepEqual(calls[0].body, { channel: "WHATSAPP", body: "Bonjour", templateId: null });
  assert.deepEqual(calls[1].body, { status: "ENVOYE", actionType: "SENT_WHATSAPP" });
  assert.deepEqual(calls[2].body, { followUpDate: "2026-11-07" });
});

test("first send keeps a date someone already planned", async () => {
  // The WA and IG buttons on All prospects show on every row, not only on people never contacted.
  const { request, calls } = fakeRequest(undefined, { followUpDate: "2026-11-20T00:00:00.000Z" });
  const r = await recordConfirmedSend(request, { kind: "first", prospectId: "p1", channel: "WHATSAPP", today: TODAY });
  assert.deepEqual(r, { ok: true });
  assert.equal(calls.some((c) => "followUpDate" in c.body), false);
});

test("first send replaces a date in the past, because the send supersedes it", async () => {
  const { request, calls } = fakeRequest(undefined, { followUpDate: "2026-06-12T00:00:00.000Z" });
  await recordConfirmedSend(request, { kind: "first", prospectId: "p1", channel: "WHATSAPP", today: TODAY });
  assert.deepEqual(calls.at(-1)?.body, { followUpDate: "2026-11-07" });
});

test("a send to someone who already replied adds no date, so their reply stays in the queue", async () => {
  const { request, calls } = fakeRequest(undefined, { statusPreserved: true, followUpDate: null });
  const r = await recordConfirmedSend(request, { kind: "first", prospectId: "p1", channel: "INSTAGRAM", today: TODAY });
  assert.deepEqual(r, { ok: true });
  assert.equal(calls.some((c) => "followUpDate" in c.body), false);
});

test("follow-up: stamps the step and saves the chosen date", async () => {
  const { request, calls } = fakeRequest();
  await recordConfirmedSend(request, { kind: "follow_up", prospectId: "p1", channel: "INSTAGRAM", today: TODAY, step: "followup2", next: 7 });
  assert.deepEqual(calls.map((c) => c.url), [`${base}/outreach`, base, `${base}/sequence`, base]);
  assert.match(String(calls[0].body.body), /body not captured/, "unknown text is labelled, never invented");
  assert.equal(calls[1].body.actionType, "SENT_INSTAGRAM");
  assert.deepEqual(calls[2].body, { step: "followup2", done: true });
  assert.deepEqual(calls[3].body, { followUpDate: "2026-11-11" });
});

test("no more follow-ups clears the date and records the decision", async () => {
  const { request, calls } = fakeRequest();
  await recordConfirmedSend(request, { kind: "follow_up", prospectId: "p1", channel: "WHATSAPP", today: TODAY, step: null, next: "stop" });
  assert.deepEqual(calls.at(-1)?.body, { followUpDate: null, actionType: "NO_MORE_FOLLOW_UP" });
  assert.equal(calls.some((c) => c.url.endsWith("/sequence")), false);
});

test("if the message fails, nothing else is written", async () => {
  const { request, calls } = fakeRequest((url) => url.endsWith("/outreach"));
  const r = await recordConfirmedSend(request, { kind: "first", prospectId: "p1", channel: "WHATSAPP", today: TODAY });
  assert.deepEqual(r, { ok: false, recorded: false, error: "Couldn't confirm this was saved. Try again: it won't be recorded twice." });
  assert.equal(calls.length, 1);
});

test("if a later step fails, the caller is told the send IS recorded, so it isn't repeated", async () => {
  const { request } = fakeRequest((_url, body) => "followUpDate" in body);
  const r = await recordConfirmedSend(request, { kind: "first", prospectId: "p1", channel: "WHATSAPP", today: TODAY });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.recorded, true);
  assert.match(!r.ok ? r.error : "", /Send recorded/);
});

test("a network failure is a failure, not a crash", async () => {
  const r = await recordConfirmedSend(async () => { throw new Error("offline"); }, { kind: "first", prospectId: "p1", channel: "WHATSAPP", today: TODAY });
  assert.deepEqual(r, { ok: false, recorded: false, error: "Couldn't confirm this was saved. Try again: it won't be recorded twice." });
});

// ─── Guards ──────────────────────────────────────────────────────────────

test("the queue route is team-guarded, GET only, and the SQL cannot write", () => {
  const src = read("src/app/api/admin/lead-queue/route.ts");
  const body = src.slice(src.indexOf("export async function GET"));
  assert.match(body.split("\n").slice(1).find((l) => l.trim()) ?? "", /await requireTeam\(\)/);
  assert.doesNotMatch(src, /getSession\(/);
  assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/);

  const sql = read("src/lib/lead-queue-sql.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT)\b/i);
  assert.doesNotMatch(sql, /\$\{(?!day\(|column\})/, "the only interpolation is the day() helper");

  const dal = read("src/lib/dal.ts");
  const fn = dal.slice(dal.indexOf("export async function getLeadQueue"), dal.indexOf("export async function getAnalyticsData"));
  assert.doesNotMatch(fn, /\.(create|update|upsert|delete)\w*\(/);
});

test("no send is recorded on click: each path waits for the confirm step", () => {
  const prospects = read("src/app/admin/prospecting/page.tsx");
  assert.doesNotMatch(prospects, /markSent/);
  assert.doesNotMatch(prospects, /status: "ENVOYE", actionType/);
  assert.equal((prospects.match(/armSend\(\{ prospect: p/g) ?? []).length, 4);

  const saturation = read("src/app/admin/saturation/page.tsx");
  assert.doesNotMatch(saturation, /status: "ENVOYE"/);
  assert.match(saturation, /onClick=\{\(\) => onMarkSent\(p\.id, p\.name, "WHATSAPP"\)\}/);

  const card = read("src/components/admin/lead-queue/next-action-card.tsx");
  assert.doesNotMatch(card, /fetch\(/, "the card only reports clicks");
  const page = read("src/app/admin/lead-queue/page.tsx");
  assert.equal((page.match(/recordConfirmedSend\(/g) ?? []).length, 1);
  assert.match(page, /onConfirm=\{\(next\) => confirmSend\(/);
  assert.doesNotMatch(page, /SENT_WHATSAPP/, "this page can only record through recordConfirmedSend");
});

test("the command center files are not swallowed by the gitignored leads/ rule", () => {
  // Tailwind skips gitignored paths and Git never commits them, so a component in a folder
  // named "leads" loses its styles and goes missing from the commit, with no error.
  const page = read("src/app/admin/lead-queue/page.tsx");
  assert.doesNotMatch(page, /@\/components\/admin\/leads\//);
  assert.match(read(".gitignore"), /^leads\/$/m);
});

test("queue decisions are logged only for the two known types, and only without a status change", () => {
  const route = read("src/app/api/admin/prospecting/[id]/route.ts");
  assert.match(route, /!parsed\.data\.status && decision && \(QUEUE_ACTIVITY_TYPES as readonly string\[\]\)\.includes\(decision\)/);
});
