import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLeadById, updateLeadStatus } from "@/lib/dal";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ status: z.enum(["NEW", "READ", "REPLIED", "CONVERTED"]) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const lead = await updateLeadStatus(id, parsed.data.status);
  return NextResponse.json(lead);
}
