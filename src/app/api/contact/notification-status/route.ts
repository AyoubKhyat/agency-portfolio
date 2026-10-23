import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasPrisma } from "@/lib/prisma";
import { createRateLimiter } from "@/lib/rate-limit";
import { withApiLogging } from "@/lib/api-logger";

/**
 * The contact form reports here when an inquiry was saved but its EmailJS
 * notification did not go out (send failed, or EmailJS is not configured).
 * Server-side log only: the lead is already in the CRM and its admin
 * notification exists. Accepted only for a lead created in the last 15 minutes.
 */
const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
const RECENT_MS = 15 * 60 * 1000;
const reported = new Map<string, number>();

const schema = z.object({
  leadId: z.string().regex(/^[a-z0-9]{20,40}$/),
  status: z.enum(["failed", "not_configured"]),
});

async function handler(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.check(ip).allowed) return new NextResponse(null, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  // Without a database there is no lead to report on.
  if (!hasPrisma()) return new NextResponse(null, { status: 404 });
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { createdAt: true } });
  if (!lead || Date.now() - lead.createdAt.getTime() > RECENT_MS) return new NextResponse(null, { status: 404 });

  // One log line per lead (per instance): replays add nothing.
  if (reported.has(parsed.data.leadId)) return new NextResponse(null, { status: 204 });
  reported.set(parsed.data.leadId, Date.now());
  for (const [id, at] of reported) if (Date.now() - at > RECENT_MS) reported.delete(id);

  console.error(
    JSON.stringify({
      event: "contact_email_notification_failed",
      leadId: parsed.data.leadId,
      reason: parsed.data.status,
      timestamp: new Date().toISOString(),
    }),
  );
  return new NextResponse(null, { status: 204 });
}

export const POST = withApiLogging("POST /api/contact/notification-status", handler);
