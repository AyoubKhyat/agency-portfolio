/**
 * Simple prospect stages — a DISPLAY layer over the stored `Prospect.status`.
 *
 * The database keeps its detailed statuses (A_ENVOYER, ENVOYE, REPONDU, ...)
 * and nothing here writes them. Each stage is just a named group of stored
 * statuses, so filters and counts translate to `status IN (...)` and no
 * migration is needed. Unknown statuses fall into OTHER and are shown with
 * their raw value rather than guessed into a stage.
 *
 * Pure and DB-free so the mapping can be regression-tested directly.
 */

export type StageKey = "TO_CONTACT" | "WAITING" | "REPLIED" | "IN_TALKS" | "WON" | "UNREACHABLE" | "CLOSED";

export type Stage = {
  key: StageKey;
  label: string;
  hint: string;
  /** Stored statuses this stage groups. Each stored status belongs to exactly one stage. */
  statuses: readonly string[];
  badge: "blue" | "amber" | "green" | "purple" | "red" | "default";
};

export const STAGES: readonly Stage[] = [
  { key: "TO_CONTACT",  label: "To contact",       hint: "Not contacted yet",                    statuses: ["A_ENVOYER"],                                badge: "blue" },
  { key: "WAITING",     label: "Waiting for reply", hint: "Contacted, no reply recorded",         statuses: ["ENVOYE"],                                   badge: "amber" },
  { key: "REPLIED",     label: "Replied",           hint: "They answered — your move",            statuses: ["REPONDU"],                                  badge: "green" },
  { key: "IN_TALKS",    label: "In talks",          hint: "Meeting, proposal or negotiation",     statuses: ["MEETING", "PROPOSAL_SENT", "NEGOTIATION"],  badge: "purple" },
  { key: "WON",         label: "Won",               hint: "Became a client",                      statuses: ["CLIENT", "CONVERTI"],                       badge: "green" },
  { key: "UNREACHABLE", label: "Unreachable",       hint: "No working WhatsApp found",            statuses: ["PAS_DE_WHATSAPP"],                          badge: "red" },
  // PERDU / REFUSE are legacy spellings of LOST that may still exist in data.
  { key: "CLOSED",      label: "Closed",            hint: "Not interested or lost",               statuses: ["LOST", "PERDU", "REFUSE"],                  badge: "default" },
];

/** Stage of a stored status, or null when the status is not one we know. */
export function getStage(status: string | null | undefined): Stage | null {
  if (!status) return null;
  return STAGES.find((s) => s.statuses.includes(status)) ?? null;
}

export function getStageByKey(key: string | null | undefined): Stage | null {
  return STAGES.find((s) => s.key === key) ?? null;
}

/** Label for any stored status; unknown values are shown as-is, never re-labelled. */
export function stageLabel(status: string | null | undefined): string {
  return getStage(status)?.label ?? (status || "—");
}

/** The `status` query value that selects a whole stage, e.g. "MEETING,PROPOSAL_SENT,NEGOTIATION". */
export function stageStatusParam(stage: Stage): string {
  return stage.statuses.join(",");
}

/** Split a `status` query value into stored statuses ("ALL" and blanks dropped). */
export function parseStatusList(param: string | null | undefined): string[] {
  if (!param) return [];
  return [...new Set(param.split(",").map((s) => s.trim()).filter((s) => s && s !== "ALL"))];
}

/**
 * Prisma `where.status` for a `status` query value: a plain string for one
 * status (unchanged behaviour for existing links), `{ in }` for several,
 * undefined for no filter.
 */
export function statusWhere(param: string | null | undefined): string | { in: string[] } | undefined {
  const list = parseStatusList(param);
  if (list.length === 0) return undefined;
  return list.length === 1 ? list[0] : { in: list };
}

/** The stage a `status` query value selects exactly, if any — drives the active tab. */
export function stageForStatusParam(param: string | null | undefined): Stage | null {
  const list = parseStatusList(param);
  if (list.length === 0) return null;
  return STAGES.find((s) => s.statuses.length === list.length && s.statuses.every((x) => list.includes(x))) ?? null;
}

/** Sum stored-status counts into stage counts. Unknown statuses go to `other`. */
export function countByStage(rows: { status: string; count: number }[]): Record<StageKey, number> & { other: number } {
  const out = { TO_CONTACT: 0, WAITING: 0, REPLIED: 0, IN_TALKS: 0, WON: 0, UNREACHABLE: 0, CLOSED: 0, other: 0 };
  for (const r of rows) {
    const stage = getStage(r.status);
    if (stage) out[stage.key] += r.count;
    else out.other += r.count;
  }
  return out;
}

// ─── Contact channel vs. recorded outreach ──────────────────────
//
// Two independent facts, never merged into one "verified outreach" label:
//
// 1. CHANNEL — is there a WhatsApp or Instagram someone confirmed by hand
//    (whatsappStatus / instagramStatus = VERIFIED)? Says the prospect CAN be
//    reached. It does not say a message was ever sent.
//
// 2. SEND RECORD — does the app hold a record of a message being sent: an
//    OutreachMessage row, or a SENT_WHATSAPP / SENT_INSTAGRAM activity (logged
//    by the send buttons)? FOLLOW_UP activities are NOT counted: the Reply
//    Inbox logs FOLLOW_UP when it only schedules a date. A status of ENVOYE on
//    its own (bulk change, import, manual edit) is not a send record either.
//
//    Send records are split by date. Before the 2026-07-07 cleanup the send
//    buttons opened wa.me links built from unconfirmed phone numbers (242 of
//    them were fake), so a record from then shows a button was pressed, not
//    that a message went out. Those are LEGACY: kept and shown, but treated
//    as insufficient evidence. Even a recent record does not prove delivery.

/** Send records before this date are historical and insufficient evidence (production cleanup day). */
export const OUTREACH_EVIDENCE_SINCE = new Date("2026-07-07T00:00:00Z");

/** Stages that imply first contact already happened. */
const CONTACTED_STAGES: readonly StageKey[] = ["WAITING", "REPLIED", "IN_TALKS", "WON"];

/** Stored statuses that imply first contact already happened. */
export const CONTACTED_STATUSES: readonly string[] = STAGES
  .filter((s) => CONTACTED_STAGES.includes(s.key))
  .flatMap((s) => s.statuses);

/** Activity types written only when a send button was used. */
export const SEND_ACTION_TYPES: readonly string[] = ["SENT_WHATSAPP", "SENT_INSTAGRAM"];

export type ChannelState = "VERIFIED" | "UNVERIFIED";
export type SendEvidence = "NOT_CONTACTED" | "RECORDED" | "LEGACY" | "NOT_RECORDED";

export type ProspectEvidenceInput = {
  status: string;
  sentAt: Date | string | null;
  whatsappStatus?: string | null;
  instagramStatus?: string | null;
  /** Date of the latest send record (outreach message or send activity), if any. */
  lastSendAt?: Date | string | null;
};

export function hasVerifiedChannel(p: Pick<ProspectEvidenceInput, "whatsappStatus" | "instagramStatus">): boolean {
  return p.whatsappStatus === "VERIFIED" || p.instagramStatus === "VERIFIED";
}

export function getChannelState(p: Pick<ProspectEvidenceInput, "whatsappStatus" | "instagramStatus">): ChannelState {
  return hasVerifiedChannel(p) ? "VERIFIED" : "UNVERIFIED";
}

/** Marked as contacted by any signal: anchor, status, or a send record. */
export function isContacted(p: Pick<ProspectEvidenceInput, "status" | "sentAt" | "lastSendAt">): boolean {
  return !!p.sentAt || CONTACTED_STATUSES.includes(p.status) || !!p.lastSendAt;
}

/** How well a contacted prospect's outreach is backed by records. Ignores channel state. */
export function getSendEvidence(p: Pick<ProspectEvidenceInput, "status" | "sentAt" | "lastSendAt">): SendEvidence {
  if (p.lastSendAt) {
    return new Date(p.lastSendAt).getTime() >= OUTREACH_EVIDENCE_SINCE.getTime() ? "RECORDED" : "LEGACY";
  }
  return isContacted(p) ? "NOT_RECORDED" : "NOT_CONTACTED";
}

/** Latest of the send-record dates, or null. */
export function latestSendAt(dates: (Date | string | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d);
    if (!best || t > best) best = t;
  }
  return best;
}

export const CHANNEL_LABELS: Record<ChannelState, { label: string; title: string }> = {
  VERIFIED: {
    label: "Channel verified",
    title: "A WhatsApp or Instagram for this prospect was confirmed by hand. This only means they can be reached — it does not mean a message was sent.",
  },
  UNVERIFIED: {
    label: "Channel unverified",
    title: "No WhatsApp or Instagram has been confirmed by hand. Confirm one before sending.",
  },
};

export const SEND_LABELS: Record<Exclude<SendEvidence, "NOT_CONTACTED">, { label: string; title: string }> = {
  RECORDED: {
    label: "Send recorded",
    title: "The app logged a send for this prospect since the July 2026 cleanup (a send button or a saved outreach message). Delivery is still not confirmed.",
  },
  LEGACY: {
    label: "Old send, unconfirmed",
    title: "The only send records are from before the 7 July 2026 cleanup, when send buttons opened WhatsApp links built from unconfirmed numbers. A button was pressed; there is no evidence the message arrived.",
  },
  NOT_RECORDED: {
    label: "No send record",
    title: "Marked as contacted, but the app has no record of a message being sent (for example a bulk status change, an import or an older record).",
  },
};

/** Prisma `where` fragments. Combine with AND (search already uses OR). */
export const VERIFIED_CHANNEL_WHERE = {
  OR: [{ whatsappStatus: "VERIFIED" }, { instagramStatus: "VERIFIED" }],
};
export const UNVERIFIED_CHANNEL_WHERE = {
  AND: [{ whatsappStatus: { not: "VERIFIED" } }, { instagramStatus: { not: "VERIFIED" } }],
};
/** Any send record at all, of any date. */
export const ANY_SEND_WHERE = {
  OR: [
    { outreachMessages: { some: {} } },
    { activities: { some: { actionType: { in: [...SEND_ACTION_TYPES] } } } },
  ],
};
/** A send record since OUTREACH_EVIDENCE_SINCE — the only send evidence treated as current. */
export const RECORDED_SEND_WHERE = {
  OR: [
    { outreachMessages: { some: { sentAt: { gte: OUTREACH_EVIDENCE_SINCE } } } },
    { activities: { some: { actionType: { in: [...SEND_ACTION_TYPES] }, createdAt: { gte: OUTREACH_EVIDENCE_SINCE } } } },
  ],
};
/** Send records exist, but all of them predate the cleanup. */
export const LEGACY_SEND_WHERE = {
  AND: [ANY_SEND_WHERE, { NOT: RECORDED_SEND_WHERE }],
};
export const NO_RECORDED_SEND_WHERE = {
  AND: [
    { outreachMessages: { none: {} } },
    { activities: { none: { actionType: { in: [...SEND_ACTION_TYPES] } } } },
  ],
};
/** Everything that is not current evidence: legacy-only records or none at all. */
export const NOT_CURRENT_SEND_WHERE = { NOT: RECORDED_SEND_WHERE };
export const CONTACTED_WHERE = {
  OR: [{ sentAt: { not: null } }, { status: { in: [...CONTACTED_STATUSES] } }, ANY_SEND_WHERE],
};

/** `include` fragment that fetches just the latest send record of each kind. */
export function sendRecordInclude() {
  return {
    outreachMessages: { select: { sentAt: true }, orderBy: { sentAt: "desc" as const }, take: 1 },
    activities: {
      where: { actionType: { in: [...SEND_ACTION_TYPES] } },
      select: { createdAt: true }, orderBy: { createdAt: "desc" as const }, take: 1,
    },
  };
}

/** `channel` query value → where fragment, or undefined for no filter. */
export function channelWhere(param: string | null | undefined) {
  if (param === "verified") return VERIFIED_CHANNEL_WHERE;
  if (param === "unverified") return UNVERIFIED_CHANNEL_WHERE;
  return undefined;
}

/** `evidence` query value → where fragment, or undefined for no filter. */
export function evidenceWhere(param: string | null | undefined) {
  if (param === "recorded") return RECORDED_SEND_WHERE;
  if (param === "legacy") return LEGACY_SEND_WHERE;
  if (param === "none") return NO_RECORDED_SEND_WHERE;
  if (param === "unbacked") return NOT_CURRENT_SEND_WHERE;
  return undefined;
}
