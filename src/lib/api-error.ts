/**
 * The message to show when an admin API call fails: the server's own `error` text when it sent one (for a denied
 * owner-or-admin action that is "Only the owner or an admin can do this"), otherwise the fallback and the status.
 * Client-safe: no server imports.
 */
export async function apiErrorMessage(res: Pick<Response, "status" | "json">, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  const text = typeof body?.error === "string" && body.error.trim() ? body.error
    : typeof body?.message === "string" && body.message.trim() ? body.message
    : "";
  return text || `${fallback} (${res.status})`;
}
