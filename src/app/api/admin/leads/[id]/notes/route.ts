import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addLeadNote } from "@/lib/dal";
import { notifyMentionsInText } from "@/lib/notify";
import { prisma, hasPrisma } from "@/lib/prisma";
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

  if (hasPrisma()) {
    const lead = await prisma.lead.findUnique({ where: { id }, select: { fullName: true } });
    notifyMentionsInText({
      content: parsed.data.content,
      authorId: session.userId,
      authorName: session.fullName,
      link: `/admin/leads/${id}`,
      contextLabel: `a note on ${lead?.fullName ?? "a lead"}`,
    }).catch(() => {});
  }

  return NextResponse.json(note, { status: 201 });
}
