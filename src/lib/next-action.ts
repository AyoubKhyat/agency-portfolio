/**
 * The Leads Command Center's rules: what needs doing, and in what order.
 *
 * Pure and framework-free, so every rule is tested without a database. Each one
 * comes from the production audit of 2026-11-04:
 *  - "Overdue" needs a date that is not older than the latest confirmed send.
 *    A date from before that send is stale, so it is never shown as overdue.
 *  - Only a confirmed send counts. Opening WhatsApp proves nothing.
 *  - A status an old send button reset is a possible reply to check, not a reply waiting for an answer.
 *  - A person appears once, at their highest priority.
 *  - Nothing here invents a reply, a date or a priority. Unknown stays unknown.
 *
 * Days are YYYY-MM-DD strings in Marrakech time, worked out by Postgres.
 */

export type SendChannel = "WHATSAPP" | "INSTAGRAM";

export type QueueKind =
  | "reply"
  | "reply_review"
  | "enquiry"
  | "follow_up_overdue"
  | "follow_up_today"
  | "follow_up_decision"
  | "ready";

export type QueueGroup = "replies" | "enquiries" | "verify" | "followUps" | "ready";

/** Priority order: the first kind is the most urgent. */
const KIND_ORDER: readonly QueueKind[] = [
  "reply", "enquiry", "reply_review", "follow_up_overdue", "follow_up_today", "follow_up_decision", "ready",
];

const GROUP_OF: Record<QueueKind, QueueGroup> = {
  reply: "replies",
  reply_review: "verify",
  enquiry: "enquiries",
  follow_up_overdue: "followUps",
  follow_up_today: "followUps",
  follow_up_decision: "followUps",
  ready: "ready",
};

/** Activity types the queue may log without a status change. They record a decision, never a contact. */
export const QUEUE_ACTIVITY_TYPES = ["NO_MORE_FOLLOW_UP", "REPLY_REVIEWED"] as const;

/** Days after a confirmed send before an undated prospect asks for a decision. */
export const DECISION_AFTER_DAYS = 3;

const CLOSED_STATUSES = ["CONVERTI", "CLIENT", "LOST", "PERDU", "REFUSE"];
/** Booking a meeting or sending a proposal moves a prospect here. From then on the Clients pipeline owns them. */
const PROGRESSED_STATUSES = ["MEETING", "PROPOSAL_SENT", "NEGOTIATION"];
const NEGATIVE_REASONS = ["NOT_INTERESTED", "HAS_PROVIDER", "TOO_EXPENSIVE", "NO_BUDGET"];

/** Same order as the Reply Inbox: the warmest reply first. Unknown reasons sit after known interest. */
const REASON_RANK: Record<string, number> = { MEETING_REQUESTED: 1, PROPOSAL_REQUESTED: 2, INTERESTED: 3, LATER: 4 };
const REASON_LABELS: Record<string, string> = {
  MEETING_REQUESTED: "Wants a meeting",
  PROPOSAL_REQUESTED: "Wants a proposal",
  INTERESTED: "Interested",
  LATER: "Asked to call later",
};

export type ProspectRow = {
  id: string;
  name: string;
  sector: string;
  neighborhood: string;
  phone: string;
  instagram: string;
  status: string;
  whatsappLink: string;
  whatsappStatus: string;
  instagramStatus: string;
  qualityLabel: string | null;
  score: number | null;
  hasSentAt: boolean;
  followup1Done: boolean;
  followup2Done: boolean;
  followup3Done: boolean;
  createdDay: string;
  followUpDay: string | null;
  lastSendDay: string | null;
  lastSendChannel: string | null;
  replyReason: string | null;
  repliedDay: string | null;
  messageReplied: boolean;
  anyMessage: boolean;
  anySendActivity: boolean;
  replyWasReset: boolean;
  replyReviewed: boolean;
  followUpStopped: boolean;
  liveMeeting: boolean;
  hasProposal: boolean;
};

export type EnquiryRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  createdDay: string;
  fromTeamEmail: boolean;
};

export type ChannelOption = {
  channel: SendChannel;
  url: string;
  /** False until someone confirmed it by hand or a confirmed send went through it. */
  trusted: boolean;
};

export type FollowUpStep = "followup1" | "followup2" | "followup3";

export type QueueItem = {
  key: string;
  kind: QueueKind;
  group: QueueGroup;
  /** Prospect or enquiry id. */
  id: string;
  name: string;
  /** The verb line: what to do. */
  action: string;
  /** Short facts for the list row. */
  detail: string;
  /** Why this is on the list, in one plain sentence. */
  why: string;
  meta: string;
  channels: ChannelOption[];
  nextStep: FollowUpStep | null;
  enquiry: { email: string; phone: string | null; subject: string; message: string; fromTeamEmail: boolean } | null;
};

export type LeadQueue = {
  today: string;
  items: QueueItem[];
  counts: { all: number; replies: number; enquiries: number; verify: number; followUps: number; ready: number };
  notes: {
    /** People left out of the queue despite a past date: no confirmed send backs it. */
    hiddenOldDates: number;
    /** Not contacted yet, with no channel anyone has confirmed. */
    toSendNoChannel: number;
    /** Future dates. */
    scheduled: number;
    /** Confirmed send in the last few days, no date yet. */
    recentlySent: number;
  };
};

// ─── Dates ───────────────────────────────────────────────────────────────

const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** Whole days from `from` to `to`. Plain calendar arithmetic, so no time zone is involved. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(day: string, days: number): string {
  return new Date(toUtc(day) + days * 86_400_000).toISOString().slice(0, 10);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

// ─── Channels ────────────────────────────────────────────────────────────

/** Moroccan fixed lines start 05. WhatsApp cannot reach them. */
export function isLandline(phone: string | null | undefined): boolean {
  return /^(212|0)?5/.test((phone ?? "").replace(/\D/g, ""));
}

/** wa.me address from a stored link, or from a mobile number. Empty when there is neither. */
export function whatsappUrl(p: { whatsappLink?: string | null; phone?: string | null }, text = ""): string {
  const stored = (p.whatsappLink ?? "").trim();
  let base = stored ? stored.split("?")[0].replace(/\/+$/, "") : "";
  if (!base) {
    const digits = (p.phone ?? "").replace(/\D/g, "");
    if (!digits || isLandline(digits)) return "";
    base = `https://wa.me/${digits.length === 10 && digits.startsWith("0") ? `212${digits.slice(1)}` : digits}`;
  }
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function instagramUrl(handle: string | null | undefined): string {
  const h = (handle ?? "").trim().replace(/^@/, "");
  return h ? `https://ig.me/m/${h}` : "";
}

/**
 * How this prospect can be reached. A channel is trusted when someone confirmed
 * it by hand, or a confirmed send already went through it. The 2026 cleanup found
 * hundreds of fake numbers, so nothing else opens without a manual confirmation.
 */
export function channelsFor(p: ProspectRow): ChannelOption[] {
  const out: ChannelOption[] = [];
  const wa = whatsappUrl(p);
  if (wa && p.whatsappStatus !== "UNAVAILABLE") {
    out.push({ channel: "WHATSAPP", url: wa, trusted: p.whatsappStatus === "VERIFIED" || p.lastSendChannel === "WHATSAPP" });
  }
  const ig = instagramUrl(p.instagram);
  if (ig && p.instagramStatus !== "UNAVAILABLE") {
    out.push({ channel: "INSTAGRAM", url: ig, trusted: p.instagramStatus === "VERIFIED" || p.lastSendChannel === "INSTAGRAM" });
  }
  return out.sort((a, b) => Number(b.trusted) - Number(a.trusted));
}

/** The next step of the follow-up sequence, or null once all three are done. */
export function nextFollowUpStep(p: Pick<ProspectRow, "followup1Done" | "followup2Done" | "followup3Done">): FollowUpStep | null {
  if (!p.followup1Done) return "followup1";
  if (!p.followup2Done) return "followup2";
  if (!p.followup3Done) return "followup3";
  return null;
}

// ─── Rules ───────────────────────────────────────────────────────────────

export function isClosed(status: string): boolean {
  return CLOSED_STATUSES.includes(status);
}

const progressed = (p: ProspectRow) => p.liveMeeting || p.hasProposal || PROGRESSED_STATUSES.includes(p.status);
const hasReply = (p: ProspectRow) => p.status === "REPONDU" || p.messageReplied;
const replyUnderReview = (p: ProspectRow) => p.replyWasReset && !p.replyReviewed && !hasReply(p);
/** A future date means someone already decided when to come back. */
const scheduledLater = (p: ProspectRow, today: string) => !!p.followUpDay && p.followUpDay > today;
/** A date only counts when it is about the latest confirmed send. */
const validDate = (p: ProspectRow) => !!p.lastSendDay && !!p.followUpDay && p.followUpDay >= p.lastSendDay;

/** The single highest-priority kind for a prospect, or null when nothing is needed. */
export function classifyProspect(p: ProspectRow, today: string): QueueKind | null {
  if (isClosed(p.status) || progressed(p)) return null;

  if (hasReply(p)) {
    const negative = !!p.replyReason && NEGATIVE_REASONS.includes(p.replyReason);
    if (negative || scheduledLater(p, today)) return null;
    return "reply";
  }
  if (replyUnderReview(p)) return scheduledLater(p, today) ? null : "reply_review";

  if (p.status === "PAS_DE_WHATSAPP") return null;

  if (p.lastSendDay) {
    if (p.followUpStopped) return null;
    if (validDate(p)) {
      if (p.followUpDay! < today) return "follow_up_overdue";
      if (p.followUpDay === today) return "follow_up_today";
      return null;
    }
    if (scheduledLater(p, today)) return null;
    return daysBetween(p.lastSendDay, today) >= DECISION_AFTER_DAYS ? "follow_up_decision" : null;
  }

  const neverContacted = p.status === "A_ENVOYER" && !p.hasSentAt && !p.anyMessage && !p.anySendActivity;
  if (neverContacted && channelsFor(p).some((c) => c.trusted)) return "ready";
  return null;
}

function prospectItem(p: ProspectRow, kind: QueueKind, today: string): QueueItem {
  const place = [p.sector, p.neighborhood].filter(Boolean).join(" · ");
  const via = p.lastSendChannel === "WHATSAPP" ? "WhatsApp" : p.lastSendChannel === "INSTAGRAM" ? "Instagram" : "";
  const sent = p.lastSendDay ? `Sent ${ago(daysBetween(p.lastSendDay, today))}${via ? ` on ${via}` : ""}` : "";
  const late = p.followUpDay ? daysBetween(p.followUpDay, today) : 0;

  const copy: Record<Exclude<QueueKind, "enquiry">, { action: string; detail: string; why: string }> = {
    reply: {
      action: `Reply to ${p.name}`,
      detail: (p.replyReason && REASON_LABELS[p.replyReason]) || "Replied",
      why: p.repliedDay
        ? `Marked as replied ${ago(daysBetween(p.repliedDay, today))}. Nothing is booked yet.`
        : "Marked as replied. Nothing is booked yet.",
    },
    reply_review: {
      action: `Check if ${p.name} replied`,
      detail: "Possible old reply, not confirmed",
      why: "This was marked as replied until an old send button reset it. No reply text is saved, so check the conversation before acting.",
    },
    follow_up_overdue: {
      action: `Follow up with ${p.name}`,
      detail: `${plural(late, "day")} overdue`,
      why: `${sent}. You planned to follow up on this date.`,
    },
    follow_up_today: {
      action: `Follow up with ${p.name}`,
      detail: "Due today",
      why: `${sent}. You planned to follow up today.`,
    },
    follow_up_decision: {
      action: `Decide on ${p.name}`,
      detail: sent,
      why: `${sent}. No reply is recorded and no follow-up date is set.`,
    },
    ready: {
      action: `Contact ${p.name}`,
      detail: "Ready to contact",
      why: "Not contacted yet, and a channel has been confirmed.",
    },
  };

  return {
    key: `p:${p.id}`,
    kind,
    group: GROUP_OF[kind],
    id: p.id,
    name: p.name,
    ...copy[kind as Exclude<QueueKind, "enquiry">],
    meta: place,
    channels: channelsFor(p),
    nextStep: kind.startsWith("follow_up") ? nextFollowUpStep(p) : null,
    enquiry: null,
  };
}

function enquiryItem(e: EnquiryRow, today: string): QueueItem {
  const age = daysBetween(e.createdDay, today);
  return {
    key: `e:${e.id}`,
    kind: "enquiry",
    group: "enquiries",
    id: e.id,
    name: e.fullName,
    action: `Answer ${e.fullName}`,
    detail: age <= 0 ? "New enquiry today" : `Enquiry, ${plural(age, "day")} old`,
    why: e.fromTeamEmail
      ? "Sent from a team email address, so this may be a test."
      : `Came through your website ${ago(age)} and is still marked new.`,
    meta: e.subject,
    channels: [],
    nextStep: null,
    enquiry: { email: e.email, phone: e.phone, subject: e.subject, message: e.message, fromTeamEmail: e.fromTeamEmail },
  };
}

/** Order inside a kind. Lower sorts first. */
function sortKey(a: ProspectRow, b: ProspectRow, kind: QueueKind, today: string): number {
  switch (kind) {
    case "reply": {
      const rank = (p: ProspectRow) => (p.replyReason ? REASON_RANK[p.replyReason] ?? 5 : 5);
      return rank(a) - rank(b) || (b.repliedDay ?? "").localeCompare(a.repliedDay ?? "");
    }
    case "follow_up_overdue":
      return (a.followUpDay ?? "").localeCompare(b.followUpDay ?? "");
    case "follow_up_decision":
      // The most recent send first: that conversation is still warm.
      return daysBetween(a.lastSendDay!, today) - daysBetween(b.lastSendDay!, today);
    case "ready": {
      const hot = (p: ProspectRow) => (p.qualityLabel === "HOT" ? 0 : 1);
      return hot(a) - hot(b) || (b.score ?? 0) - (a.score ?? 0) || a.createdDay.localeCompare(b.createdDay);
    }
    default:
      return a.createdDay.localeCompare(b.createdDay);
  }
}

export function buildLeadQueue(prospects: ProspectRow[], enquiries: EnquiryRow[], today: string): LeadQueue {
  const byKind = new Map<QueueKind, ProspectRow[]>();
  const notes = { hiddenOldDates: 0, toSendNoChannel: 0, scheduled: 0, recentlySent: 0 };

  for (const p of prospects) {
    if (isClosed(p.status) || progressed(p)) continue;
    const kind = classifyProspect(p, today);
    if (kind) (byKind.get(kind) ?? byKind.set(kind, []).get(kind)!).push(p);
    else if (p.status === "A_ENVOYER" && !p.hasSentAt) notes.toSendNoChannel++;
    else if (scheduledLater(p, today)) notes.scheduled++;
    else if (p.lastSendDay && !p.followUpStopped) notes.recentlySent++;
    if (!kind && p.followUpDay && p.followUpDay < today) notes.hiddenOldDates++;
  }

  // Teammates' test enquiries sink to the end of their group instead of leading the day.
  const sortedEnquiries = [...enquiries].sort(
    (a, b) => Number(a.fromTeamEmail) - Number(b.fromTeamEmail) || a.createdDay.localeCompare(b.createdDay),
  );

  const items: QueueItem[] = [];
  for (const kind of KIND_ORDER) {
    if (kind === "enquiry") {
      items.push(...sortedEnquiries.map((e) => enquiryItem(e, today)));
      continue;
    }
    const rows = [...(byKind.get(kind) ?? [])].sort((a, b) => sortKey(a, b, kind, today));
    items.push(...rows.map((p) => prospectItem(p, kind, today)));
  }

  const count = (group: QueueGroup) => items.filter((i) => i.group === group).length;
  return {
    today,
    items,
    counts: { all: items.length, replies: count("replies"), enquiries: count("enquiries"), verify: count("verify"), followUps: count("followUps"), ready: count("ready") },
    notes,
  };
}
