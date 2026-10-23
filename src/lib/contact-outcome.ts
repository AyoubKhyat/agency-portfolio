/**
 * What the contact form tells the visitor, given what actually happened.
 *
 * The form saves the inquiry through /api/contact first (the CRM is the source
 * of truth), then sends the EmailJS notification. Each step can fail on its
 * own, and the message shown must match what really happened. Pure, so every
 * combination is unit-tested.
 */

export type ApiResult =
  | { kind: "stored"; leadId: string | null; duplicate: boolean }
  | { kind: "not_stored" } // server or database failure: the inquiry is not in the CRM
  | { kind: "rate_limited" }
  | { kind: "rejected" }; // server-side validation refused the data

export type EmailResult = "sent" | "failed" | "not_configured" | "skipped";

export type Outcome = "success" | "email_only" | "rate_limited" | "error";

/** Read the /api/contact response. A network error is passed as null. */
export async function parseApiResponse(res: Response | null): Promise<ApiResult> {
  if (!res) return { kind: "not_stored" };
  if (res.status === 429) return { kind: "rate_limited" };
  if (res.status === 400) return { kind: "rejected" };
  if (!res.ok) return { kind: "not_stored" };
  const body = (await res.json().catch(() => null)) as { stored?: unknown; leadId?: unknown; duplicate?: unknown } | null;
  if (body?.stored !== true) return { kind: "not_stored" };
  return {
    kind: "stored",
    leadId: typeof body.leadId === "string" ? body.leadId : null,
    duplicate: body.duplicate === true,
  };
}

/**
 * Send the email notification for a new stored inquiry, or as the only
 * channel when storage failed. Never for a duplicate (it was already sent),
 * a rate-limited burst, or data the server rejected.
 */
export function shouldSendEmail(api: ApiResult): boolean {
  if (api.kind === "stored") return !api.duplicate;
  return api.kind === "not_stored";
}

export function resolveOutcome(api: ApiResult, email: EmailResult): Outcome {
  if (api.kind === "rate_limited") return "rate_limited";
  if (api.kind === "stored") return "success";
  if (api.kind === "not_stored" && email === "sent") return "email_only";
  return "error";
}

/** The inquiry is in the CRM but its email notification did not go out: tell the server to log it. */
export function shouldReportEmailFailure(api: ApiResult, email: EmailResult): boolean {
  return api.kind === "stored" && !api.duplicate && (email === "failed" || email === "not_configured");
}

/** Count a lead once: not for a resubmitted duplicate, and never for a failed submission. */
export function shouldTrackLead(api: ApiResult, outcome: Outcome): boolean {
  if (outcome === "email_only") return true;
  return outcome === "success" && api.kind === "stored" && !api.duplicate;
}
