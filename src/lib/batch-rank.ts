/** Ranking for batch discovery. No imports at runtime, so the page can use it in the browser. */
import type { AuditedCandidate } from "@/lib/batch-discovery";

export const TOP = 5;

/** The top 5: read completely, not linked to anything in the CRM, with at least one customer-facing problem. */
export function rankTop(audited: AuditedCandidate[]): AuditedCandidate[] {
  return audited
    .filter((a) => a.outcome === "COMPLETE" && !a.inCrm && a.findings.length > 0)
    .sort((a, b) => b.score - a.score || b.findings.length - a.findings.length || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, TOP);
}
