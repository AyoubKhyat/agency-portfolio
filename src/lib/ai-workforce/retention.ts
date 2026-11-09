/**
 * AI Workforce privacy: how long run content is kept, and what erasing an enquiry does to its runs.
 *
 * A run row holds two kinds of data:
 *  - Content about the enquirer or their site: addresses, evidence read from the page, findings, scores,
 *    duplicate matches, drafts and the approved wording (which opens with the visitor's first name).
 *  - Usage metadata: status, model, tokens, cost, timings, error codes, language, channel and which staff
 *    member started, approved or confirmed it. Spend caps are counted from these rows, so rows are never
 *    deleted: deleting them would hand back budget and daily slots.
 *
 * Rules (approved for P5A):
 *  - After CONTENT_RETENTION_DAYS, content is cleared from every run. Runs a person could still act on
 *    become EXPIRED, which every action refuses and which still counts towards the caps.
 *  - The approved wording of a SENT run is kept for SENT_WORDING_RETENTION_MONTHS, then cleared.
 *  - Erasing an enquiry clears all content and wording from its runs, unlinks them and deletes the lead
 *    (its notes go with it), in one transaction, with an audit entry that holds only IDs and counts.
 *
 * Everything here is idempotent: a second pass finds nothing left to change.
 * Nothing in the app calls this module. Only the owner-run scripts in scripts/ do.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { STALE_RUN_MS } from "./controls";
import { CONTENT_RETENTION_DAYS, SENT_WORDING_RETENTION_MONTHS } from "./retention-policy";

export { CONTENT_RETENTION_DAYS, SENT_WORDING_RETENTION_MONTHS };
export const EXPIRED = "EXPIRED";
/** Statuses a person can still edit, approve, discard or send. */
export const ACTIONABLE_STATUSES = ["AUDIT_ONLY", "DRAFT_READY", "APPROVED"] as const;
/** Same lock as reserveRun, so an erasure and a run starting can't interleave. */
const BUDGET_LOCK = 7302;

/** Content about the enquirer or their site. Cleared after 90 days and on erasure. */
export const REDACTED_CONTENT_FIELDS = [
  "targetUrl", "finalUrl", "evidence", "findings", "gapScore", "fitLabel",
  "duplicateStatus", "duplicateReason", "duplicateProspectId", "draftSubject", "draftBody", "errorDetail",
] as const;
/** The wording a person approved. Cleared after 90 days unless SENT, after 12 months if SENT, and on erasure. */
export const REDACTED_WORDING_FIELDS = ["approvedSubject", "approvedBody"] as const;
/** Kept on every run: usage, spend and accountability. leadId is cleared only by erasure. */
export const RETAINED_FIELDS = [
  "id", "agent", "status", "leadId", "draftLanguage", "channel", "model", "promptVersion",
  "inputTokens", "outputTokens", "reservedMicros", "costMicros", "durationMs", "errorCode",
  "startedById", "startedByName", "approvedById", "approvedByName", "approvedAt",
  "sentConfirmedById", "sentConfirmedByName", "sentConfirmedAt", "createdAt", "updatedAt",
] as const;

/** targetUrl is required, so a cleared run has an empty one. That is also how a cleared run is recognised. */
const CLEARED_CONTENT = {
  targetUrl: "", finalUrl: null, evidence: [], findings: Prisma.DbNull, gapScore: null, fitLabel: null,
  duplicateStatus: null, duplicateReason: null, duplicateProspectId: null, draftSubject: null, draftBody: null, errorDetail: null,
} satisfies Prisma.AiRunUpdateManyMutationInput;
const CLEARED_WORDING = { approvedSubject: null, approvedBody: null } satisfies Prisma.AiRunUpdateManyMutationInput;

export const isRedacted = (run: { targetUrl: string }) => run.targetUrl === "";

/** The same instant N calendar months earlier, in UTC. A day that doesn't exist rolls back to the month's last day. */
export function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Runs created strictly before these instants are due. A run exactly at the cutoff waits for the next pass. */
export function retentionCutoffs(now: Date) {
  return {
    content: new Date(now.getTime() - CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    sentWording: monthsBefore(now, SENT_WORDING_RETENTION_MONTHS),
  };
}

function retentionWhere(now: Date) {
  const { content, sentWording } = retentionCutoffs(now);
  const old = { createdAt: { lt: content } };
  const hasWording = { OR: [{ approvedSubject: { not: null } }, { approvedBody: { not: null } }] };
  return {
    expire: { ...old, status: { in: [...ACTIONABLE_STATUSES] } },
    content: { ...old, targetUrl: { not: "" } },
    unsentWording: { ...old, status: { not: "SENT" }, ...hasWording },
    sentWording: { createdAt: { lt: sentWording }, status: "SENT", ...hasWording },
  } satisfies Record<string, Prisma.AiRunWhereInput>;
}

export type RetentionCounts = { expired: number; contentCleared: number; unsentWordingCleared: number; sentWordingCleared: number };
type Db = Pick<PrismaClient, "aiRun" | "$transaction">;

/**
 * Clears content that has passed its retention period. Dry run unless `apply` is true: then it only counts.
 * Expiry runs first, so nothing can be approved or sent between being expired and being cleared.
 */
export async function applyRetention(db: Db, opts: { now?: Date; apply?: boolean } = {}): Promise<{ applied: boolean; counts: RetentionCounts; cutoffs: ReturnType<typeof retentionCutoffs> }> {
  const now = opts.now ?? new Date();
  const where = retentionWhere(now);
  const cutoffs = retentionCutoffs(now);
  if (!opts.apply) {
    const [expired, contentCleared, unsentWordingCleared, sentWordingCleared] = await Promise.all([
      db.aiRun.count({ where: where.expire }),
      db.aiRun.count({ where: where.content }),
      db.aiRun.count({ where: where.unsentWording }),
      db.aiRun.count({ where: where.sentWording }),
    ]);
    return { applied: false, cutoffs, counts: { expired, contentCleared, unsentWordingCleared, sentWordingCleared } };
  }
  const [expired, content, unsent, sent] = await db.$transaction([
    db.aiRun.updateMany({ where: where.expire, data: { status: EXPIRED } }),
    db.aiRun.updateMany({ where: where.content, data: CLEARED_CONTENT }),
    db.aiRun.updateMany({ where: where.unsentWording, data: CLEARED_WORDING }),
    db.aiRun.updateMany({ where: where.sentWording, data: CLEARED_WORDING }),
  ]);
  return { applied: true, cutoffs, counts: { expired: expired.count, contentCleared: content.count, unsentWordingCleared: unsent.count, sentWordingCleared: sent.count } };
}

/* ───────────────── Erasure ───────────────── */

export type Owner = { userId: string; fullName: string };
export type OwnerCheck = { ok: true; owner: Owner } | { ok: false; reason: string };

/** The same rule as isOwner: OWNER_USER_ID names an active user whose email matches the one given. */
export async function verifyOwner(db: Pick<PrismaClient, "user">, email: string, ownerUserId: string | undefined): Promise<OwnerCheck> {
  const id = ownerUserId?.trim();
  if (!id) return { ok: false, reason: "OWNER_USER_ID is not set" };
  if (!email.trim()) return { ok: false, reason: "--owner <email> is required" };
  const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, fullName: true, isActive: true } });
  if (!user || !user.isActive || user.email !== email.trim()) return { ok: false, reason: "that email is not the active owner account" };
  return { ok: true, owner: { userId: user.id, fullName: user.fullName } };
}

export type ErasurePlan = { found: boolean; runs: number; notes: number; runsInFlight: number };

export async function planLeadErasure(db: Pick<PrismaClient, "lead" | "aiRun" | "leadNote">, leadId: string, now = new Date()): Promise<ErasurePlan> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { found: false, runs: 0, notes: 0, runsInFlight: 0 };
  const [runs, notes, runsInFlight] = await Promise.all([
    db.aiRun.count({ where: { leadId } }),
    db.leadNote.count({ where: { leadId } }),
    db.aiRun.count({ where: { leadId, status: "RUNNING", createdAt: { gte: new Date(now.getTime() - STALE_RUN_MS) } } }),
  ]);
  return { found: true, runs, notes, runsInFlight };
}

export type ErasureResult =
  | { ok: true; runsCleared: number; notesDeleted: number }
  | { ok: false; code: "not_found" | "run_in_progress" };

/**
 * Erases an enquiry: clears and unlinks its runs, then deletes the lead and its notes, all or nothing.
 * Spend stays counted because the run rows, their cost and their status (EXPIRED still counts) remain.
 * Refused while a run for this lead may still be writing its result, which would put content back.
 */
export async function eraseLead(db: PrismaClient, leadId: string, owner: Owner, now = new Date()): Promise<ErasureResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BUDGET_LOCK}::int)`;
    const plan = await planLeadErasure(tx, leadId, now);
    if (!plan.found) return { ok: false, code: "not_found" } as const;
    if (plan.runsInFlight > 0) return { ok: false, code: "run_in_progress" } as const;

    await tx.aiRun.updateMany({ where: { leadId, status: { in: [...ACTIONABLE_STATUSES] } }, data: { status: EXPIRED } });
    const cleared = await tx.aiRun.updateMany({ where: { leadId }, data: { ...CLEARED_CONTENT, ...CLEARED_WORDING, leadId: null } });
    await tx.lead.delete({ where: { id: leadId } });
    await tx.auditLog.create({
      data: {
        userId: owner.userId, userName: owner.fullName, action: "ERASE_LEAD", entity: "lead", entityId: leadId,
        details: JSON.stringify({ aiRunsCleared: cleared.count, notesDeleted: plan.notes }),
      },
    });
    return { ok: true, runsCleared: cleared.count, notesDeleted: plan.notes } as const;
  }, { maxWait: 10_000, timeout: 15_000 });
}

/* ───────────────── Script safety ───────────────── */

export const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Scripts only touch a local database unless the exact remote host is named on the command line. */
export function checkMaintenanceDb(url: string, allowRemoteHost?: string): { ok: true; host: string; remote: boolean } | { ok: false; reason: string } {
  if (!url) return { ok: false, reason: "AI_PRIVACY_DATABASE_URL is not set (these scripts never read DATABASE_URL)" };
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: "AI_PRIVACY_DATABASE_URL is not a valid URL" };
  }
  if (LOCAL_DB_HOSTS.has(host)) return { ok: true, host, remote: false };
  if (allowRemoteHost && allowRemoteHost === host) return { ok: true, host, remote: true };
  return { ok: false, reason: `refusing non-local database host "${host}"; pass --allow-remote-host=${host} only with explicit approval` };
}
