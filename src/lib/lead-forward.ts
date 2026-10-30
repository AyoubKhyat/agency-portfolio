import type { z } from "zod";
import type { leadSchema, Saved } from "@/lib/lead-intake";

const TIMEOUT_MS = 8_000;

/**
 * Sends a validated contact lead to the admin app (server to server, shared INTERNAL_API_KEY).
 * Throws when the admin cannot be reached or does not confirm, so the form reports "not stored"
 * exactly as it does when the local save fails.
 */
export async function forwardLead(data: z.infer<typeof leadSchema>): Promise<Saved> {
  const base = process.env.ADMIN_API_URL;
  const key = process.env.INTERNAL_API_KEY;
  if (!base || !key) throw new Error("ADMIN_API_URL / INTERNAL_API_KEY are not configured");
  const res = await fetch(new URL("/api/internal/leads", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`admin answered ${res.status}`);
  const body = (await res.json()) as Partial<Saved>;
  if (typeof body.duplicate !== "boolean") throw new Error("unexpected admin answer");
  return { leadId: body.leadId ?? null, duplicate: body.duplicate };
}
