import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addLeadNote } from "@/lib/dal";
import { z } from "zod";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ content: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const note = await addLeadNote(id, parsed.data.content);
  return NextResponse.json(note, { status: 201 });
}
