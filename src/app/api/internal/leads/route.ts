import { NextResponse } from "next/server";
import { hasInternalKey } from "@/lib/internal-auth";
import { intakeLead, leadSchema } from "@/lib/lead-intake";

/**
 * Server-to-server lead intake for a separate storefront. Disabled (404) unless INTERNAL_API_KEY
 * (32+ characters) is set. Validation, honeypot and rate limiting stay on the storefront; this
 * route still validates the payload and owns de-duplication, assignment, webhook and notification.
 */
export async function POST(req: Request) {
  if (!process.env.INTERNAL_API_KEY) return new NextResponse(null, { status: 404 });
  if (!hasInternalKey(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const saved = await intakeLead(parsed.data);
    return NextResponse.json(saved, { status: saved.duplicate ? 200 : 201 });
  } catch (e) {
    console.error("[internal/leads] Lead could not be saved:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not save" }, { status: 503 });
  }
}
