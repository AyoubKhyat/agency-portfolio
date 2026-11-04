import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { hasPrisma } from "@/lib/prisma";
import { getLeadQueue } from "@/lib/dal";

// Reads cookie → dynamic. The queue is only useful if it is current.
export const dynamic = "force-dynamic";

/** The Leads Command Center queue. Read-only: every action goes through the existing routes. */
export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  try {
    return NextResponse.json(await getLeadQueue());
  } catch {
    return NextResponse.json({ error: "Failed to load the queue" }, { status: 500 });
  }
}
