/**
 * P6C batch discovery: up to 30 Marrakech businesses in one sector from OpenStreetMap, the ones not already in
 * the CRM checked with the safe website check (robots.txt, SSRF rules), and the top 5 ranked by problems a
 * customer would notice. Reads only: nothing is saved, no AI, no paid API. Importing is a separate, manual step.
 *
 * Work is split into small requests so each stays well inside Vercel's limit: one search (one Overpass query),
 * then audits of at most AUDIT_CHUNK sites per request.
 *
 * Contacts are never verified here. A WhatsApp number comes only from an explicit link (an OSM contact:whatsapp
 * tag or a wa.me link on the site), never from a phone number, and is always UNVERIFIED.
 */
import { OsmProvider, SECTORS, type DiscoveryCandidate } from "@/lib/discovery-providers";
import { classify, siteKey, type ExistingProspectLite } from "@/lib/discovery-duplicates";
import { normalizeSiteUrl } from "@/lib/diagnosis";
import { qualifyWebsite, type ProblemEvidence, type ProspectRow, type QualificationResult } from "@/lib/prospect-qualification";
import { FINDINGS } from "@/lib/prospect-outreach-draft";
import { explicitWhatsAppLink } from "@/lib/contact-check";
import type { SafeFetch } from "@/lib/website-audit/safe-fetch";

export const BATCH_CITY = "MARRAKECH";
export const MAX_SEARCH = 30;
export const MAX_AUDIT = 10;
export const AUDIT_CHUNK = 3;

export type BatchCandidate = DiscoveryCandidate & { website: string };

export type SearchSummary = {
  sector: string;
  searchedAt: string;
  /** Businesses OpenStreetMap returned (up to MAX_SEARCH looked at). */
  found: number;
  skipped: { noWebsite: number; inCrm: number; possibleDuplicate: number; sameSiteInBatch: number; overLimit: number };
  candidates: BatchCandidate[];
  /** A source that failed. The results are then partial or empty, never made up. */
  sourceError: string | null;
};

type CrmRow = ExistingProspectLite & ProspectRow;

export type SearchDeps = {
  search?: (sector: string) => Promise<DiscoveryCandidate[]>;
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

/** One Overpass query, then everything with no website or already in the CRM is left out before any site is read. */
export async function searchBatch(sector: string, deps: SearchDeps = {}): Promise<SearchSummary> {
  if (!SECTORS.some((s) => s.key === sector)) throw new UnknownSectorError(sector);
  const summary: SearchSummary = {
    sector, searchedAt: new Date().toISOString(), found: 0,
    skipped: { noWebsite: 0, inCrm: 0, possibleDuplicate: 0, sameSiteInBatch: 0, overLimit: 0 },
    candidates: [], sourceError: null,
  };

  let found: DiscoveryCandidate[];
  try {
    found = await (deps.search ?? ((s) => new OsmProvider().search({ city: BATCH_CITY, sector: s, neighborhood: null, keyword: null })))(sector);
  } catch {
    summary.sourceError = "OpenStreetMap didn't answer (busy or rate-limited). Try again in a minute.";
    return summary;
  }
  found = found.filter((c) => c.source === "OSM").slice(0, MAX_SEARCH);
  summary.found = found.length;

  let crm: CrmRow[];
  try {
    crm = await (deps.loadCrm ?? loadCrmFromDb)();
  } catch {
    summary.sourceError = "The CRM couldn't be read, so nothing was checked (duplicates couldn't be ruled out).";
    return summary;
  }

  const seenSites = new Set<string>();
  for (const c of found) {
    const website = normalizeSiteUrl(c.website ?? "");
    const key = website ? siteKey(website) : null;
    if (!website || !key) { summary.skipped.noWebsite++; continue; }
    if (seenSites.has(key)) { summary.skipped.sameSiteInBatch++; continue; }
    seenSites.add(key);
    const { status } = classify({ ...c, website }, crm);
    if (status === "EXISTS") { summary.skipped.inCrm++; continue; }
    if (status === "POSSIBLE") { summary.skipped.possibleDuplicate++; continue; }
    if (summary.candidates.length >= MAX_AUDIT) { summary.skipped.overLimit++; continue; }
    summary.candidates.push({ ...c, website });
  }
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
