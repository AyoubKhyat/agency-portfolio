/**
 * P6C batch discovery: Marrakech businesses in one sector from the private OpenStreetMap list (see
 * osm-dataset.ts), the ones not already in the CRM checked with the safe website check (robots.txt, SSRF rules),
 * and the top 5 ranked by problems a customer would notice. Reads only: nothing is saved, no AI, no paid API,
 * no live Overpass call. Importing is a separate, manual step.
 *
 * Each search continues from a cursor, so repeated searches move through the list instead of returning the same
 * businesses. Work is split into small requests: one search, then audits of at most AUDIT_CHUNK sites each.
 *
 * Contacts are never verified here. A WhatsApp number comes only from an explicit link (an OSM contact:whatsapp
 * tag or a wa.me link on the site), never from a phone number, and is always UNVERIFIED.
 */
import { SECTORS } from "@/lib/discovery-providers";
import { DatasetMissingError, loadDataset, toCandidate, type OsmDataset } from "@/lib/osm-dataset";
import { classify, siteKey, type ExistingProspectLite } from "@/lib/discovery-duplicates";
import { normalizeSiteUrl } from "@/lib/diagnosis";
import { qualifyWebsite, type ProblemEvidence, type ProspectRow, type QualificationResult } from "@/lib/prospect-qualification";
import { FINDINGS } from "@/lib/prospect-outreach-draft";
import { explicitWhatsAppLink } from "@/lib/contact-check";
import type { DiscoveryCandidate } from "@/lib/discovery-providers";
import type { SafeFetch } from "@/lib/website-audit/safe-fetch";

export const BATCH_CITY = "MARRAKECH";
export const MAX_SEARCH = 30;
export const MAX_AUDIT = 10;
export const AUDIT_CHUNK = 3;

export type BatchCandidate = DiscoveryCandidate & { website: string };

export type SearchSummary = {
  sector: string;
  searchedAt: string;
  /** Businesses from the list looked at by this search (at most MAX_SEARCH). */
  found: number;
  /** platformOnly: the "website" is only a Facebook, Instagram, Booking or similar page, so there's no own site to check. */
  skipped: { noWebsite: number; platformOnly: number; inCrm: number; possibleDuplicate: number; sameSiteInBatch: number };
  candidates: BatchCandidate[];
  /** Where this search sat in the sector's list. Pass `nextCursor` to the next search; null = the end was reached. */
  progress: { from: number; to: number; total: number; nextCursor: number | null };
  /** How fresh the list is. */
  dataset: { osmDataUntil: string | null; generatedAt: string } | null;
  /** A source that failed. The results are then partial or empty, never made up. */
  sourceError: string | null;
};

type CrmRow = ExistingProspectLite & ProspectRow;

export type SearchDeps = {
  dataset?: () => Promise<OsmDataset>;
  loadCrm?: () => Promise<CrmRow[]>;
};

async function loadCrmFromDb(): Promise<CrmRow[]> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.prospect.findMany({
    select: {
      id: true, name: true, phone: true, email: true, website: true, instagram: true, whatsappLink: true,
      neighborhood: true, sector: true, whatsappStatus: true, instagramStatus: true,
    },
    take: 5000,
  });
}

export class UnknownSectorError extends Error {}

/**
 * A page on someone else's platform rather than the business's own site: auditing it would say nothing about
 * the business (and Facebook, Instagram and Booking mostly ask robots not to read them).
 */
const PLATFORMS = /^(?:[a-z0-9-]+\.)*(?:facebook\.com|fb\.com|instagram\.com|linktr\.ee|wa\.me|whatsapp\.com|sites\.google\.com|booking\.com|airbnb\.[a-z.]+|tripadvisor\.[a-z.]+|tiktok\.com|youtube\.com|linkedin\.com)$/i;
export function platformPage(url: string): boolean {
  try { return PLATFORMS.test(new URL(url).hostname); } catch { return false; }
}

/** The sector's businesses from the list, in its fixed order. */
export function sectorEntries(data: OsmDataset, sector: string) {
  return data.entries.filter((e) => e.sectors.includes(sector));
}

/**
 * Looks at the next businesses of the sector from `cursor` on and stops at MAX_AUDIT sites to check (or MAX_SEARCH
 * looked at). Anything already in the CRM is left out before any site is read. nextCursor picks up right after the
 * last business looked at, so nothing is skipped and nothing repeats until the list is started again.
 */
export async function searchBatch(sector: string, cursor = 0, deps: SearchDeps = {}): Promise<SearchSummary> {
  if (!SECTORS.some((s) => s.key === sector)) throw new UnknownSectorError(sector);
  const summary: SearchSummary = {
    sector, searchedAt: new Date().toISOString(), found: 0,
    skipped: { noWebsite: 0, platformOnly: 0, inCrm: 0, possibleDuplicate: 0, sameSiteInBatch: 0 },
    candidates: [], progress: { from: cursor, to: cursor, total: 0, nextCursor: null }, dataset: null, sourceError: null,
  };

  let data: OsmDataset;
  try {
    data = await (deps.dataset ?? loadDataset)();
  } catch (err) {
    summary.sourceError = err instanceof DatasetMissingError
      ? "The Marrakech business list isn't installed on this server. Nothing was searched."
      : "The Marrakech business list couldn't be read. Nothing was searched.";
    return summary;
  }
  summary.dataset = { osmDataUntil: data.osmDataUntil, generatedAt: data.generatedAt };
  const list = sectorEntries(data, sector);
  const start = Math.min(Math.max(0, Math.floor(cursor)), list.length);
  summary.progress = { from: start, to: start, total: list.length, nextCursor: start < list.length ? start : null };
  if (start >= list.length) return summary;

  let crm: CrmRow[];
  try {
    crm = await (deps.loadCrm ?? loadCrmFromDb)();
  } catch {
    summary.sourceError = "The CRM couldn't be read, so nothing was checked (duplicates couldn't be ruled out).";
    return summary;
  }

  const seenSites = new Set<string>();
  let i = start;
  for (; i < list.length && summary.found < MAX_SEARCH && summary.candidates.length < MAX_AUDIT; i++) {
    const c = toCandidate(list[i], sector);
    summary.found++;
    const website = normalizeSiteUrl(c.website ?? "");
    const key = website ? siteKey(website) : null;
    if (!website || !key) { summary.skipped.noWebsite++; continue; }
    if (platformPage(website)) { summary.skipped.platformOnly++; continue; } // kept in the list, just not audited
    if (seenSites.has(key)) { summary.skipped.sameSiteInBatch++; continue; }
    seenSites.add(key);
    const { status } = classify({ ...c, website }, crm);
    if (status === "EXISTS") { summary.skipped.inCrm++; continue; }
    if (status === "POSSIBLE") { summary.skipped.possibleDuplicate++; continue; }
    summary.candidates.push({ ...c, website });
  }
  summary.progress = { from: start, to: i, total: list.length, nextCursor: i < list.length ? i : null };
  return summary;
}

/* ───────────────── Audit and rank ───────────────── */

export type Confidence = "HIGH" | "MEDIUM" | "CONFLICT" | "NONE";

export type BatchWhatsApp = {
  /** wa.me link when the sources give one number; empty otherwise. Never built from a phone. */
  link: string;
  confidence: Confidence;
  /** Where it was seen: the OSM object page and/or the website page. */
  sources: { kind: "OSM_TAG" | "WEBSITE"; url: string; link: string }[];
  status: "UNVERIFIED";
};

export type BusinessFinding = ProblemEvidence & { sentence: string };

export type AuditedCandidate = {
  candidate: BatchCandidate;
  outcome: QualificationResult["outcome"] | "ERROR";
  finalUrl: string | null;
  auditedAt: string;
  /** Problems a customer would notice, most important first, each with its evidence. */
  findings: BusinessFinding[];
  /** Other failed checks (technical SEO and the like): they only break ties. */
  otherProblems: ProblemEvidence[];
  score: number;
  whatsapp: BatchWhatsApp;
  /** Set when the site itself links to something already in the CRM. */
  inCrm: string | null;
};

/** A customer-facing problem outweighs any number of minor technical ones in practice (10..3 vs 1 each). */
export function scoreProblems(problems: ProblemEvidence[]): { findings: BusinessFinding[]; other: ProblemEvidence[]; score: number } {
  const findings: BusinessFinding[] = [];
  let score = 0;
  FINDINGS.forEach(([id, rule], i) => {
    const p = problems.find((e) => e.id === id);
    const s = p ? rule(p.observed) : null;
    if (p && s) { findings.push({ ...p, sentence: s.en }); score += 10 - i; }
  });
  const used = new Set(findings.map((f) => f.id));
  const other = problems.filter((p) => !used.has(p.id));
  return { findings, other, score: score + other.length };
}

const digits = (link: string) => link.replace(/\D/g, "");

/** How sure we are of the WhatsApp number, from explicit links only. Always UNVERIFIED: nobody opened it. */
export function whatsappConfidence(c: BatchCandidate, q: Pick<QualificationResult, "contacts"> | null): BatchWhatsApp {
  const sources: BatchWhatsApp["sources"] = [];
  const osm = explicitWhatsAppLink(c.whatsapp);
  if (osm) sources.push({ kind: "OSM_TAG", url: c.mapsUrl ?? "", link: osm });
  for (const found of q?.contacts ?? []) {
    const link = found.channel === "WHATSAPP" ? explicitWhatsAppLink(found.link) : "";
    if (link && !sources.some((s) => s.kind === "WEBSITE" && s.link === link)) sources.push({ kind: "WEBSITE", url: found.sourceUrl, link });
  }
  const numbers = new Set(sources.map((s) => digits(s.link)));
  const confidence: Confidence = numbers.size === 0 ? "NONE" : numbers.size > 1 ? "CONFLICT"
    : sources.some((s) => s.kind === "OSM_TAG") && sources.some((s) => s.kind === "WEBSITE") ? "HIGH" : "MEDIUM";
  return { link: numbers.size === 1 ? sources[0].link : "", confidence, sources, status: "UNVERIFIED" };
}

export type AuditDeps = { fetcher?: SafeFetch; loadCrm?: () => Promise<CrmRow[]> };

/** Checks at most AUDIT_CHUNK sites, side by side. A failure of one never hides the others. */
export async function auditChunk(candidates: BatchCandidate[], deps: AuditDeps = {}): Promise<AuditedCandidate[]> {
  const chunk = candidates.slice(0, AUDIT_CHUNK);
  let crm: Promise<CrmRow[]> | null = null;
  const loadProspects = () => (crm ??= (deps.loadCrm ?? loadCrmFromDb)());
  return Promise.all(chunk.map(async (c): Promise<AuditedCandidate> => {
    try {
      const q = await qualifyWebsite(c.website, { fetcher: deps.fetcher, loadProspects });
      const { findings, other, score } = scoreProblems(q.problems);
      const match = q.duplicates.checked ? q.duplicates.matches[0] : null;
      return {
        candidate: c, outcome: q.outcome, finalUrl: q.finalUrl,
        auditedAt: q.problems[0]?.fetchedAt ?? q.contacts[0]?.fetchedAt ?? new Date().toISOString(),
        findings, otherProblems: other, score, whatsapp: whatsappConfidence(c, q),
        inCrm: !q.duplicates.checked ? "The CRM couldn't be checked" : match ? `${match.prospectName || "(no name)"}: ${match.reasons.join(", ")}` : null,
      };
    } catch {
      return {
        candidate: c, outcome: "ERROR", finalUrl: null, auditedAt: new Date().toISOString(),
        findings: [], otherProblems: [], score: 0, whatsapp: whatsappConfidence(c, null), inCrm: null,
      };
    }
  }));
}

export { rankTop } from "@/lib/batch-rank";
