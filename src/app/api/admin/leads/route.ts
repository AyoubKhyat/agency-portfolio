import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLeads } from "@/lib/dal";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const status = url.searchParams.get("status") || undefined;

  const result = await getLeads(page, status);
  return NextResponse.json(result);
}
