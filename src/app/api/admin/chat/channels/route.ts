import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * GET /api/admin/chat/channels
 *
 * Returns every channel + DM the current user belongs to, with the unread
 * count for each (messages newer than the user's lastReadAt). The sidebar
 * uses this to render channel rows and unread badges in one pass.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ channels: [], dms: [] });

  const memberships = await prisma.channelMember.findMany({
    where: { userId: session.userId },
    include: {
      channel: {
        include: {
          members: {
            include: { user: { select: { id: true, fullName: true, avatarInitials: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, content: true, authorName: true, createdAt: true },
          },
        },
      },
    },
  });

  const channelsOut = [];
  const dmsOut = [];

  for (const m of memberships) {
    const c = m.channel;
    const unread = await prisma.chatMessage.count({
      where: {
        channelId: c.id,
        authorId: { not: session.userId },
        ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
      },
    });
    const lastMessage = c.messages[0] ?? null;
    const row = {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      isDm: c.isDm,
      unread,
      lastMessage,
      members: c.members.map((mm) => mm.user),
    };
    if (c.isDm) {
      // For DMs, expose the other participant for label/avatar.
      const partner = c.members.find((mm) => mm.userId !== session.userId)?.user ?? null;
      dmsOut.push({ ...row, partner });
    } else {
      channelsOut.push(row);
    }
  }

  // Sort: by unread desc, then alphabetically.
  channelsOut.sort((a, b) => (b.unread - a.unread) || a.name.localeCompare(b.name));
  dmsOut.sort((a, b) => (b.unread - a.unread) || (a.partner?.fullName ?? "").localeCompare(b.partner?.fullName ?? ""));

  return NextResponse.json({ channels: channelsOut, dms: dmsOut });
}
