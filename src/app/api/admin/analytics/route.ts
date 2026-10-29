import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getAnalyticsData } from "@/lib/dal";

export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  try {
    const data = await getAnalyticsData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
