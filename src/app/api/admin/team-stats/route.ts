import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getTeamStats } from "@/lib/dal";

export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const stats = await getTeamStats();
  return NextResponse.json(stats);
}
