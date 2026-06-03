import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * POST /api/admin/chat/dm/[userId]
 *
 * Get-or-create a 2-person DM channel between the current user and the
 * target user. The slug is deterministic (sorted user IDs) so the same DM
 * is always reused.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { userId } = await params;
  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  const other = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, avatarInitials: true, isActive: true },
  });
  if (!other) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const sortedIds = [session.userId, other.id].sort();
  const slug = `dm-${sortedIds[0]}-${sortedIds[1]}`;

  let channel = await prisma.channel.findUnique({ where: { slug } });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        slug,
        name: `${session.fullName} & ${other.fullName}`,
        description: "",
        isDm: true,
      },
    });
    await prisma.channelMember.createMany({
      data: [
        { channelId: channel.id, userId: session.userId },
        { channelId: channel.id, userId: other.id },
      ],
    });
  } else {
    // Ensure both members exist (in case one was added later).
    for (const uid of sortedIds) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: channel.id, userId: uid } },
        create: { channelId: channel.id, userId: uid },
        update: {},
      });
    }
  }

  return NextResponse.json({ id: channel.id, slug: channel.slug, name: channel.name, isDm: true, partner: other });
}
