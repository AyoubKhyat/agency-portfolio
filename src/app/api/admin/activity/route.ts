import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getRecentActivities } from "@/lib/dal";

export async function GET(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const userId = url.searchParams.get("userId") || undefined;

  const activities = await getRecentActivities(limit, userId);
  return NextResponse.json(activities);
}
