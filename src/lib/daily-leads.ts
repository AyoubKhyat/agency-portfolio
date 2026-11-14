/**
 * Daily Lead Agent v1: once per Casablanca day, up to 5 Marrakech businesses worth a look, saved for Today.
 *
 * What it does, in order:
 *   1. Claims the day (one DiscoverySweep row whose id is the day, so a double cron call or a retry can't
 *      run it twice or save twice).
 *   2. Picks 3 sectors by rotation and carries on from where each sector's list stopped last time.
 *   3. Uses P6C's search (private OSM list, CRM duplicates left out), skips anything an earlier day showed,
 *      and checks at most 12 websites with P6A's safe check, within a time limit.
 *   4. Keeps the businesses whose site was read completely and has at least one problem a customer would
 *      notice (P6C ranking), and up to 2 businesses with no website in the OSM list but an explicit
 *      WhatsApp or Instagram tag. A site that couldn't be read is never ranked as having problems.
 *   5. Saves them as DiscoveryResult rows of that sweep.
 *
 * What it never does: write Prospect rows, verify or invent a contact (WhatsApp only from an explicit link,
 * always UNVERIFIED), call an AI provider or a paid API, or send anything. Import, contact checks and outreach
 * stay manual.
 */
import { SECTORS } from "@/lib/discovery-providers";
import { classify, siteKey } from "@/lib/discovery-duplicates";
import { explicitWhatsAppLink } from "@/lib/contact-check";
import { toCandidate, type OsmDataset, type OsmEntry } from "@/lib/osm-dataset";
import {
  AUDIT_CHUNK, auditChunk, rankTop, searchBatch, sectorEntries, type AuditedCandidate, type BatchCandidate, type CrmRow,
} from "@/lib/batch-discovery";
import type { SafeFetch } from "@/lib/website-audit/safe-fetch";

export const AGENT = "DAILY_AGENT";
export const AGENT_CITY = "MARRAKECH";
export const SECTORS_PER_DAY = 3;
export const MAX_SITE_CHECKS = 12;
export const MAX_LEADS = 5;
export const MAX_NO_WEBSITE = 2;
/** No new site check starts after this; checks already running finish within their own timeouts. */
export const CHECK_DEADLINE_MS = 180_000;
/** A run still RUNNING after this is treated as crashed (the function limit is 300 s). */
export const STALE_RUN_MS = 6 * 60_000;
export const TIME_ZONE = "Africa/Casablanca";

export const runId = (day: string) => `daily-agent-${day}`;
export const runQuery = (day: string) => `${AGENT}:${day}`;

/** The calendar day in Casablanca (Morocco's own clock, including its Ramadan change), as YYYY-MM-DD. */
export function casablancaDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** SECTORS_PER_DAY sectors for the day, moving on by that many every day, so all sectors take turns. */
export function rotateSectors(day: string, available: readonly string[], n = SECTORS_PER_DAY): string[] {
  if (available.length <= n) return [...available];
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const start = ((dayNumber * n) % available.length + available.length) % available.length;
  return Array.from({ length: n }, (_, i) => available[(start + i) % available.length]);
}

/* ───────────────── Types ───────────────── */

/** cursors: where each sector's website checks carry on. noSiteCursors: where its no-website scan carries on. */
export type AgentState = { v: 1; cursors: Record<string, number>; noSiteCursors?: Record<string, number> };
export const EMPTY_STATE: AgentState = { v: 1, cursors: {} };
/** The no-website scan reads only the local list (no request), but still stops somewhere. */
export const NO_WEBSITE_SCAN = 500;

export type LeadFinding = { id: string; sentence: string; observed: string; sourceUrl: string; fetchedAt: string };
export type LeadContact = { channel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK"; link: string; source: "OSM_TAG" | "WEBSITE"; sourceUrl: string };

export type DailyLead = {
  kind: "WEBSITE" | "NO_WEBSITE";
  osmId: string;
  osmUrl: string;
  name: string;
  sector: string;
  /** The site from the OSM list; "" for a NO_WEBSITE lead. */
  website: string;
  finalUrl: string | null;
  /** P6A outcome for a WEBSITE lead (always COMPLETE: anything else is never a lead); null for NO_WEBSITE. */
  outcome: string | null;
  findings: LeadFinding[];
  score: number;
  /** Explicit links only, never built from a phone number. Nobody has opened them: always unverified. */
  contacts: LeadContact[];
  whatsappConfidence: "HIGH" | "MEDIUM" | "CONFLICT" | "NONE";
  checkedAt: string;
};

export type RunStats = {
  sectors: string[];
  checked: number;
  outcomes: Record<string, number>;
  skipped: { noWebsite: number; platformOnly: number; inCrm: number; possibleDuplicate: number; sameSiteInBatch: number; shownBefore: number };
  noWebsiteWithContact: number;
  sectorErrors: string[];
  stoppedEarly: boolean;
};

export type RunOutcome =
  | { status: "COMPLETED"; state: AgentState; stats: RunStats; leads: DailyLead[] }
  | { status: "FAILED"; state: AgentState; stats: RunStats | null; error: string };

export type ClaimResult = { claimed: true; startedAt: Date } | { claimed: false; status: "COMPLETED" | "RUNNING" | "FAILED" };

export interface DailyStore {
  /** Claims the day. `retry` lets a person re-run a FAILED day; a COMPLETED day is never run again. */
  claim(day: string, now: Date, opts: { retry: boolean }): Promise<ClaimResult>;
  /** Cursors from the latest run that recorded any. */
  lastState(): Promise<AgentState>;
  /** OSM ids and website keys of every business an earlier day already showed. */
  shown(): Promise<{ osmIds: Set<string>; sites: Set<string> }>;
  /** Saves the outcome, but only while this claim still holds; throws LostClaimError otherwise. */
  finish(day: string, startedAt: Date, outcome: RunOutcome, now: Date): Promise<void>;
}

export class LostClaimError extends Error {}

export type RunDeps = {
  store: DailyStore;
  dataset: () => Promise<OsmDataset>;
  loadCrm: () => Promise<CrmRow[]>;
  fetcher?: SafeFetch;
  now?: () => Date;
  /** Milliseconds, for the time limit. */
  clock?: () => number;
  retry?: boolean;
  deadlineMs?: number;
};

export type RunReport = {
  day: string;
  result: "COMPLETED" | "FAILED" | "ALREADY_COMPLETED" | "ALREADY_RUNNING" | "FAILED_NEEDS_RETRY";
  leads: number;
  checked: number;
  error?: string;
};

/* ───────────────── Pure selection helpers ───────────────── */

/** An entry with no website in the list but at least one explicit, public contact link the mapper added. */
export function contactOnly(e: OsmEntry): boolean {
  return !e.website && !!(explicitWhatsAppLink(e.whatsapp) || e.instagram);
}

function osmContacts(e: OsmEntry, osmUrl: string): LeadContact[] {
  const out: LeadContact[] = [];
  const wa = explicitWhatsAppLink(e.whatsapp);
  if (wa) out.push({ channel: "WHATSAPP", link: wa, source: "OSM_TAG", sourceUrl: osmUrl });
  if (e.instagram) out.push({ channel: "INSTAGRAM", link: e.instagram, source: "OSM_TAG", sourceUrl: osmUrl });
  if (e.facebook) out.push({ channel: "FACEBOOK", link: e.facebook, source: "OSM_TAG", sourceUrl: osmUrl });
  return out;
}

/** Duplicate check for a business with no website: name, Instagram, and its WhatsApp number against CRM phones. */
export function noWebsiteStatus(e: OsmEntry, sector: string, crm: CrmRow[]) {
  const c = toCandidate(e, sector);
  const wa = explicitWhatsAppLink(e.whatsapp);
  // The number is used only to recognise a business already in the CRM; it is never saved as a phone.
  return classify({ ...c, website: null, phone: wa ? `+${wa.replace(/\D/g, "")}` : null }, crm).status;
}

/** Strongest explicit evidence first: WhatsApp and Instagram, then WhatsApp, then Instagram; then by name. */
export function rankNoWebsite<T extends { entry: OsmEntry; sector: string }>(entries: T[]): T[] {
  const weight = (e: OsmEntry) => (explicitWhatsAppLink(e.whatsapp) ? 2 : 0) + (e.instagram ? 1 : 0);
  return [...entries].sort((a, b) => weight(b.entry) - weight(a.entry) || a.entry.name.localeCompare(b.entry.name));
}

/** Round robin across sectors, so one big sector can't use all the checks. */
export function interleave<T>(lists: T[][], max: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length && out.length < max) out.push(l[i]);
  }
  return out;
}

function websiteLead(a: AuditedCandidate): DailyLead {
  const contacts: LeadContact[] = a.whatsapp.link
    ? [{ channel: "WHATSAPP", link: a.whatsapp.link, source: a.whatsapp.sources[0].kind, sourceUrl: a.whatsapp.sources[0].url }]
    : [];
  if (a.candidate.instagram) contacts.push({ channel: "INSTAGRAM", link: a.candidate.instagram, source: "OSM_TAG", sourceUrl: a.candidate.mapsUrl ?? "" });
  if (a.candidate.facebook) contacts.push({ channel: "FACEBOOK", link: a.candidate.facebook, source: "OSM_TAG", sourceUrl: a.candidate.mapsUrl ?? "" });
  return {
    kind: "WEBSITE", osmId: a.candidate.sourceId, osmUrl: a.candidate.mapsUrl ?? `https://www.openstreetmap.org/${a.candidate.sourceId}`,
    name: a.candidate.name, sector: a.candidate.sector, website: a.candidate.website, finalUrl: a.finalUrl, outcome: a.outcome,
    findings: a.findings.map((f) => ({ id: f.id, sentence: f.sentence, observed: f.observed, sourceUrl: f.sourceUrl, fetchedAt: f.fetchedAt })),
    score: a.score, contacts, whatsappConfidence: a.whatsapp.confidence, checkedAt: a.auditedAt,
  };
}

function noWebsiteLead(e: OsmEntry, sector: string, at: string): DailyLead {
  const osmUrl = `https://www.openstreetmap.org/${e.id}`;
  return {
    kind: "NO_WEBSITE", osmId: e.id, osmUrl, name: e.name, sector, website: "", finalUrl: null, outcome: null,
    findings: [], score: 0, contacts: osmContacts(e, osmUrl),
    whatsappConfidence: explicitWhatsAppLink(e.whatsapp) ? "MEDIUM" : "NONE", checkedAt: at,
  };
}

/* ───────────────── The run ───────────────── */

const PUBLIC_ERRORS = {
  dataset: "The Marrakech business list couldn't be read, so nothing was searched.",
  crm: "The CRM couldn't be read, so duplicates couldn't be ruled out. Nothing was saved.",
  empty: "The Marrakech business list has no businesses in any sector.",
  unexpected: "Something went wrong while preparing today's leads. Nothing was saved.",
} as const;

export async function runDailyLeads(deps: RunDeps): Promise<RunReport> {
  const now = deps.now ?? (() => new Date());
  const clock = deps.clock ?? (() => Date.now());
  const deadline = deps.deadlineMs ?? CHECK_DEADLINE_MS;
  const day = casablancaDay(now());

  const claim = await deps.store.claim(day, now(), { retry: !!deps.retry });
  if (!claim.claimed) {
    const result = claim.status === "COMPLETED" ? "ALREADY_COMPLETED" : claim.status === "RUNNING" ? "ALREADY_RUNNING" : "FAILED_NEEDS_RETRY";
    return { day, result, leads: 0, checked: 0 };
  }
  const started = clock();
  let previous: AgentState = EMPTY_STATE;

  const fail = async (error: string, stats: RunStats | null = null): Promise<RunReport> => {
    await deps.store.finish(day, claim.startedAt, { status: "FAILED", state: previous, stats, error }, now());
    return { day, result: "FAILED", leads: 0, checked: stats?.checked ?? 0, error };
  };

  try {
    previous = await deps.store.lastState();
    let data: OsmDataset;
    try { data = await deps.dataset(); } catch { return await fail(PUBLIC_ERRORS.dataset); }
    let crm: CrmRow[];
    try { crm = await deps.loadCrm(); } catch { return await fail(PUBLIC_ERRORS.crm); }
    const shown = await deps.store.shown();

    const available = SECTORS.map((s) => s.key).filter((k) => sectorEntries(data, k).length > 0);
    if (available.length === 0) return await fail(PUBLIC_ERRORS.empty);
    const sectors = rotateSectors(day, available);

    const stats: RunStats = {
      sectors, checked: 0, outcomes: {},
      skipped: { noWebsite: 0, platformOnly: 0, inCrm: 0, possibleDuplicate: 0, sameSiteInBatch: 0, shownBefore: 0 },
      noWebsiteWithContact: 0, sectorErrors: [], stoppedEarly: false,
    };
    const isShown = (osmId: string, website: string | null) => shown.osmIds.has(osmId) || (!!website && shown.sites.has(siteKey(website) ?? ""));

    // 1. Search each sector from its cursor (P6C: CRM matches and possible duplicates already left out).
    type SectorWork = { sector: string; list: OsmEntry[]; from: number; to: number; end: boolean; toCheck: BatchCandidate[] };
    const work: SectorWork[] = [];
    for (const sector of sectors) {
      const list = sectorEntries(data, sector);
      const saved = previous.cursors[sector] ?? 0;
      const from = saved >= 0 && saved < list.length ? saved : 0;
      const summary = await searchBatch(sector, from, { dataset: async () => data, loadCrm: async () => crm });
      if (summary.sourceError) { stats.sectorErrors.push(`${sector}: ${summary.sourceError}`); continue; }
      for (const k of Object.keys(summary.skipped) as (keyof typeof summary.skipped)[]) stats.skipped[k] += summary.skipped[k];
      const toCheck = summary.candidates.filter((c) => {
        if (!isShown(c.sourceId, c.website)) return true;
        stats.skipped.shownBefore++;
        return false;
      });
      work.push({ sector, list, from: summary.progress.from, to: summary.progress.to, end: summary.progress.nextCursor === null, toCheck });
    }

    // 2. Check at most MAX_SITE_CHECKS sites, sectors taking turns, a few at a time, within the time limit.
    const queue = interleave(work.map((w) => w.toCheck), MAX_SITE_CHECKS);
    const audited: AuditedCandidate[] = [];
    for (let i = 0; i < queue.length; i += AUDIT_CHUNK) {
      if (clock() - started > deadline) { stats.stoppedEarly = true; break; }
      audited.push(...await auditChunk(queue.slice(i, i + AUDIT_CHUNK), { fetcher: deps.fetcher, loadCrm: async () => crm }));
    }
    stats.checked = audited.length;
    for (const a of audited) stats.outcomes[a.outcome] = (stats.outcomes[a.outcome] ?? 0) + 1;
    const checkedIds = new Set(audited.map((a) => a.candidate.sourceId));

    // 3. Where each sector's website checks carry on: at the first site not checked, else after what it looked at.
    const cursors: Record<string, number> = { ...previous.cursors };
    for (const w of work) {
      const firstUnchecked = w.toCheck.find((c) => !checkedIds.has(c.sourceId));
      cursors[w.sector] = firstUnchecked ? w.list.findIndex((e) => e.id === firstUnchecked.sourceId) : w.end ? 0 : w.to;
    }

    // 4. Businesses with no website but an explicit contact tag: their own scan (no request is made for them).
    //    Up to MAX_NO_WEBSITE per sector are collected; the ones not picked today are looked at again next time.
    const noSiteCursors: Record<string, number> = { ...(previous.noSiteCursors ?? {}) };
    const collected: { entry: OsmEntry; sector: string; index: number }[] = [];
    const scanEnd: Record<string, number> = {};
    for (const w of work) {
      const saved = noSiteCursors[w.sector] ?? 0;
      let i = saved >= 0 && saved < w.list.length ? saved : 0;
      let found = 0;
      const stop = Math.min(w.list.length, i + NO_WEBSITE_SCAN);
      for (; i < stop && found < MAX_NO_WEBSITE; i++) {
        const entry = w.list[i];
        if (!contactOnly(entry) || isShown(entry.id, null)) continue;
        if (noWebsiteStatus(entry, w.sector, crm) !== "NEW") continue;
        if (collected.some((n) => n.entry.id === entry.id)) continue;
        collected.push({ entry, sector: w.sector, index: i });
        found++;
      }
      scanEnd[w.sector] = i >= w.list.length ? 0 : i;
    }
    stats.noWebsiteWithContact = collected.length;
    const pickedNoSite = rankNoWebsite(collected).slice(0, MAX_NO_WEBSITE);
    for (const w of work) {
      const left = collected.filter((c) => c.sector === w.sector && !pickedNoSite.includes(c));
      noSiteCursors[w.sector] = left.length > 0 ? Math.min(...left.map((c) => c.index)) : scanEnd[w.sector];
    }

    // 5. Evidence first: read completely, not in the CRM, at least one customer-facing problem.
    const at = now().toISOString();
    const noSite = pickedNoSite.map((n) => noWebsiteLead(n.entry, n.sector, at));
    const withSite = rankTop(audited).slice(0, MAX_LEADS - noSite.length).map(websiteLead);
    const leads = [...withSite, ...noSite];

    await deps.store.finish(day, claim.startedAt, { status: "COMPLETED", state: { v: 1, cursors, noSiteCursors }, stats, leads }, now());
    return { day, result: "COMPLETED", leads: leads.length, checked: stats.checked };
  } catch (err) {
    if (err instanceof LostClaimError) throw err;
    console.error("[daily-leads] run failed:", err instanceof Error ? err.name : "error");
    try { return await fail(PUBLIC_ERRORS.unexpected); } catch { return { day, result: "FAILED", leads: 0, checked: 0, error: PUBLIC_ERRORS.unexpected }; }
  }
}
