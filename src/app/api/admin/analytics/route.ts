import { NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/dal";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getAnalyticsData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
