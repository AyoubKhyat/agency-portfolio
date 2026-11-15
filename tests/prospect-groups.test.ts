/**
 * Display groups, evidence labels and next-action labels. Display only, no database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONFIRMED_SEND_SINCE, DISPLAY_GROUPS, VISIBLE_GROUPS, countByDisplayGroup, displayGroupOf, displayGroupWhere,
  getVisibleSendEvidence, groupStatuses, nextActionFor, replyStateOf,
  CONFIRMED_SEND_WHERE, UNCONFIRMED_SEND_WHERE, describeProspect, visibleEvidenceWhere, withGroup,
  displayStageOf, isLegacyEvidenceParam, showsSendEvidence, LEGACY_EVIDENCE_LABELS,
} from "../src/lib/prospect-groups";
import { LEAD_QUEUE_PROSPECTS_SQL, PROSPECT_ROWS_BY_IDS_SQL } from "../src/lib/lead-queue-sql";
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

// ─── Phase 2: filters, counts and list rows agree ────────────────────────

/** A row as the Prisma filters see it. */
type Mem = { status: string; sector?: string; sentAt?: string | null; messages: { replied: boolean; sentAt: string }[]; sendActivity?: boolean };

/** Evaluates the subset of Prisma `where` the group and evidence filters use. Throws on anything else. */
function matches(w: unknown, r: Mem): boolean {
  if (w === undefined) return true;
  const o = w as Record<string, unknown>;
  return Object.entries(o).every(([k, v]) => {
    const val = v as Record<string, unknown>;
    switch (k) {
      case "AND": return (v as unknown[]).every((x) => matches(x, r));
      case "OR": return (v as unknown[]).some((x) => matches(x, r));
      case "NOT": return !matches(v, r);
      case "status":
        if (typeof v === "string") return r.status === v;
        if ("in" in val) return (val.in as string[]).includes(r.status);
        if ("notIn" in val) return !(val.notIn as string[]).includes(r.status);
        throw new Error("status op");
      case "sector": return r.sector === v;
      case "sentAt":
        if (val.not === null) return !!r.sentAt;
        throw new Error("sentAt op");
      case "outreachMessages": {
        const rel = (m: { replied: boolean; sentAt: string }, f: Record<string, unknown>) => Object.entries(f).every(([fk, fv]) => {
          if (fk === "replied") return m.replied === fv;
          if (fk === "sentAt") return new Date(m.sentAt) >= ((fv as { gte: Date }).gte);
          throw new Error(`message field ${fk}`);
        });
        if ("some" in val) return r.messages.some((m) => rel(m, val.some as Record<string, unknown>));
        if ("none" in val) return !r.messages.some((m) => rel(m, val.none as Record<string, unknown>));
        throw new Error("relation op");
      }
      case "activities": {
        const f = val.some as { actionType: { in: string[] } } | undefined;
        if (f && Object.keys(f).length === 1 && f.actionType) return !!r.sendActivity;
        throw new Error("activities op");
      }
      default: throw new Error(`unsupported where key ${k}`);
    }
  });
}

const ALL_STATUSES = [...STAGES.flatMap((s) => s.statuses), "SOMETHING_NEW"];
const memRows: Mem[] = ALL_STATUSES.flatMap((status) => [
  { status, messages: [] },
  { status, messages: [{ replied: false, sentAt: "2026-09-01" }] },
  { status, messages: [{ replied: true, sentAt: "2026-06-01" }] },
]);

test("each Prisma group filter selects exactly the rows displayGroupOf puts in that group", () => {
  for (const r of memRows) {
    const expected = displayGroupOf({ status: r.status, messageReplied: r.messages.some((m) => m.replied) });
    const hits = DISPLAY_GROUPS.filter((g) => matches(displayGroupWhere(g.key), r)).map((g) => g.key);
    assert.deepEqual(hits, [expected], `${r.status} replied=${r.messages.some((m) => m.replied)}`);
  }
});

test("tab counts equal what each tab lists, and add up to the unfiltered total", () => {
  const base = { sector: "Riad" };
  const rows = memRows.map((r, i) => ({ ...r, sector: i % 2 ? "Riad" : "Spa" }));
  const listed = (key: (typeof DISPLAY_GROUPS)[number]["key"]) => rows.filter((r) => matches(withGroup(base, key), r)).length;
  const counted = Object.fromEntries(DISPLAY_GROUPS.map((g) => [g.key, rows.filter((r) => matches(withGroup(base, g.key), r)).length]));
  for (const g of DISPLAY_GROUPS) assert.equal(counted[g.key], listed(g.key));
  const total = rows.filter((r) => matches(base, r)).length;
  assert.equal(Object.values(counted).reduce((a, b) => a + b, 0), total);
});

test("stricter evidence filters match the visible labels", () => {
  const cases: Mem[] = [
    { status: "ENVOYE", sentAt: "2026-07-01", messages: [{ replied: false, sentAt: "2026-09-01" }] },
    { status: "ENVOYE", sentAt: "2026-07-01", messages: [{ replied: false, sentAt: "2026-07-15" }] },
    { status: "ENVOYE", sentAt: null, messages: [], sendActivity: true },
    { status: "ENVOYE", sentAt: null, messages: [] },
    { status: "A_ENVOYER", sentAt: null, messages: [] },
  ];
  for (const r of cases) {
    const last = r.messages.at(-1)?.sentAt ?? null;
    const label = getVisibleSendEvidence({ status: r.status, sentAt: r.sentAt ?? null, lastMessageAt: last, lastSendAt: last ?? (r.sendActivity ? "2026-11-01" : null) });
    assert.equal(matches(CONFIRMED_SEND_WHERE, r), label === "CONFIRMED", JSON.stringify(r));
    assert.equal(matches(UNCONFIRMED_SEND_WHERE, r), label === "UNCONFIRMED", JSON.stringify(r));
  }
  assert.equal(visibleEvidenceWhere("confirmed"), CONFIRMED_SEND_WHERE);
  assert.equal(visibleEvidenceWhere("recorded"), undefined); // older values keep their old filter
});

test("a list row's summary is its group, next action and reply state", () => {
  const s = describeProspect(row({ status: "ENVOYE", hasSentAt: true, replyWasReset: true }), TODAY);
  assert.deepEqual([s.group, s.nextAction.key, s.replyState], ["CONTACTED", "reply_review", "POSSIBLE_OLD"]);
});

test("the by-ids SQL is the queue's row SELECT, scoped and parameterised", () => {
  const select = (sql: string) => sql.slice(sql.indexOf("SELECT\n"), sql.lastIndexOf("LEFT JOIN last_reply"));
  assert.equal(select(PROSPECT_ROWS_BY_IDS_SQL), select(LEAD_QUEUE_PROSPECTS_SQL));
  assert.match(PROSPECT_ROWS_BY_IDS_SQL, /WHERE p\.id = ANY\(\$1::text\[\]\)\s*$/);
  assert.equal((PROSPECT_ROWS_BY_IDS_SQL.match(/prospect_id = ANY\(\$1::text\[\]\)/g) ?? []).length, 2);
  assert.doesNotMatch(LEAD_QUEUE_PROSPECTS_SQL, /\$1/);
  assert.doesNotMatch(PROSPECT_ROWS_BY_IDS_SQL, /\b(INSERT|UPDATE|DELETE)\b/);
});

test("the list and its tab counts share withGroup; counts drop only a status= filter", () => {
  const src = read("src/lib/dal/prospects.ts");
  assert.match(src, /const listWhere = groupKey \? withGroup\(where, groupKey\) : where;/);
  assert.match(src, /count\(\{ where: withGroup\(countBase, g\.key\) \}\)/);
  assert.match(src, /if \(statusFilter && !isDueFilter\) delete countBase\.status;/);
});

test("old links keep working: status= and due= still filter, group= is optional", () => {
  const page = read("src/app/admin/prospecting/page.tsx");
  assert.match(page, /statusFilter === "ALL" && dueFilter === "ALL" && !legacyEvidence \? "NEW_LEADS" : null/);
  assert.match(page, /if \(status === "ALL" && due === "ALL" && group\) qs\.set\("group", group\);/);
  const nav = read("src/lib/admin-nav.ts");
  assert.match(nav, /\/admin\/prospecting\?status=MEETING,PROPOSAL_SENT,NEGOTIATION/);
});

// ─── Phase 2 UI fixes (2026-11-15) ───────────────────────────────────────

test("a recorded reply shows Replied, never a contradicting Waiting / To contact badge", () => {
  assert.equal(displayStageOf({ status: "ENVOYE", messageReplied: true })?.label, "Replied");
  assert.equal(displayStageOf({ status: "A_ENVOYER", messageReplied: true })?.label, "Replied");
  assert.equal(displayStageOf({ status: "ENVOYE", messageReplied: false })?.label, "Waiting for reply");
  // Badges that someone decided keep their own label.
  assert.equal(displayStageOf({ status: "PAS_DE_WHATSAPP", messageReplied: true })?.label, "Unreachable");
  assert.equal(displayStageOf({ status: "CLIENT", messageReplied: true })?.label, "Won");
  assert.equal(displayStageOf({ status: "MEETING", messageReplied: true })?.label, "In talks");
  assert.equal(displayStageOf({ status: "ODD", messageReplied: true }), null);
});

test("an archived Unreachable prospect with a reply is reviewed, never replied to", () => {
  const p = row({ status: "PAS_DE_WHATSAPP", hasSentAt: true, messageReplied: true, lastSendDay: "2026-10-01", lastSendChannel: "INSTAGRAM", instagram: "x", instagramStatus: "VERIFIED" });
  assert.equal(displayGroupOf(p), "ARCHIVED");
  assert.equal(classifyProspect(p, TODAY), "reply"); // the lead queue's own rule is unchanged
  const a = nextActionFor(p, TODAY);
  assert.equal(a.key, "review_archived");
  assert.equal(a.label, "Review archived prospect");
  assert.doesNotMatch(a.label, /reply/i);
  for (const st of ["PAS_DE_WHATSAPP"]) {
    for (const extra of [{ messageReplied: true }, { status: st, replyReason: "INTERESTED", messageReplied: true }]) {
      assert.doesNotMatch(nextActionFor(row({ status: st, ...extra }), TODAY).label, /^Reply/);
    }
  }
});

test("send-evidence badges are left out only for Clients", () => {
  assert.equal(showsSendEvidence("CLIENTS"), false);
  for (const g of ["NEW_LEADS", "CONTACTED", "CONVERSATIONS", "ARCHIVED", null, undefined] as const) assert.equal(showsSendEvidence(g), true);
});

test("older evidence= values are recognised as global legacy filters; the new ones are not", () => {
  for (const v of ["recorded", "legacy", "none", "unbacked"]) assert.ok(isLegacyEvidenceParam(v) && LEGACY_EVIDENCE_LABELS[v], v);
  for (const v of ["confirmed", "unconfirmed", "ALL", "", null, "toString"]) assert.equal(isLegacyEvidenceParam(v), false, String(v));
});

test("list page: legacy evidence links open with no group; normal visits and search stay in a tab", () => {
  const page = read("src/app/admin/prospecting/page.tsx");
  assert.match(page, /statusFilter === "ALL" && dueFilter === "ALL" && !legacyEvidence \? "NEW_LEADS" : null/);
  assert.match(page, /Outreach: \{LEGACY_EVIDENCE_LABELS\[evidenceFilter\]\}/);
  assert.match(page, /if \(groupFilter\) qs\.set\("group", groupFilter\);/); // search is sent with the open tab
});

test("list page: mobile tab grid, labelled score only, Clients without send badges, menu in its own row", () => {
  const page = read("src/app/admin/prospecting/page.tsx");
  assert.match(page, /className="grid grid-cols-2 [^"]*sm:flex/);
  assert.match(page, /p\.score != null && !!p\.scoreLabel && <ScoreBadge/);
  assert.match(page, /showsSendEvidence\(prospect\.summary\?\.group\) && <SendChip/);
  assert.match(page, /<td colSpan=\{4\}[^>]*>\{renderMenuItems\(p, "row"\)\}<\/td>/);
  assert.match(page, /id=\{`actions-\$\{where\}-\$\{p\.id\}`\}/); // card and table copies never share an id
  assert.doesNotMatch(page, /<details>\s*<summary title="More actions"/);
  // Send-confirm safeguards unchanged: four armed sends, nothing recorded on click.
  assert.equal((page.match(/armSend\(\{ prospect: p/g) ?? []).length, 4);
  assert.match(page, /<SendConfirm/);
});
