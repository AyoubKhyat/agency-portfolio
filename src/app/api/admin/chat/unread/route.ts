import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * GET /api/admin/chat/unread
 *
 * Cheap roll-up endpoint used by the sidebar badge. Returns total unread
 * across every channel the user belongs to (excluding their own messages).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ unread: 0 });
  if (!hasPrisma()) return NextResponse.json({ unread: 0 });

  const memberships = await prisma.channelMember.findMany({
    where: { userId: session.userId },
    select: { channelId: true, lastReadAt: true },
  });
  if (memberships.length === 0) return NextResponse.json({ unread: 0 });

  let total = 0;
  for (const m of memberships) {
    total += await prisma.chatMessage.count({
      where: {
        channelId: m.channelId,
        authorId: { not: session.userId },
        ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
      },
    });
  }
  return NextResponse.json({ unread: total });
}
