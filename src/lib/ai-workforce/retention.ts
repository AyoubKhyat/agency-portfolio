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
 *    (its notes go with it) and the notifications that point at it, which hold the lead's name and note
 *    excerpts, in one transaction, with an audit entry that holds only IDs and counts.
 *
 * Everything here is idempotent: a second pass finds nothing left to change.
 * Nothing in the app calls this module. Only the owner-run scripts in scripts/ do.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { STALE_RUN_MS } from "./controls";
import { CONTENT_RETENTION_DAYS, SENT_WORDING_RETENTION_MONTHS } from "./retention-policy";
import { parseDiagnosisMessage } from "../diagnosis";

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

export type ErasurePlan = { found: boolean; runs: number; notes: number; notifications: number; runsInFlight: number };

/**
 * Notifications about a lead link to its admin page: new-lead alerts (with the lead's name) and @mentions
 * in its notes (with the name and an excerpt). Matches that exact link, or it followed by ? or #, and never
 * another lead whose id merely starts with this one.
 */
export function leadNotificationWhere(leadId: string): Prisma.NotificationWhereInput {
  const link = `/admin/leads/${leadId}`;
  return { OR: [{ link }, { link: { startsWith: `${link}?` } }, { link: { startsWith: `${link}#` } }] };
}

export async function planLeadErasure(db: Pick<PrismaClient, "lead" | "aiRun" | "leadNote" | "notification">, leadId: string, now = new Date()): Promise<ErasurePlan> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { found: false, runs: 0, notes: 0, notifications: 0, runsInFlight: 0 };
  const [runs, notes, notifications, runsInFlight] = await Promise.all([
    db.aiRun.count({ where: { leadId } }),
    db.leadNote.count({ where: { leadId } }),
    db.notification.count({ where: leadNotificationWhere(leadId) }),
    db.aiRun.count({ where: { leadId, status: "RUNNING", createdAt: { gte: new Date(now.getTime() - STALE_RUN_MS) } } }),
  ]);
  return { found: true, runs, notes, notifications, runsInFlight };
}

export type ErasureResult =
  | { ok: true; runsCleared: number; notesDeleted: number; notificationsDeleted: number }
  | { ok: false; code: "not_found" | "run_in_progress" };

/**
 * Erases an enquiry: clears and unlinks its runs, then deletes the lead, its notes and the notifications
 * pointing at it, all or nothing.
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
    const notifications = await tx.notification.deleteMany({ where: leadNotificationWhere(leadId) });
    await tx.lead.delete({ where: { id: leadId } });
    await tx.auditLog.create({
      data: {
        userId: owner.userId, userName: owner.fullName, action: "ERASE_LEAD", entity: "lead", entityId: leadId,
        details: JSON.stringify({ aiRunsCleared: cleared.count, notesDeleted: plan.notes, notificationsDeleted: notifications.count }),
      },
    });
    return { ok: true, runsCleared: cleared.count, notesDeleted: plan.notes, notificationsDeleted: notifications.count } as const;
  }, { maxWait: 10_000, timeout: 15_000 });
}

/* ───────────────── Possible copies (report only) ───────────────── */

/**
 * Hosts shared by many unrelated sites. A lead whose "site" is a page on one of these can't be matched by
 * domain without flagging every prospect that also uses it, so the domain check is skipped for them.
 */
export const SHARED_HOSTS = new Set([
  "facebook.com", "m.facebook.com", "fb.com", "instagram.com", "wa.me", "whatsapp.com", "api.whatsapp.com",
  "linktr.ee", "tiktok.com", "youtube.com", "google.com", "maps.google.com", "goo.gl", "maps.app.goo.gl",
  "sites.google.com", "linkedin.com", "x.com", "twitter.com",
]);

/** Hostname without "www.", lowercased. Same rule as duplicate detection. */
export function hostKey(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** The last 9 digits, so +212 6…, 06… and wa.me/2126… all compare equal. Same rule as duplicate detection. */
export function phoneKey(s: string | null | undefined): string | null {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : null;
}

const emailKey = (s: string | null | undefined) => {
  const e = (s ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};

export type MatchedBy = "email" | "phone" | "domain";
export type PossibleCopies = {
  prospects: { id: string; matchedBy: MatchedBy[] }[];
  clients: { id: string; matchedBy: MatchedBy[] }[];
  chatMessages: { id: string; channelId: string }[];
  /** True when the lead's site is on a shared host, so no domain match was attempted. */
  domainSkipped: boolean;
};

/**
 * Records stored separately that may be the same person: prospects and clients with the lead's email, phone
 * or website domain, and chat messages containing its email. Nothing is linked to the lead, so erasure can't
 * reach them by itself; the owner reviews each one. Returns identifiers and match kinds only, never values.
 * Read-only: it never changes or deletes anything. Call it before the lead is erased.
 */
export async function findPossibleCopies(
  db: Pick<PrismaClient, "lead" | "aiRun" | "prospect" | "client" | "chatMessage">,
  leadId: string,
): Promise<PossibleCopies | null> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { email: true, phone: true, message: true } });
  if (!lead) return null;
  const runs = await db.aiRun.findMany({ where: { leadId }, select: { targetUrl: true, finalUrl: true } });

  const email = emailKey(lead.email);
  const phone = phoneKey(lead.phone);
  const allHosts = new Set(
    [parseDiagnosisMessage(lead.message)?.siteUrl, ...runs.flatMap((r) => [r.targetUrl, r.finalUrl])]
      .map(hostKey).filter((h): h is string => h !== null),
  );
  const hosts = new Set([...allHosts].filter((h) => !SHARED_HOSTS.has(h)));

  const match = (r: { email: string; website: string; phones: string[] }): MatchedBy[] => {
    const by: MatchedBy[] = [];
    if (email && emailKey(r.email) === email) by.push("email");
    if (phone && r.phones.some((p) => phoneKey(p) === phone)) by.push("phone");
    const h = hostKey(r.website);
    if (h && hosts.has(h)) by.push("domain");
    return by;
  };

  const [prospects, clients, chatMessages] = await Promise.all([
    db.prospect.findMany({ select: { id: true, email: true, phone: true, whatsappLink: true, website: true } }),
    db.client.findMany({ select: { id: true, email: true, phone: true, whatsapp: true, website: true } }),
    email
      ? db.chatMessage.findMany({ where: { content: { contains: email, mode: "insensitive" } }, select: { id: true, channelId: true }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  return {
    prospects: prospects
      .map((p) => ({ id: p.id, matchedBy: match({ email: p.email, website: p.website, phones: [p.phone, p.whatsappLink] }) }))
      .filter((p) => p.matchedBy.length > 0),
    clients: clients
      .map((c) => ({ id: c.id, matchedBy: match({ email: c.email, website: c.website, phones: [c.phone, c.whatsapp] }) }))
      .filter((c) => c.matchedBy.length > 0),
    chatMessages,
    domainSkipped: allHosts.size > 0 && hosts.size === 0,
  };
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
