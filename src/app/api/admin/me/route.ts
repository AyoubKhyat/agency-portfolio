import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";

export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  const { session } = auth;
  return NextResponse.json(session);
}
