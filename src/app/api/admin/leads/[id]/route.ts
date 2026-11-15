import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { getLeadById, updateLeadStatus } from "@/lib/dal";
import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/lead-status";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ status: z.enum(LEAD_STATUSES) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const lead = await updateLeadStatus(id, parsed.data.status);
  return NextResponse.json(lead);
}
