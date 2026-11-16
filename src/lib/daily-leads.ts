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
 *      notice, and up to 2 businesses with no website in the OSM list but an explicit WhatsApp or Instagram tag.
 *      A site that couldn't be read is never ranked as having problems. For the best 8 readable sites, the
 *      site's own Contact/About pages are read (robots.txt allowing) for explicit WhatsApp, Instagram and
 *      mailto: links; contactability then breaks ties between comparable problems (lead-contacts.ts).
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
  AUDIT_CHUNK, auditChunk, searchBatch, sectorEntries, type AuditedCandidate, type BatchCandidate, type CrmRow,
} from "@/lib/batch-discovery";
import type { SafeFetch } from "@/lib/website-audit/safe-fetch";
import { contactRank, discoverSiteContacts, type SiteContact } from "@/lib/lead-contacts";
import { issueCopy } from "@/lib/lead-issue-copy";
import { assessIdentity, type Identity } from "@/lib/lead-identity";

export const AGENT = "DAILY_AGENT";
export const AGENT_CITY = "MARRAKECH";
export const SECTORS_PER_DAY = 3;
export const MAX_SITE_CHECKS = 12;
export const MAX_LEADS = 5;
export const MAX_NO_WEBSITE = 2;
/** Best-ranked readable sites whose own pages are read for contacts before the final pick. */
export const CONTACT_POOL = 8;
/** No contact lookup starts after this (the function limit is 300 s). */
export const CONTACT_DEADLINE_MS = 240_000;
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
  return rotationOrder(day, available, n).slice(0, n);
}

/** Every sector once, starting with the day's SECTORS_PER_DAY: the order in which a day tops up its checks. */
export function rotationOrder(day: string, available: readonly string[], n = SECTORS_PER_DAY): string[] {
  if (available.length === 0) return [];
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const start = ((dayNumber * n) % available.length + available.length) % available.length;
  return Array.from({ length: available.length }, (_, i) => available[(start + i) % available.length]);
}

/* ───────────────── Types ───────────────── */

/** cursors: where each sector's website checks carry on. noSiteCursors: where its no-website scan carries on. */
export type AgentState = { v: 1; cursors: Record<string, number>; noSiteCursors?: Record<string, number> };
export const EMPTY_STATE: AgentState = { v: 1, cursors: {} };
/** The no-website scan reads only the local list (no request), but still stops somewhere. */
export const NO_WEBSITE_SCAN = 500;

export type LeadFinding = { id: string; sentence: string; observed: string; sourceUrl: string; fetchedAt: string };
/** An explicit link and the exact page or OSM object it came from. Never verified by the agent. */
export type LeadContact = {
  channel: "WHATSAPP" | "INSTAGRAM" | "EMAIL" | "FACEBOOK";
  link: string;
  /** "+212 6…", "@handle" or the e-mail address, when the link shows it. */
  value?: string;
  source: "OSM_TAG" | "WEBSITE";
  sourceUrl: string;
};

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
  /** Website leads: does the site look like this business's own? MISMATCH leads are never saved. */
  identity?: Omit<Identity, "status"> & { status: "MATCH" | "UNVERIFIED" };
};

/** A site that presents itself as another business: held back for a person to look at, nothing attached to it. */
export type IdentityReview = { osmId: string; osmUrl: string; name: string; sector: string; website: string; siteName: string | null; reason: string };

export type RunStats = {
  /** The day's sectors, then any searched to top up the checks (also listed in topUpSectors). */
  sectors: string[];
  topUpSectors?: string[];
  checked: number;
  outcomes: Record<string, number>;
  skipped: { noWebsite: number; platformOnly: number; inCrm: number; possibleDuplicate: number; sameSiteInBatch: number; shownBefore: number };
  noWebsiteWithContact: number;
  /** Own-site pages read for contacts, and leads candidates that turned out to be in the CRM through them. */
  contactPagesRead?: number;
  inCrmByContact?: number;
  identityReview?: IdentityReview[];
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

const digitsOf = (link: string) => link.replace(/\D/g, "");

/** OSM tags and P6C's home-page WhatsApp, then what the site's own pages link to; one entry per channel + link. */
export function mergeContacts(a: AuditedCandidate, site: SiteContact[]): LeadContact[] {
  const out: LeadContact[] = [];
  const push = (c: LeadContact) => { if (c.link && !out.some((x) => x.channel === c.channel && x.link === c.link)) out.push(c); };
  for (const src of a.whatsapp.sources) push({ channel: "WHATSAPP", link: src.link, source: src.kind, sourceUrl: src.url });
  for (const c of site) push({ channel: c.channel, link: c.link, value: c.value || undefined, source: "WEBSITE", sourceUrl: c.sourceUrl });
  if (a.candidate.instagram) push({ channel: "INSTAGRAM", link: a.candidate.instagram, source: "OSM_TAG", sourceUrl: a.candidate.mapsUrl ?? "" });
  if (a.candidate.facebook) push({ channel: "FACEBOOK", link: a.candidate.facebook, source: "OSM_TAG", sourceUrl: a.candidate.mapsUrl ?? "" });
  const order = { WHATSAPP: 0, INSTAGRAM: 1, EMAIL: 2, FACEBOOK: 3 } as const;
  return out.sort((x, y) => order[x.channel] - order[y.channel]);
}

/** One number from OSM and the site: HIGH; one source: MEDIUM; different numbers: CONFLICT. Still unverified. */
export function whatsappConfidenceOf(contacts: LeadContact[]): DailyLead["whatsappConfidence"] {
  const wa = contacts.filter((c) => c.channel === "WHATSAPP" && digitsOf(c.link));
  const numbers = new Set(wa.map((c) => digitsOf(c.link)));
  if (numbers.size === 0) return "NONE";
  if (numbers.size > 1) return "CONFLICT";
  return wa.some((c) => c.source === "OSM_TAG") && wa.some((c) => c.source === "WEBSITE") ? "HIGH" : "MEDIUM";
}

/** Serious = at least one problem a customer would notice (HTTPS, phones, contact, speed), not only SEO details. */
export const customerIssues = (findings: readonly { id: string; sentence: string; observed: string }[]) =>
  findings.filter((f) => issueCopy(f).group === "CUSTOMER").length;

type Ranked = { audited: AuditedCandidate; contacts: LeadContact[]; identity?: DailyLead["identity"] };

/**
 * Problems first, contactability only between comparable leads: leads with customer-facing problems before
 * SEO-only ones, more customer-facing problems first; then WhatsApp > Instagram > e-mail > none; then the
 * check's own score. So a reachable site with only SEO details never outranks a serious problem.
 */
export function rankWebsiteLeads<T extends Ranked>(items: T[]): T[] {
  const key = (x: Ranked) => {
    const serious = customerIssues(x.audited.findings);
    return [serious > 0 ? 1 : 0, serious, contactRank(x.contacts.map((c) => c.channel)), x.audited.score, x.audited.findings.length];
  };
  return [...items].sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return a.audited.candidate.name.localeCompare(b.audited.candidate.name);
  });
}

function websiteLead({ audited: a, contacts, identity }: Ranked): DailyLead {
  return {
    kind: "WEBSITE", osmId: a.candidate.sourceId, osmUrl: a.candidate.mapsUrl ?? `https://www.openstreetmap.org/${a.candidate.sourceId}`,
    name: a.candidate.name, sector: a.candidate.sector, website: a.candidate.website, finalUrl: a.finalUrl, outcome: a.outcome,
    findings: a.findings.map((f) => ({ id: f.id, sentence: f.sentence, observed: f.observed, sourceUrl: f.sourceUrl, fetchedAt: f.fetchedAt })),
    score: a.score, contacts, whatsappConfidence: whatsappConfidenceOf(contacts), checkedAt: a.auditedAt,
    ...(identity ? { identity } : {}),
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
    const order = rotationOrder(day, available);
    const sectors = order.slice(0, SECTORS_PER_DAY);

    const stats: RunStats = {
      sectors: [...sectors], topUpSectors: [], checked: 0, outcomes: {},
      skipped: { noWebsite: 0, platformOnly: 0, inCrm: 0, possibleDuplicate: 0, sameSiteInBatch: 0, shownBefore: 0 },
      noWebsiteWithContact: 0, sectorErrors: [], stoppedEarly: false,
    };
    const isShown = (osmId: string, website: string | null) => shown.osmIds.has(osmId) || (!!website && shown.sites.has(siteKey(website) ?? ""));

    // 1. Search each sector from its cursor (P6C: CRM matches and possible duplicates already left out).
    type SectorWork = { sector: string; list: OsmEntry[]; from: number; to: number; end: boolean; toCheck: BatchCandidate[]; topUp: boolean };
    const work: SectorWork[] = [];
    const search = async (sector: string, topUp: boolean) => {
      const list = sectorEntries(data, sector);
      const saved = previous.cursors[sector] ?? 0;
      const from = saved >= 0 && saved < list.length ? saved : 0;
      const summary = await searchBatch(sector, from, { dataset: async () => data, loadCrm: async () => crm });
      if (summary.sourceError) { stats.sectorErrors.push(`${sector}: ${summary.sourceError}`); return; }
      for (const k of Object.keys(summary.skipped) as (keyof typeof summary.skipped)[]) stats.skipped[k] += summary.skipped[k];
      const toCheck = summary.candidates.filter((c) => {
        if (!isShown(c.sourceId, c.website)) return true;
        stats.skipped.shownBefore++;
        return false;
      });
      work.push({ sector, list, from: summary.progress.from, to: summary.progress.to, end: summary.progress.nextCursor === null, toCheck, topUp });
    };
    for (const sector of sectors) await search(sector, false);
    // Small sectors can't fill the day's checks: carry on into the next sectors in rotation order, from their own cursors.
    const eligible = () => work.reduce((n, w) => n + w.toCheck.length, 0);
    for (const sector of order.slice(SECTORS_PER_DAY)) {
      if (eligible() >= MAX_SITE_CHECKS) break;
      await search(sector, true);
      stats.sectors.push(sector);
      stats.topUpSectors!.push(sector);
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
    //    Only the day's own sectors: the top-up is for website checks.
    const daySectors = work.filter((w) => !w.topUp);
    const noSiteCursors: Record<string, number> = { ...(previous.noSiteCursors ?? {}) };
    const collected: { entry: OsmEntry; sector: string; index: number }[] = [];
    const scanEnd: Record<string, number> = {};
    for (const w of daySectors) {
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
    for (const w of daySectors) {
      const left = collected.filter((c) => c.sector === w.sector && !pickedNoSite.includes(c));
      noSiteCursors[w.sector] = left.length > 0 ? Math.min(...left.map((c) => c.index)) : scanEnd[w.sector];
    }

    // 5. Evidence first: read completely, not in the CRM, at least one customer-facing problem.
    const at = now().toISOString();
    const noSite = pickedNoSite.map((n) => noWebsiteLead(n.entry, n.sector, at));
    // The best readable sites (P6C's rule and order) get their own Contact/About pages read for contacts.
    // rankTop's rule (read completely, not in the CRM, a customer-facing problem) and order, but a wider pool.
    const pool = audited.filter((a) => a.outcome === "COMPLETE" && !a.inCrm && a.findings.length > 0)
      .sort((x, y) => y.score - x.score || y.findings.length - x.findings.length || x.candidate.name.localeCompare(y.candidate.name))
      .slice(0, CONTACT_POOL);
    const ranked: Ranked[] = [];
    stats.contactPagesRead = 0;
    stats.inCrmByContact = 0;
    stats.identityReview = [];
    for (let i = 0; i < pool.length; i += AUDIT_CHUNK) {
      const chunk = pool.slice(i, i + AUDIT_CHUNK);
      const late = clock() - started > CONTACT_DEADLINE_MS;
      const found = await Promise.all(chunk.map((a) => (late || !a.finalUrl
        ? Promise.resolve({ contacts: [], pagesRead: [], signals: null })
        : discoverSiteContacts(a.finalUrl, { fetcher: deps.fetcher }))));
      chunk.forEach((a, j) => {
        stats.contactPagesRead! += found[j].pagesRead.length;
        // Identity first: a site that is clearly another business's gets none of its problems or contacts.
        const identity = assessIdentity(a.candidate.name, found[j].signals);
        if (identity.status === "MISMATCH") {
          stats.identityReview!.push({
            osmId: a.candidate.sourceId, osmUrl: a.candidate.mapsUrl ?? `https://www.openstreetmap.org/${a.candidate.sourceId}`,
            name: a.candidate.name, sector: a.candidate.sector, website: a.finalUrl ?? a.candidate.website, siteName: identity.siteName, reason: identity.reason,
          });
          return;
        }
        const contacts = mergeContacts(a, found[j].contacts);
        // Newly found contacts can reveal a business already in the CRM: then it isn't a lead.
        const wa = contacts.find((c) => c.channel === "WHATSAPP" && digitsOf(c.link));
        const ig = contacts.find((c) => c.channel === "INSTAGRAM");
        const email = contacts.find((c) => c.channel === "EMAIL")?.value ?? null;
        const status = classify({ ...a.candidate, phone: wa ? `+${digitsOf(wa.link)}` : null, instagram: ig?.link ?? a.candidate.instagram, email }, crm).status;
        if (status !== "NEW") { stats.inCrmByContact!++; return; }
        ranked.push({ audited: a, contacts, identity: { status: identity.status, siteName: identity.siteName, reason: identity.reason } });
      });
    }
    const withSite = rankWebsiteLeads(ranked).slice(0, MAX_LEADS - noSite.length).map(websiteLead);
    const leads = [...withSite, ...noSite];

    await deps.store.finish(day, claim.startedAt, { status: "COMPLETED", state: { v: 1, cursors, noSiteCursors }, stats, leads }, now());
    return { day, result: "COMPLETED", leads: leads.length, checked: stats.checked };
  } catch (err) {
    if (err instanceof LostClaimError) throw err;
    console.error("[daily-leads] run failed:", err instanceof Error ? err.name : "error");
    try { return await fail(PUBLIC_ERRORS.unexpected); } catch { return { day, result: "FAILED", leads: 0, checked: 0, error: PUBLIC_ERRORS.unexpected }; }
  }
}
