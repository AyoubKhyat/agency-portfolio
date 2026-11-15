import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getWorkloadData } from "@/lib/dal";

export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const data = await getWorkloadData();
  return NextResponse.json(data);
}
