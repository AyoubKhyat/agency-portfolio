/**
 * Beginner-friendly display groups and next-action labels for prospects.
 *
 * DISPLAY ONLY. Nothing here writes a status, a date or an activity. The stored
 * `Prospect.status` values, the stages in prospect-stages.ts and the Leads
 * Command Center rules in next-action.ts stay the source of truth; this module
 * only names them in everyday language:
 *
 *   New Leads      To contact
 *   Contacted      Waiting for reply, unless a reply is recorded
 *   Conversations  Replied, In talks, or a recorded reply
 *   Clients        Won
 *   Archived       Unreachable, Closed, and statuses we don't know
 *
 * Evidence rules reused, never loosened:
 *  - A RECORDED reply is `status = REPONDU` or an outreach message marked
 *    replied (the same two signals follow-up.ts and next-action.ts trust).
 *  - A POSSIBLE OLD reply (an old send button reset REPONDU to ENVOYE, nobody
 *    has reviewed it) is not a reply: it stays in Contacted and asks for a check.
 *  - A send counts as CONFIRMED only from an outreach message on or after
 *    CONFIRMED_SEND_SINCE (2026-08-20, the "did you actually send it?" step),
 *    the stricter rule the lead queue SQL uses. Older rows and send-button
 *    activities only show that a button was pressed.
 *
 * Pure and DB-free so it can be regression-tested directly.
 */
import { CONTACTED_WHERE, STAGES, getStage, isContacted, type StageKey } from "@/lib/prospect-stages";
import { classifyProspect, isClosed, nextFollowUpStep, type ProspectRow, type QueueKind } from "@/lib/next-action";

// ─── Display groups ──────────────────────────────────────────────────────

export type DisplayGroupKey = "NEW_LEADS" | "CONTACTED" | "CONVERSATIONS" | "CLIENTS" | "ARCHIVED";

export type DisplayGroup = {
  key: DisplayGroupKey;
  label: string;
  hint: string;
  /** Stages this group starts from (before the recorded-reply rule). */
  stages: readonly StageKey[];
  /** False for Archived: reachable from a quiet link, not one of the four tabs. */
  visible: boolean;
};

export const DISPLAY_GROUPS: readonly DisplayGroup[] = [
  { key: "NEW_LEADS",     label: "New Leads",     hint: "Not contacted yet",                         stages: ["TO_CONTACT"],          visible: true },
  { key: "CONTACTED",     label: "Contacted",     hint: "Message sent, waiting for a reply",         stages: ["WAITING"],             visible: true },
  { key: "CONVERSATIONS", label: "Conversations", hint: "They replied, or you're talking",           stages: ["REPLIED", "IN_TALKS"], visible: true },
  { key: "CLIENTS",       label: "Clients",       hint: "Became a client",                           stages: ["WON"],                 visible: true },
  { key: "ARCHIVED",      label: "Archived",      hint: "Unreachable, closed, or an unknown status", stages: ["UNREACHABLE", "CLOSED"], visible: false },
];

export const VISIBLE_GROUPS: readonly DisplayGroup[] = DISPLAY_GROUPS.filter((g) => g.visible);

export function getDisplayGroupByKey(key: string | null | undefined): DisplayGroup | null {
  return DISPLAY_GROUPS.find((g) => g.key === key) ?? null;
}

const group = (key: DisplayGroupKey) => DISPLAY_GROUPS.find((g) => g.key === key)!;

/** prospect-stages.ts owns the status lists; this only indexes them by stage. */
const STAGE_STATUSES = Object.fromEntries(STAGES.map((s) => [s.key, s.statuses])) as Record<StageKey, readonly string[]>;

/** Stored statuses of the stages a group starts from. */
export function groupStatuses(key: DisplayGroupKey): string[] {
  return [...new Set(group(key).stages.flatMap((s) => STAGE_STATUSES[s]))];
}

export type GroupInput = {
  status: string | null | undefined;
  /** An outreach message for this prospect is marked replied. */
  messageReplied: boolean;
};

/** Status REPONDU or a reply on an outreach message. Either is enough; neither is guessed. */
export function hasRecordedReply(p: GroupInput): boolean {
  return p.status === "REPONDU" || p.messageReplied;
}

/**
 * The one display group a prospect belongs to.
 * A recorded reply lifts New Leads and Contacted into Conversations (the lead
 * queue already treats it as a reply waiting for an answer). Clients, Closed and
 * Unreachable keep their group even with a recorded reply: someone decided those. Unknown statuses are
 * Archived and shown with their raw value, never guessed into a group.
 */
export function displayGroupOf(p: GroupInput): DisplayGroupKey {
  const stage = getStage(p.status);
  if (!stage) return "ARCHIVED";
  if (stage.key === "WON") return "CLIENTS";
  if (stage.key === "CLOSED" || stage.key === "UNREACHABLE") return "ARCHIVED";
  if (stage.key === "REPLIED" || stage.key === "IN_TALKS" || hasRecordedReply(p)) return "CONVERSATIONS";
  return stage.key === "TO_CONTACT" ? "NEW_LEADS" : "CONTACTED";
}

/** Sum rows into group counts. */
export function countByDisplayGroup(rows: (GroupInput & { count?: number })[]): Record<DisplayGroupKey, number> {
  const out: Record<DisplayGroupKey, number> = { NEW_LEADS: 0, CONTACTED: 0, CONVERSATIONS: 0, CLIENTS: 0, ARCHIVED: 0 };
  for (const r of rows) out[displayGroupOf(r)] += r.count ?? 1;
  return out;
}

/**
 * Prisma `where` for a group, matching displayGroupOf exactly. Read filters only.
 * The recorded-reply rule needs `outreachMessages.some({ replied: true })`.
 */
export function displayGroupWhere(key: DisplayGroupKey) {
  const replied = { outreachMessages: { some: { replied: true } } };
  const notReplied = { outreachMessages: { none: { replied: true } } };
  const known = STAGES.flatMap((s) => s.statuses);
  switch (key) {
    case "NEW_LEADS":
      return { AND: [{ status: { in: groupStatuses("NEW_LEADS") } }, notReplied] };
    case "CONTACTED":
      return { AND: [{ status: { in: groupStatuses("CONTACTED") } }, notReplied] };
    case "CONVERSATIONS":
      return {
        OR: [
          { status: { in: groupStatuses("CONVERSATIONS") } },
          { AND: [{ status: { in: [...STAGE_STATUSES.TO_CONTACT, ...STAGE_STATUSES.WAITING] } }, replied] },
        ],
      };
    case "CLIENTS":
      return { status: { in: groupStatuses("CLIENTS") } };
    case "ARCHIVED":
      return {
        OR: [
          { status: { in: [...STAGE_STATUSES.CLOSED, ...STAGE_STATUSES.UNREACHABLE] } },
          { status: { notIn: known } },
        ],
      };
  }
}

/**
 * A list filter narrowed to one group. The list and its tab counts both go
 * through this, so a tab's count is the number of rows that tab shows.
 */
export function withGroup<T extends object>(base: T, key: DisplayGroupKey): { AND: object[] } {
  return { AND: [base, displayGroupWhere(key)] };
}

// ─── Evidence labels (stricter rule) ─────────────────────────────────────

/** Only outreach messages from this day on count as a confirmed send. Same date as lead-queue-sql.ts. */
export const CONFIRMED_SEND_SINCE = new Date("2026-08-20T00:00:00Z");

export type VisibleSendEvidence = "NOT_CONTACTED" | "CONFIRMED" | "UNCONFIRMED";

export type SendEvidenceInput = {
  status: string;
  sentAt: Date | string | null;
  /** Latest send record of any kind (message or send-button activity), any date. */
  lastSendAt?: Date | string | null;
  /** Latest outreach message sentAt, any date. Only this can confirm a send. */
  lastMessageAt?: Date | string | null;
};

export function getVisibleSendEvidence(p: SendEvidenceInput): VisibleSendEvidence {
  if (p.lastMessageAt && new Date(p.lastMessageAt).getTime() >= CONFIRMED_SEND_SINCE.getTime()) return "CONFIRMED";
  const contacted = isContacted({ status: p.status, sentAt: p.sentAt, lastSendAt: p.lastSendAt ?? p.lastMessageAt ?? null });
  return contacted ? "UNCONFIRMED" : "NOT_CONTACTED";
}

/** A confirmed send: an outreach message on or after CONFIRMED_SEND_SINCE. */
export const CONFIRMED_SEND_WHERE = { outreachMessages: { some: { sentAt: { gte: CONFIRMED_SEND_SINCE } } } };
/** Marked as contacted by any signal, with no confirmed send. */
export const UNCONFIRMED_SEND_WHERE = { AND: [CONTACTED_WHERE, { NOT: CONFIRMED_SEND_WHERE }] };

/** `evidence` values for the stricter labels; undefined for anything else (older values keep their meaning). */
export function visibleEvidenceWhere(param: string | null | undefined) {
  if (param === "confirmed") return CONFIRMED_SEND_WHERE;
  if (param === "unconfirmed") return UNCONFIRMED_SEND_WHERE;
  return undefined;
}

export const VISIBLE_SEND_LABELS: Record<Exclude<VisibleSendEvidence, "NOT_CONTACTED">, { label: string; title: string }> = {
  CONFIRMED: {
    label: "Message sent",
    title: "Someone confirmed in the app that this message was sent (since 20 August 2026). Delivery is still not guaranteed.",
  },
  UNCONFIRMED: {
    label: "Send not confirmed",
    title: "Marked as contacted, but nobody confirmed a message was sent. It may only be a button click, an import, a bulk change or an older record.",
  },
};

// ─── Reply labels ────────────────────────────────────────────────────────

export type ReplyState = "CONFIRMED" | "POSSIBLE_OLD" | "NONE";

export function replyStateOf(p: Pick<ProspectRow, "status" | "messageReplied" | "replyWasReset" | "replyReviewed">): ReplyState {
  if (hasRecordedReply(p)) return "CONFIRMED";
  if (p.replyWasReset && !p.replyReviewed) return "POSSIBLE_OLD";
  return "NONE";
}

export const REPLY_LABELS: Record<Exclude<ReplyState, "NONE">, { label: string; title: string }> = {
  CONFIRMED: { label: "Replied", title: "A reply is recorded for this prospect." },
  POSSIBLE_OLD: {
    label: "Possible old reply",
    title: "This was marked as replied until an old send button reset it. No reply is confirmed: check the conversation first.",
  },
};

// ─── One next action ─────────────────────────────────────────────────────

export type NextActionKey =
  | QueueKind
  | "check_status"
  | "client"
  | "in_talks"
  | "closed"
  | "reply_negative"
  | "wait_until"
  | "unreachable"
  | "follow_ups_stopped"
  | "wait_for_reply"
  | "confirm_send"
  | "confirm_channel";

export type NextAction = {
  key: NextActionKey;
  /** Button / headline text, in everyday words. */
  label: string;
  /** One plain sentence: why this is the next step. */
  hint: string;
  /** True when there is something to do now; false means "nothing yet", shown quietly. */
  actionable: boolean;
};

const NEGATIVE_REASONS = ["NOT_INTERESTED", "HAS_PROVIDER", "TOO_EXPENSIVE", "NO_BUDGET"];
const PROGRESSED_STATUSES = ["MEETING", "PROPOSAL_SENT", "NEGOTIATION"];

const fmtDay = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

const STEP_LABEL = { followup1: "1st", followup2: "2nd", followup3: "3rd" } as const;

/**
 * The single next action for a prospect, reusing classifyProspect for every
 * case the Leads Command Center handles. The other cases only explain why
 * there is nothing to do yet; they never schedule, send or change anything.
 * `today` is the Marrakech day as YYYY-MM-DD.
 */
export function nextActionFor(p: ProspectRow, today: string): NextAction {
  if (!getStage(p.status)) {
    return { key: "check_status", label: "Check the status", hint: `Its status "${p.status}" isn't one the app knows, so no step is suggested.`, actionable: true };
  }

  const kind = classifyProspect(p, today);
  if (kind) return queueAction(p, kind);

  if (p.status === "CLIENT" || p.status === "CONVERTI") {
    return { key: "client", label: "No action: client", hint: "Already a client. Follow-ups stop here.", actionable: false };
  }
  if (isClosed(p.status)) {
    return { key: "closed", label: "No action: closed", hint: "Marked as not interested or lost.", actionable: false };
  }
  if (p.liveMeeting || p.hasProposal || PROGRESSED_STATUSES.includes(p.status)) {
    return { key: "in_talks", label: "Keep the deal moving", hint: "A meeting or proposal is under way. Pick up from the meeting or proposal.", actionable: true };
  }
  if (hasRecordedReply(p) && p.replyReason && NEGATIVE_REASONS.includes(p.replyReason)) {
    return { key: "reply_negative", label: "No action: said no", hint: "They replied that they're not interested. Close the lead when you're ready.", actionable: false };
  }
  if (p.status === "PAS_DE_WHATSAPP" && !hasRecordedReply(p)) {
    return { key: "unreachable", label: "No action: unreachable", hint: "No working WhatsApp was found. Confirm Instagram to try again.", actionable: false };
  }
  if (p.lastSendDay && p.followUpStopped && !hasRecordedReply(p)) {
    return { key: "follow_ups_stopped", label: "No action: follow-ups stopped", hint: "Someone decided not to follow up again. Close the lead or set a date.", actionable: false };
  }
  if (p.followUpDay && p.followUpDay > today) {
    return { key: "wait_until", label: `Wait until ${fmtDay(p.followUpDay)}`, hint: "A date to come back is already set.", actionable: false };
  }
  if (p.lastSendDay) {
    return { key: "wait_for_reply", label: "Wait for a reply", hint: "A message was sent recently. Give them a few days.", actionable: false };
  }

  const contacted = p.status !== "A_ENVOYER" || p.hasSentAt || p.anyMessage || p.anySendActivity;
  if (contacted) {
    return { key: "confirm_send", label: "Check a message was sent", hint: "Marked as contacted, but no send is confirmed. Check the conversation before following up.", actionable: true };
  }
  return { key: "confirm_channel", label: "Confirm WhatsApp or Instagram", hint: "Not contacted yet. Confirm a channel by hand before the first message.", actionable: true };
}

function queueAction(p: ProspectRow, kind: QueueKind): NextAction {
  const step = nextFollowUpStep(p);
  const followUp = step ? `Follow up (${STEP_LABEL[step]})` : "Follow up";
  switch (kind) {
    case "reply":
      return { key: kind, label: "Reply to them", hint: "They replied. Answer before anything else.", actionable: true };
    case "reply_review":
      return { key: kind, label: "Check if they replied", hint: "Possible old reply, not confirmed. Read the conversation first.", actionable: true };
    case "follow_up_overdue":
      return { key: kind, label: followUp, hint: "The follow-up date has passed.", actionable: true };
    case "follow_up_today":
      return { key: kind, label: followUp, hint: "The follow-up is due today.", actionable: true };
    case "follow_up_decision":
      return { key: kind, label: "Decide: follow up or stop", hint: "No reply yet and no follow-up date set.", actionable: true };
    case "ready":
      return { key: kind, label: "Send first message", hint: "Not contacted yet, and a channel is confirmed.", actionable: true };
    case "enquiry":
      return { key: kind, label: "Answer the enquiry", hint: "A new website enquiry.", actionable: true };
  }
}

// ─── One list row ────────────────────────────────────────────────────────

export type RowSummary = { group: DisplayGroupKey; nextAction: NextAction; replyState: ReplyState };

/** Group, next action and reply state of one row, all from the queue's own row facts. */
export function describeProspect(p: ProspectRow, today: string): RowSummary {
  return { group: displayGroupOf(p), nextAction: nextActionFor(p, today), replyState: replyStateOf(p) };
}
