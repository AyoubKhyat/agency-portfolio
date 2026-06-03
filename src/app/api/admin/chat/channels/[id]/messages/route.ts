import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyMentionsInText } from "@/lib/notify";

const ATTACH_TYPES = ["PROSPECT", "CLIENT", "PROJECT", "TASK", "MEETING"] as const;

const sendSchema = z.object({
  content:     z.string().min(1, "Empty message").max(4000),
  attachType:  z.enum(ATTACH_TYPES).nullable().optional(),
  attachId:    z.string().nullable().optional(),
  attachLabel: z.string().nullable().optional(),
  attachHref:  z.string().nullable().optional(),
});

async function ensureMember(channelId: string, userId: string) {
  return prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { id } = await params;
  const member = await ensureMember(id, session.userId);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // ISO cursor for pagination
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 200);

  const messages = await prisma.chatMessage.findMany({
    where: {
      channelId: id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      reactions: { select: { emoji: true, userId: true, userName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Return in chronological order (oldest first).
  return NextResponse.json(messages.reverse());
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const member = await ensureMember(id, session.userId);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const data = parsed.data;

  const message = await prisma.chatMessage.create({
    data: {
      channelId: id,
      authorId: session.userId,
      authorName: session.fullName,
      content: data.content,
      attachType:  data.attachType  ?? null,
      attachId:    data.attachId    ?? null,
      attachLabel: data.attachLabel ?? null,
      attachHref:  data.attachHref  ?? null,
    },
    include: { reactions: true },
  });

  // Mark author's lastReadAt so the channel never shows unread to its own author.
  await prisma.channelMember.update({
    where: { channelId_userId: { channelId: id, userId: session.userId } },
    data: { lastReadAt: new Date() },
  });

  // @mention fan-out (notification only — no duplicate activity log).
  const channel = await prisma.channel.findUnique({ where: { id }, select: { slug: true, name: true, isDm: true } });
  notifyMentionsInText({
    content: data.content,
    authorId: session.userId,
    authorName: session.fullName,
    link: `/admin/chat?channel=${channel?.slug ?? id}`,
    contextLabel: channel?.isDm ? `your DM with ${session.fullName}` : `#${channel?.name ?? "chat"}`,
  }).catch(() => {});

  return NextResponse.json(message, { status: 201 });
}
