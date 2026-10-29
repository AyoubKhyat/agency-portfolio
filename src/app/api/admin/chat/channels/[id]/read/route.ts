import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * POST /api/admin/chat/channels/[id]/read
 *
 * Marks the current user as having read every message in this channel up to
 * "now". Used when the user opens the channel pane.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  const { session } = auth;
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
