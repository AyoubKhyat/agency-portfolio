import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyMentionsInText } from "@/lib/notify";

const noteSchema = z.object({
  content: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const exists = await prisma.client.findUnique({ where: { id }, select: { id: true, companyName: true } });
  if (!exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const [note] = await prisma.$transaction([
    prisma.clientNote.create({
      data: {
        clientId: id,
        content: parsed.data.content,
        authorId: session.userId,
        authorName: session.fullName,
      },
    }),
    prisma.clientActivity.create({
      data: {
        clientId: id,
        userId: session.userId,
        userName: session.fullName,
        actionType: "NOTE_ADDED",
        details: parsed.data.content.slice(0, 120),
      },
    }),
  ]);

  // Fire @mention notifications (best-effort; never blocks the note).
  notifyMentionsInText({
    content: parsed.data.content,
    authorId: session.userId,
    authorName: session.fullName,
    link: `/admin/clients/${id}`,
    contextLabel: `a note on ${exists.companyName}`,
  }).catch(() => {});

  return NextResponse.json(note, { status: 201 });
}
