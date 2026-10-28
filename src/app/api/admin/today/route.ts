import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { hasPrisma } from "@/lib/prisma";
import { getTodaySummary } from "@/lib/dal";

// Reads cookie → dynamic. The Today view is only useful if it is current.
export const dynamic = "force-dynamic";

/** Today dashboard summary. Read-only: counts and short lists, no writes. */
export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  try {
    return NextResponse.json(await getTodaySummary());
  } catch {
    return NextResponse.json({ error: "Failed to load today" }, { status: 500 });
  }
}
