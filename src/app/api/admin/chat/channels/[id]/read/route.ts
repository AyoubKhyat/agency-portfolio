import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * POST /api/admin/chat/channels/[id]/read
 *
 * Marks the current user as having read every message in this channel up to
 * "now". Used when the user opens the channel pane.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ success: true });

  const { id } = await params;
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: id, userId: session.userId } },
  });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  await prisma.channelMember.update({
    where: { channelId_userId: { channelId: id, userId: session.userId } },
    data: { lastReadAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
