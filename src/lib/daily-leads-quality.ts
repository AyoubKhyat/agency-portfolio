/**
 * Daily Lead Agent: which website findings are strong enough to make a lead, and which businesses come first.
 *
 *  - Only customer-facing findings (lead-issue-copy.ts group CUSTOMER) can qualify a lead; SEO/technical ones are
 *    shown on the card but never qualify a lead on their own.
 *  - Each customer-facing finding is FIRM or UNCERTAIN. A lead needs at least one FIRM one. UNCERTAIN findings stay
 *    on the card, marked as unconfirmed, with the reason.
 *  - Sector priority and competitor exclusion only decide order and who is left out. A priority sector is never
 *    a reason to keep a lead: the evidence rule comes first.
 *
 * Pure: no network, no database. Client-safe.
 */
import { issueCopy } from "@/lib/lead-issue-copy";

export type FindingEvidence = "FIRM" | "UNCERTAIN";
type Finding = { id: string; sentence: string; observed: string };
export type GradedFinding<F extends Finding = Finding> = F & { evidence: FindingEvidence; note?: string };

/** What the contact lookup saw on its own, second read of the site (lead-contacts.ts). */
export type SecondRead = {
  /** Pages read, home page first; empty when the lookup didn't run or couldn't read the site. */
  pagesRead: readonly string[];
  /** Explicit contact links found, each with the page it was on. */
  contacts: readonly { channel: string; sourceUrl: string }[];
  /** How long the second home-page request took; undefined when there was none. */
  homeMs?: number;
  /** Contact pages linked from the home page and what was on them (lead-contacts.ts ContactPageCheck). */
  contactPages?: readonly { url: string; read: boolean; complete: boolean; kinds: readonly string[] }[];
};

const NO_SECOND_READ: SecondRead = { pagesRead: [], contacts: [] };
const secs = (ms: number) => (ms / 1000).toFixed(1);
const pathOf = (url: string) => { try { return new URL(url).pathname || "/"; } catch { return url; } };

/**
 * FIRM or UNCERTAIN for each finding. Customer-facing:
 *  - E_HTTPS, E_VIEWPORT: FIRM. The audit only reports them from a page it read completely; they don't change
 *    between requests.
 *  - E_RESPONSE_TIME: always UNCERTAIN. Both samples (the audit's and the contact lookup's) come from the same
 *    server region, minutes apart, so they're correlated and say little about a visitor in Morocco on their
 *    phone. The second sample is shown, but a slow page never qualifies a lead on its own.
 *  - E_CONTACT (the whole home page has no phone, e-mail, WhatsApp or form) is FIRM only when the customer
 *    journey is demonstrably poor:
 *      - the home page links no Contact page at all, or
 *      - every Contact page it links was read completely and shows no contact option either.
 *    UNCERTAIN when a linked Contact page works (has a contact option), couldn't be read or checked fully, when
 *    the second read found a WhatsApp or e-mail link on the home page, or when there was no second read.
 * Technical/SEO findings are factual but never qualify, so they're marked FIRM and ignored by `qualifies`.
 */
export function gradeFindings<F extends Finding>(findings: readonly F[], second: SecondRead = NO_SECOND_READ): GradedFinding<F>[] {
  const home = second.pagesRead[0] ?? null;
  return findings.map((f): GradedFinding<F> => {
    if (f.id === "E_RESPONSE_TIME") {
      const ms = second.homeMs;
      if (typeof ms !== "number") return { ...f, evidence: "UNCERTAIN", note: "Only one check from our server, so this isn't confirmed. Speed can vary." };
      return { ...f, evidence: "UNCERTAIN", note: `A second check from the same server took about ${secs(ms)} s. Not confirmed for visitors in Morocco.` };
    }
    if (f.id === "E_CONTACT") return gradeContact(f, second, home);
    return { ...f, evidence: "FIRM" };
  });
}

function gradeContact<F extends Finding>(f: F, second: SecondRead, home: string | null): GradedFinding<F> {
  if (!home) return { ...f, evidence: "UNCERTAIN", note: "The site's other pages weren't checked, so a Contact page may cover this." };
  const onHome = second.contacts.some((c) => (c.channel === "WHATSAPP" || c.channel === "EMAIL") && c.sourceUrl === home);
  if (onHome) return { ...f, evidence: "UNCERTAIN", note: "A second read found a WhatsApp or e-mail link on the home page, so check by hand." };
  const pages = second.contactPages ?? [];
  if (pages.length === 0) return { ...f, evidence: "FIRM", note: "The home page doesn't link to a Contact page either." };
  const working = pages.find((p) => p.read && p.kinds.length > 0);
  if (working) {
    return { ...f, evidence: "UNCERTAIN", note: `The home page has no direct contact option, but its Contact page (${pathOf(working.url)}) has ${working.kinds.join(", ")}.` };
  }
  if (pages.every((p) => p.read && p.complete)) {
    return { ...f, evidence: "FIRM", note: `Its Contact page (${pathOf(pages[0].url)}) shows no phone, e-mail, WhatsApp or form either.` };
  }
  return { ...f, evidence: "UNCERTAIN", note: `The home page links a Contact page (${pathOf(pages[0].url)}) that couldn't be checked fully.` };
}

const isCustomer = (f: Finding) => issueCopy(f).group === "CUSTOMER";

/** Customer-facing findings backed by firm evidence. */
export const firmCustomerIssues = (findings: readonly GradedFinding[]) => findings.filter((f) => isCustomer(f) && f.evidence === "FIRM").length;
/** At least one customer-facing finding at all (before any second read): SEO/technical-only sites stop here. */
export const hasCustomerIssue = (findings: readonly Finding[]) => findings.some(isCustomer);
/** A website lead needs at least one firm, customer-facing problem. */
export const qualifies = (findings: readonly GradedFinding[]) => firmCustomerIssues(findings) > 0;

/* ───────────────── Sectors and competitors ───────────────── */

/**
 * Sectors where a better website is most directly tied to bookings and walk-ins. Used only to order leads that
 * already qualify on evidence, never to qualify one.
 */
export const PRIORITY_SECTORS: ReadonlySet<string> = new Set(["HOTELS", "RIADS", "GUEST_HOUSES", "SPAS", "CLINICS", "DENTISTS", "RESTAURANTS"]);
export const sectorPriority = (sector: string) => (PRIORITY_SECTORS.has(sector) ? 1 : 0);

/** Sectors made of direct competitors (web, SEO, marketing, advertising agencies): never searched by the agent. */
export const COMPETITOR_SECTORS: ReadonlySet<string> = new Set(["MARKETING"]);

/**
 * Names and site addresses that say "web / SEO / digital agency" outright. Strong phrases only: a bare
 * "communication(s)", "marketing", "publicité" or "media" is common in other trades (telecom shops, event venues,
 * printers), so it isn't enough. "seo" counts as a whole word, or at the start of a word followed by "com" or
 * "agency" (SEOCOM), so "Seoul" or "Museo" don't match.
 */
const COMPETITOR_TEXT = new RegExp([
  String.raw`\bseo\b`, String.raw`\bseo(?:com|agency)`,
  String.raw`\bagence\s+(?:web|digitale?|de\s+communication|de\s+marketing|marketing|seo|de\s+r[eé]f[eé]rencement)\b`,
  String.raw`\b(?:web|digital|marketing|seo|communications?)\s+agency\b`,
  String.raw`\bweb\s*-?design(?:er)?\b`, String.raw`\bcr[eé]ation\s+(?:de\s+)?sites?\b`, String.raw`\br[eé]f[eé]rencement\b`,
].join("|"), "i");

/** A direct competitor: a competitor sector, or a name or site address that says it is a web/SEO/marketing agency. */
export function isCompetitor(c: { name: string; sector: string; website?: string | null }): boolean {
  if (COMPETITOR_SECTORS.has(c.sector)) return true;
  let host = "";
  if (c.website) { try { host = new URL(c.website).hostname.replace(/^www\./, "").replace(/[.-]/g, " "); } catch { /* not a URL */ } }
  return COMPETITOR_TEXT.test(c.name) || (host !== "" && COMPETITOR_TEXT.test(host));
}
