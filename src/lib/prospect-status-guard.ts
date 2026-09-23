/**
 * Send actions must never move a prospect BACKWARD in the pipeline.
 *
 * The WhatsApp / Instagram send buttons all PATCH `status: "ENVOYE"`. Before
 * this guard, pressing one on a prospect who had already replied silently
 * flipped them from REPONDU back to ENVOYE — which drops the reply and puts
 * them back in the cold follow-up queue. Observed in production:
 *
 *   07:54:20  MARKED_REPLIED  ENVOYE  -> REPONDU
 *   07:54:52  SENT_INSTAGRAM  REPONDU -> ENVOYE   <- reply undone
 *
 * Rule: a transition to ENVOYE is ignored (status kept) when the prospect is
 * already at REPONDU or any later / terminal stage. Every other transition is
 * unchanged — a not-yet-contacted prospect still moves to ENVOYE normally, and
 * explicit moves to non-ENVOYE statuses are not affected.
 *
 * Pure and DB-free so it can be regression-tested directly. The write layer
 * (prospect-first-contact.ts) also enforces it in the WHERE clause, so a stale
 * read in a route can't bypass it.
 */

/** Status written by every "sent" action. */
export const SENT_STATUS = "ENVOYE";

/**
 * REPONDU and everything after it in the pipeline, plus terminal statuses.
 * PERDU / REFUSE are legacy spellings of LOST that may still exist in data.
 * PAS_DE_WHATSAPP is deliberately NOT here: it is a pre-reply state, and an
 * Instagram send legitimately moves such a prospect to ENVOYE.
 */
export const POST_REPLY_STATUSES = [
  "REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION",
  "CONVERTI", "CLIENT",
  "LOST", "PERDU", "REFUSE",
] as const;

export function isPostReplyStatus(status: string | null | undefined): boolean {
  return !!status && (POST_REPLY_STATUSES as readonly string[]).includes(status);
}

/**
 * The status that should actually be written for a requested change.
 * `preserved` is true when the request was a backward move to ENVOYE and the
 * current status was kept instead.
 */
export function resolveStatusChange(
  currentStatus: string | null | undefined,
  requestedStatus: string,
): { status: string; preserved: boolean } {
  if (requestedStatus === SENT_STATUS && isPostReplyStatus(currentStatus)) {
    return { status: currentStatus as string, preserved: true };
  }
  return { status: requestedStatus, preserved: false };
}
