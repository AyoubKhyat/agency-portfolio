import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { z } from "zod";
import { prisma, hasPrisma } from "@/lib/prisma";

const schema = z.object({ emoji: z.string().min(1).max(12) });

async function assertMember(messageId: string, userId: string) {
  const m = await prisma.chatMessage.findUnique({ where: { id: messageId }, select: { channelId: true } });
  if (!m) return false;
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: m.channelId, userId } },
  });
  return !!member;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  const { session } = auth;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });

  if (!(await assertMember(id, session.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upsert so a second click is a toggle (existing → remove).
  const existing = await prisma.chatReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: id, userId: session.userId, emoji: parsed.data.emoji } },
  });
  if (existing) {
    await prisma.chatReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ toggled: "off" });
  }
  await prisma.chatReaction.create({
    data: { messageId: id, userId: session.userId, userName: session.fullName, emoji: parsed.data.emoji },
  });
  return NextResponse.json({ toggled: "on" });
}
