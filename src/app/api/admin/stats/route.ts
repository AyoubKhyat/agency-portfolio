import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getDashboardStats } from "@/lib/dal";

export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
