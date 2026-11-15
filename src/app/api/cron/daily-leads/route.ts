import { NextResponse } from "next/server";
import { hasPrisma } from "@/lib/prisma";
import { cronAuthorized, runDailyLeadsNow } from "@/lib/daily-leads-run";

// Vercel Hobby's limit. The run itself stops starting site checks after 180 s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * For Vercel Cron (not scheduled yet: the vercel.json entry comes in its own PR). Only with `Authorization: Bearer $CRON_SECRET`; anything else is 401.
 * Safe to call twice: the day is claimed once, and a completed day is never run again.
 * The response carries counts only, never business data.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });
  try {
    const r = await runDailyLeadsNow({ retry: false });
    return NextResponse.json({ day: r.day, result: r.result, leads: r.leads, checked: r.checked });
  } catch {
    console.error("[cron/daily-leads] failed");
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
