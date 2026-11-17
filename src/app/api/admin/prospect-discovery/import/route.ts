import { NextResponse } from "next/server";
import { requireOwnerOrAdmin } from "@/lib/authz";
import { hasPrisma } from "@/lib/prisma";
import { importCandidates } from "@/lib/prospect-import";

/**
 * Bulk import of discovered businesses (Find businesses, legacy Prospect Discovery and its Bulk Sweep).
 * Owner or admin only: it can create up to 500 prospects, set their owner and campaign, and let possible
 * duplicates through. Team members import a Daily Lead Agent lead through /api/admin/daily-leads instead,
 * which calls the same helper for one lead of today's list.
 */
export async function POST(req: Request) {
  const auth = await requireOwnerOrAdmin();
  if (auth.response) return auth.response;
  // As before the move: refused callers never learn the database state, and an outage is a 503 before the body is read.
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { status, body } = await importCandidates(await req.json(), auth.session);
  return NextResponse.json(body, { status });
}
