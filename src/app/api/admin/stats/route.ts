import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/dal";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
