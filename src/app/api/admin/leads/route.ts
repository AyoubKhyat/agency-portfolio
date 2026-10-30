import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getLeads } from "@/lib/dal";

export async function GET(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const status = url.searchParams.get("status") || undefined;

  const result = await getLeads(page, status);
  return NextResponse.json(result);
}
