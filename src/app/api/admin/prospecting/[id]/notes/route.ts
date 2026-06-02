import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addProspectNote, logProspectActivity } from "@/lib/dal";
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

  const note = await addProspectNote(id, parsed.data.content, session.userId, session.fullName);

  await logProspectActivity({
    prospectId: id,
    userId: session.userId,
    userName: session.fullName,
    actionType: "NOTE_ADDED",
    details: parsed.data.content.slice(0, 200),
  });

  // Fire mention notifications (best-effort).
  if (hasPrisma()) {
    const p = await prisma.prospect.findUnique({ where: { id }, select: { name: true } });
    notifyMentionsInText({
      content: parsed.data.content,
      authorId: session.userId,
      authorName: session.fullName,
      link: `/admin/prospecting/${id}`,
      contextLabel: `a note on ${p?.name ?? "a prospect"}`,
    }).catch(() => {});
  }

  return NextResponse.json(note, { status: 201 });
}
