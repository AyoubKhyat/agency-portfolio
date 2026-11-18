/**
 * The website check a business had in Find businesses, kept as a dated note on the prospect it becomes.
 *
 * The audit comes from the browser and is NOT re-verified here (no second fetch of the site): the server only
 * limits what can be written. Nothing in it is trusted: the shape is checked strictly (sizes included),
 * only the customer-facing findings Find shows (KNOWN_ISSUE_IDS) are kept, every source address must be on the
 * business's own site, observed text is cleaned again, and the note's wording is written here, not by the client.
 * A note is only made for a check that read the site completely and found at least one problem.
 */
import { z } from "zod";
import { SITE_URL_MAX } from "@/lib/diagnosis";
import { KNOWN_ISSUE_IDS, issueCopy } from "@/lib/lead-issue-copy";
import { sanitizeObserved } from "@/lib/website-audit/checks";

export const MAX_AUDIT_FINDINGS = 12;
/** Clock difference tolerated between the browser's check and this server. */
const FUTURE_SKEW_MS = 5 * 60_000;

export const auditSchema = z.object({
  outcome: z.string().max(40),
  auditedAt: z.string().max(40),
  finalUrl: z.string().max(SITE_URL_MAX).nullable(),
  findings: z.array(z.object({
    id: z.string().max(40),
    observed: z.string().max(500),
    sourceUrl: z.string().max(SITE_URL_MAX),
    fetchedAt: z.string().max(40),
  }).strict()).max(MAX_AUDIT_FINDINGS),
}).strict();

export type AuditInput = z.infer<typeof auditSchema>;

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** The host of an http(s) address without credentials, or null. */
function webHost(raw: string | null | undefined): string | null {
  try {
    const u = new URL((raw ?? "").trim());
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password ? bareHost(u.hostname) : null;
  } catch {
    return null;
  }
}

/** An ISO 8601 UTC timestamp as Find sends it (Date#toISOString); Date.parse alone also accepts "1" or "May 5". */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** The day of the check in Casablanca, or null when the date isn't a real ISO timestamp or is in the future. */
function checkDay(iso: string, now: number): string | null {
  if (!ISO_UTC.test(iso)) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 19) !== iso.slice(0, 19) || t > now + FUTURE_SKEW_MS) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/**
 * The note text for an audit, or null when there is nothing trustworthy to keep: a check that didn't complete,
 * an invalid date, or no finding left after the checks above.
 */
export function buildAuditNote(
  audit: AuditInput, website: string | null | undefined, now = Date.now(),
  /**
   * origin DAILY_AGENT: the findings come from the Daily Lead Agent's saved run (server side), not the browser.
   * unconfirmed: finding ids a second read didn't confirm; they are kept, marked as unconfirmed.
   */
  opts: { origin?: "FIND" | "DAILY_AGENT"; unconfirmed?: ReadonlySet<string> } = {},
): string | null {
  const daily = opts.origin === "DAILY_AGENT";
  if (audit.outcome !== "COMPLETE") return null;
  const host = webHost(website);
  const day = checkDay(audit.auditedAt, now);
  if (!host || !day) return null;

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const f of audit.findings) {
    if (!KNOWN_ISSUE_IDS.includes(f.id) || seen.has(f.id)) continue;
    if (webHost(f.sourceUrl) !== host) continue; // only evidence from the business's own site
    const observed = sanitizeObserved(f.observed);
    if (!observed) continue;
    seen.add(f.id);
    const unsure = opts.unconfirmed?.has(f.id) ? " (unconfirmed)" : "";
    lines.push(`• ${issueCopy({ id: f.id, sentence: "", observed }).title}${unsure}: seen "${observed}" (${f.sourceUrl.trim()})`);
  }
  if (lines.length === 0) return null;

  const page = webHost(audit.finalUrl) === host ? audit.finalUrl!.trim() : website!.trim();
  return [
    `Website check from ${daily ? "the Daily Lead Agent" : "Find businesses"}, dated ${day} (${page}): ${lines.length} problem${lines.length === 1 ? "" : "s"} a customer would notice.`,
    ...lines,
    daily
      ? "Saved by that day's Daily Lead Agent run; the site was not re-checked at import. Check it again before relying on it."
      : "Sent by the browser with the import and checked here for format and site only; the site was not re-checked. Check it again before relying on it.",
  ].join("\n");
}
