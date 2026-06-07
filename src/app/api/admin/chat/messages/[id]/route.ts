import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const editSchema = z.object({
  content: z.string().min(1).max(4000),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const message = await prisma.chatMessage.findUnique({ where: { id }, select: { authorId: true } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.authorId !== session.userId) return NextResponse.json({ error: "Can only edit your own messages" }, { status: 403 });

  const body = await req.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.chatMessage.update({
    where: { id },
    data: { content: parsed.data.content },
    include: { reactions: { select: { emoji: true, userId: true, userName: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const message = await prisma.chatMessage.findUnique({ where: { id }, select: { authorId: true } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.role === "admin";
  if (message.authorId !== session.userId && !isAdmin) {
    return NextResponse.json({ error: "Can only delete your own messages" }, { status: 403 });
  }

  await prisma.chatMessage.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
