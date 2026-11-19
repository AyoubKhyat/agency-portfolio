import type { LeadWorkspace } from "@/lib/workspace/types";

/**
 * Where a workspace sends someone to write the first message: the prospect page's draft panel, which checks
 * the website and only writes to a VERIFIED contact. A Discovery result that was never imported has no
 * prospect yet, so there is nowhere to draft (null).
 */
export function firstMessageHref(data: Pick<LeadWorkspace, "source" | "id" | "imported">): string | null {
  const prospectId = data.source === "prospect" ? data.id : data.imported?.prospectId ?? null;
  return prospectId ? `/admin/prospecting/${encodeURIComponent(prospectId)}#draft` : null;
}
