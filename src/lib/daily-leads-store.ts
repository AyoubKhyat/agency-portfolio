/**
 * Daily Lead Agent storage on the existing tables (no migration):
 *   DiscoverySweep  — one row per Casablanca day, id `daily-agent-YYYY-MM-DD`, provider and sector "DAILY_AGENT"
 *                     (so the legacy Prospect Discovery coverage, which reads sweeps by sector, ignores it).
 *                     `keyword` holds JSON: the sector cursors, run counts and each lead's evidence.
 *                     Rounds 2 and 3 of a day (manual Continue) are rows of their own: `daily-agent-YYYY-MM-DD-r2`, `-r3`.
 *   DiscoveryResult — one row per lead, linked to that sweep. The AI text fields stay empty: nothing here is AI.
 * The primary key is the lock: only one run can create a round, and finishing re-checks that its claim still holds.
 */
import { prisma } from "@/lib/prisma";
import {
  AGENT, AGENT_CITY, EMPTY_STATE, LostClaimError, MAX_ROUNDS, STALE_RUN_MS, continuationOf, runId, runQuery,
  type AgentState, type ClaimResult, type Continuation, type DailyLead, type DailyStore, type DayRound, type Evaluated,
  type RunOutcome, type RunStats,
} from "@/lib/daily-leads";

type SweepJson = { state: AgentState; stats: RunStats | null; leads?: Record<string, DailyLead>; evaluated?: Evaluated };

/** The day's possible round ids, round 1 first. */
const roundIds = (day: string) => Array.from({ length: MAX_ROUNDS }, (_, i) => runId(day, i + 1));
const roundOf = (day: string, id: string) => roundIds(day).indexOf(id) + 1;
const statusOf = (s: string): DayRound["status"] => (s === "COMPLETED" || s === "RUNNING" ? s : "FAILED");

function toDayRound(day: string, row: { id: string; status: string; startedAt: Date; keyword: string | null }): DayRound {
  const json = parseSweepJson(row.keyword);
  const leads = Object.values(json?.leads ?? {});
  return {
    round: roundOf(day, row.id),
    status: statusOf(row.status),
    startedAt: row.startedAt,
    leads: leads.length,
    noWebsiteLeads: leads.filter((l) => l.kind === "NO_WEBSITE").length,
    exhausted: json?.stats?.exhausted === true,
    // Days saved before rounds existed have no list; their cursors already moved past what they checked.
    evaluated: { osmIds: json?.evaluated?.osmIds ?? [], sites: json?.evaluated?.sites ?? [] },
  };
}

export function parseSweepJson(raw: string | null | undefined): SweepJson | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as SweepJson;
    if (j?.state?.v !== 1 || typeof j.state.cursors !== "object" || j.state.cursors === null) return null;
    return j;
  } catch {
    return null;
  }
}

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const OSM_PREFIX = "https://www.openstreetmap.org/";

export const prismaDailyStore: DailyStore = {
  async dayRounds(day) {
    const rows = await prisma.discoverySweep.findMany({
      where: { id: { in: roundIds(day) }, provider: AGENT },
      select: { id: true, status: true, startedAt: true, keyword: true },
    });
    return rows.map((r) => toDayRound(day, r)).sort((a, b) => a.round - b.round);
  },

  async claim(day, round, now, { retry }): Promise<ClaimResult> {
    const id = runId(day, round);
    try {
      await prisma.discoverySweep.create({
        data: { id, provider: AGENT, city: AGENT_CITY, sector: AGENT, query: runQuery(day, round), status: "RUNNING", startedAt: now },
      });
      return { claimed: true, startedAt: now };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
    const cur = await prisma.discoverySweep.findUnique({ where: { id }, select: { status: true, startedAt: true } });
    if (!cur) return { claimed: false, status: "RUNNING" };
    if (cur.status === "COMPLETED") return { claimed: false, status: "COMPLETED" };
    const stale = cur.status === "RUNNING" && now.getTime() - cur.startedAt.getTime() > STALE_RUN_MS;
    const retryable = cur.status !== "RUNNING" && retry;
    if (!stale && !retryable) return { claimed: false, status: cur.status === "RUNNING" ? "RUNNING" : "FAILED" };
    // Take over only if nobody else did in between.
    const taken = await prisma.discoverySweep.updateMany({
      where: { id, status: cur.status, startedAt: cur.startedAt },
      data: { status: "RUNNING", startedAt: now, completedAt: null, error: null },
    });
    return taken.count === 1 ? { claimed: true, startedAt: now } : { claimed: false, status: "RUNNING" };
  },

  async lastState() {
    const rows = await prisma.discoverySweep.findMany({
      where: { provider: AGENT, keyword: { not: null } },
      orderBy: { startedAt: "desc" },
      select: { keyword: true },
      take: 5,
    });
    for (const r of rows) {
      const j = parseSweepJson(r.keyword);
      if (j) return j.state;
    }
    return EMPTY_STATE;
  },

  async shown() {
    const rows = await prisma.discoveryResult.findMany({
      where: { sweep: { provider: AGENT } },
      select: { sourceUrl: true, website: true },
      take: 20_000,
    });
    const { siteKey } = await import("@/lib/discovery-duplicates");
    const osmIds = new Set<string>();
    const sites = new Set<string>();
    for (const r of rows) {
      if (r.sourceUrl.startsWith(OSM_PREFIX)) osmIds.add(r.sourceUrl.slice(OSM_PREFIX.length));
      const k = r.website ? siteKey(r.website) : null;
      if (k) sites.add(k);
    }
    return { osmIds, sites };
  },

  async finish(day, round, startedAt, outcome: RunOutcome, now) {
    const id = runId(day, round);
    const json: SweepJson = outcome.status === "COMPLETED"
      ? {
        state: outcome.state, stats: outcome.stats, leads: Object.fromEntries(outcome.leads.map((l) => [l.osmId, l])),
        ...(outcome.evaluated ? { evaluated: outcome.evaluated } : {}),
      }
      : { state: outcome.state, stats: outcome.stats };
    await prisma.$transaction(async (tx) => {
      const done = await tx.discoverySweep.updateMany({
        where: { id, status: "RUNNING", startedAt },
        data: {
          status: outcome.status, completedAt: now, keyword: JSON.stringify(json),
          error: outcome.status === "FAILED" ? outcome.error : null,
          resultCount: outcome.status === "COMPLETED" ? outcome.leads.length : 0,
          uniqueCount: outcome.stats?.checked ?? 0,
          duplicateCount: outcome.stats ? outcome.stats.skipped.inCrm + outcome.stats.skipped.possibleDuplicate + outcome.stats.skipped.shownBefore : 0,
        },
      });
      if (done.count !== 1) throw new LostClaimError("the day was taken over by another run");
      if (outcome.status !== "COMPLETED" || outcome.leads.length === 0) return;
      await tx.discoveryResult.createMany({ data: outcome.leads.map((l) => resultRow(id, l)) });
    });
  },
};

function resultRow(sweepId: string, l: DailyLead) {
  const wa = l.contacts.find((c) => c.channel === "WHATSAPP")?.link ?? "";
  const ig = l.contacts.find((c) => c.channel === "INSTAGRAM")?.link ?? "";
  const email = l.contacts.find((c) => c.channel === "EMAIL")?.value ?? "";
  return {
    sweepId, name: l.name, website: l.website, instagram: ig, instagramUrl: ig, whatsappUrl: wa,
    email, emailStatus: email ? "UNVERIFIED" : "MISSING",
    city: "Marrakech", country: "Morocco", sector: l.sector, sourceUrl: l.osmUrl,
    opportunityScore: Math.min(100, Math.max(0, Math.round(l.score))),
    websiteStatus: l.outcome ?? "NOT_LISTED", websiteValid: l.outcome === "COMPLETE", sourceValid: true,
    whatsappStatus: wa ? "UNVERIFIED" : "MISSING", instagramStatus: ig ? "UNVERIFIED" : "MISSING",
    aiProvider: "NONE", duplicateStatus: "NEW",
  };
}

/* ───────────────── Reading for Today ───────────────── */

export type TodayLead = DailyLead & {
  resultId: string;
  importedProspectId: string | null;
  importedAt: string | null;
};

export type TodayRun = {
  round: number;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  stats: RunStats | null;
  stale: boolean;
  /** Leads this round saved. */
  leads: number;
};

export type TodayLeadsView = {
  day: string;
  /** The day's latest round (null when nothing ran yet). */
  run: TodayRun | null;
  /** Every round of the day, round 1 first. */
  rounds: TodayRun[];
  /** Leads of every completed round, round by round, each in the order its run saved them. */
  leads: TodayLead[];
  continuation: Continuation;
};

export async function getTodayLeads(day: string, now = new Date()): Promise<TodayLeadsView> {
  const sweeps = await prisma.discoverySweep.findMany({
    where: { id: { in: roundIds(day) }, provider: AGENT },
    select: {
      id: true, status: true, startedAt: true, completedAt: true, error: true, keyword: true,
      results: {
        select: { id: true, sourceUrl: true, importedProspectId: true, importedAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const sorted = [...sweeps].sort((a, b) => roundOf(day, a.id) - roundOf(day, b.id));
  const rounds: TodayRun[] = [];
  const leads: TodayLead[] = [];
  for (const sweep of sorted) {
    const json = parseSweepJson(sweep.keyword);
    const status = statusOf(sweep.status);
    const own: TodayLead[] = [];
    for (const r of sweep.results) {
      const detail = json?.leads?.[r.sourceUrl.slice(OSM_PREFIX.length)];
      if (!detail) continue;
      own.push({ ...detail, resultId: r.id, importedProspectId: r.importedProspectId, importedAt: r.importedAt?.toISOString() ?? null });
    }
    // Website leads in evidence order first, then the no-website ones, as the run saved them.
    const order = Object.keys(json?.leads ?? {});
    own.sort((a, b) => order.indexOf(a.osmId) - order.indexOf(b.osmId));
    leads.push(...own);
    rounds.push({
      round: roundOf(day, sweep.id), status, startedAt: sweep.startedAt.toISOString(), completedAt: sweep.completedAt?.toISOString() ?? null,
      error: sweep.error, stats: json?.stats ?? null,
      stale: status === "RUNNING" && now.getTime() - sweep.startedAt.getTime() > STALE_RUN_MS,
      leads: own.length,
    });
  }
  return {
    day,
    run: rounds.at(-1) ?? null,
    rounds,
    leads,
    continuation: continuationOf(sorted.map((s) => toDayRound(day, s))),
  };
}

/** The candidate the existing import route expects, rebuilt from what the run saved (explicit links only). */
export function importCandidate(l: DailyLead) {
  return {
    sourceId: l.osmId, source: "OSM" as const, name: l.name, sector: l.sector, city: "Marrakech", neighborhood: null,
    phone: null, rating: null, reviewCount: null,
    email: l.contacts.find((c) => c.channel === "EMAIL")?.value ?? null,
    website: l.website || null,
    whatsapp: l.contacts.find((c) => c.channel === "WHATSAPP")?.link ?? null,
    instagram: l.contacts.find((c) => c.channel === "INSTAGRAM")?.link ?? null,
    facebook: l.contacts.find((c) => c.channel === "FACEBOOK")?.link ?? null,
    mapsUrl: l.osmUrl,
  };
}

export async function markImported(resultId: string, prospectId: string, by: { userId: string; fullName: string }) {
  const r = await prisma.discoveryResult.updateMany({
    where: { id: resultId, importedProspectId: null, sweep: { provider: AGENT } },
    data: { importedProspectId: prospectId, importedAt: new Date(), importedById: by.userId, importedByName: by.fullName },
  });
  if (r.count === 1) {
    const row = await prisma.discoveryResult.findUnique({ where: { id: resultId }, select: { sweepId: true } });
    if (row?.sweepId) await prisma.discoverySweep.update({ where: { id: row.sweepId }, data: { importedCount: { increment: 1 } } });
  }
  return r.count === 1;
}
