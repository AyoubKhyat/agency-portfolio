/**
 * First-contact stamping — the one rule that protects the follow-up cadence.
 *
 * `Prospect.sentAt` is the FIRST-contact anchor. Every follow-up bucket
 * (day 4 / 10 / 20) is measured from it. Moving it backwards re-queues a
 * prospect that was already contacted, which is how first-contact outreach
 * gets sent to the same business twice.
 *
 * So: moving a prospect to ENVOYE may only ever stamp `sentAt` when it is
 * currently null. This is expressed as `updateMany` with `sentAt: null` in the
 * WHERE clause, which makes the write a no-op once the anchor exists — and is
 * safe under concurrency, unlike a read-then-write.
 *
 * The writer is passed in rather than imported so the rule can be regression-
 * tested without a database.
 */

/** The narrow slice of PrismaClient these helpers need. */
export type ProspectStatusWriter = {
  prospect: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

import { POST_REPLY_STATUSES, SENT_STATUS } from "./prospect-status-guard";

/** Status that represents "initial outreach has been sent". */
export { SENT_STATUS };

/**
 * WHERE fragment for the status write. A move to ENVOYE must never pull a
 * prospect back out of REPONDU or a later stage (see prospect-status-guard),
 * so those rows are excluded from the write itself — atomic, and safe even
 * if the caller read a stale status.
 */
function statusWriteGuard(status: string): Record<string, unknown> {
  return status === SENT_STATUS ? { status: { notIn: [...POST_REPLY_STATUSES] } } : {};
}

/**
 * Stamp `sentAt` for the given prospect ids, but ONLY where it is still null.
 * Returns how many rows actually received a new anchor.
 */
export async function stampFirstContactIfUnset(
  client: ProspectStatusWriter,
  prospectIds: string[],
  now: Date = new Date(),
): Promise<{ count: number }> {
  if (prospectIds.length === 0) return { count: 0 };
  return client.prospect.updateMany({
    where: { id: { in: prospectIds }, sentAt: null },
    data: { sentAt: now },
  });
}

/**
 * Bulk status change. When moving to ENVOYE, existing first-contact anchors
 * are preserved and only unstamped prospects get one.
 */
export async function bulkUpdateStatusWith(
  client: ProspectStatusWriter,
  prospectIds: string[],
  status: string,
  now: Date = new Date(),
): Promise<{ count: number }> {
  if (prospectIds.length === 0) return { count: 0 };

  if (status === SENT_STATUS) {
    await stampFirstContactIfUnset(client, prospectIds, now);
  }

  // `sentAt` is deliberately NOT in this payload. Post-reply prospects are
  // skipped when the target is ENVOYE, so `count` excludes them.
  return client.prospect.updateMany({
    where: { id: { in: prospectIds }, ...statusWriteGuard(status) },
    data: { status },
  });
}

/** Single-prospect status change with the same anchor guarantee. */
export async function updateProspectStatusWith(
  client: ProspectStatusWriter,
  id: string,
  status: string,
  now: Date = new Date(),
): Promise<unknown> {
  if (status === SENT_STATUS) {
    await stampFirstContactIfUnset(client, [id], now);
    // Guarded write: a no-op when the prospect is already REPONDU or later.
    return client.prospect.updateMany({ where: { id, ...statusWriteGuard(status) }, data: { status } });
  }
  return client.prospect.update({ where: { id }, data: { status } });
}
