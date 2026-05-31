import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRecentActivities } from "@/lib/dal";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const userId = url.searchParams.get("userId") || undefined;

  const activities = await getRecentActivities(limit, userId);
  return NextResponse.json(activities);
}
