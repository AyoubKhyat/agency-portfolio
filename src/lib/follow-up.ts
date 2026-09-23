/**
 * Follow-up eligibility — the single source of truth for "who is due a follow-up".
 *
 * Kept pure and DB-free so the rules can be regression-tested directly. The
 * queue route applies the same predicates as a Prisma `where` filter for
 * efficiency; these functions are the authoritative definition and the last
 * line of defence if a query filter is ever loosened.
 *
 * HARD RULE: a prospect who has replied is never followed up automatically.
 * A reply is recorded on OutreachMessage.replied, which is the signal a
 * salesperson actually touches. Relying on someone ALSO remembering to move
 * Prospect.status to REPONDU is how a replying prospect gets chased again.
 * Either signal suppresses follow-up; neither is trusted alone.
 */

export const DAY_MS = 86_400_000;

/**
 * Statuses that are no longer actionable cold outreach.
 * LOST is the current terminal status; PERDU / REFUSE are legacy spellings
 * kept so historic rows still match. PAS_DE_WHATSAPP means we already
 * established there is no reachable WhatsApp — re-queueing wastes time.
 */
export const FOLLOW_UP_EXCLUDED_STATUSES = [
  "REPONDU", "CONVERTI", "CLIENT",
  "LOST", "PAS_DE_WHATSAPP",
  "PERDU", "REFUSE",
] as const;

export type FollowUpBucket =
  | "never_contacted"
  | "due_day_4"
  | "due_day_10"
  | "due_day_20";

export type FollowUpCandidate = {
  status: string;
  sentAt: Date | null;
  followup1At: Date | null;
  followup2At: Date | null;
  followup3At: Date | null;
  /** True when ANY outreach message to this prospect is marked replied. */
  hasReply: boolean;
};

/**
 * True when this prospect must be kept out of every automated follow-up queue.
 * Two independent signals, either of which is sufficient.
 */
export function isFollowUpSuppressed(p: { status: string; hasReply: boolean }): boolean {
  if (p.hasReply) return true;
  return (FOLLOW_UP_EXCLUDED_STATUSES as readonly string[]).includes(p.status);
}

/**
 * The most-advanced bucket a prospect qualifies for, or null when they are not
 * due anything right now (suppressed, mid-interval, or cycle complete).
 *
 * Cadence anchors: sentAt → +3d, followup1At → +6d, followup2At → +10d.
 */
export function computeFollowUpBucket(
  p: FollowUpCandidate,
  now: number = Date.now(),
): FollowUpBucket | null {
  if (isFollowUpSuppressed(p)) return null;

  if (!p.sentAt) return "never_contacted";
  if (!p.followup1At) return now - p.sentAt.getTime() >= 3 * DAY_MS ? "due_day_4" : null;
  if (!p.followup2At) return now - p.followup1At.getTime() >= 6 * DAY_MS ? "due_day_10" : null;
  if (!p.followup3At) return now - p.followup2At.getTime() >= 10 * DAY_MS ? "due_day_20" : null;
  return null; // full cycle complete
}
