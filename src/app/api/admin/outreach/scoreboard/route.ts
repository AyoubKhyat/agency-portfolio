import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Today's conversion-funnel scoreboard. Counts cross all team members.
 * Scope: from local midnight to now (server's timezone).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ today: zeros(), week: zeros() });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "today"; // "today" | "week"

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
  const start = scope === "week" ? weekStart : todayStart;

  const [
    messagesSent, replies, meetingsBooked, proposalsSent, clientsWon,
    // Also collect today's prospects-contacted count (distinct prospects we touched today)
    activeProspects,
  ] = await Promise.all([
    prisma.outreachMessage.count({ where: { sentAt: { gte: start } } }),
    prisma.outreachMessage.count({ where: { repliedAt: { gte: start } } }),
    prisma.meeting.count({ where: { createdAt: { gte: start } } }).catch(() => 0),
    prisma.proposal.count({ where: { createdAt: { gte: start } } }).catch(() => 0),
    prisma.client.count({ where: { createdAt: { gte: start } } }).catch(() => 0),
    prisma.outreachMessage.findMany({
      where: { sentAt: { gte: start } },
      select: { prospectId: true },
      distinct: ["prospectId"],
    }),
  ]);

  // Per-user today
  const perUserMessages = await prisma.outreachMessage.groupBy({
    by: ["sentById", "sentByName"],
    where: { sentAt: { gte: start }, sentById: { not: null } },
    _count: { id: true },
  });
  const perUserReplies = await prisma.outreachMessage.groupBy({
    by: ["sentById"],
    where: { repliedAt: { gte: start } },
    _count: { id: true },
  });
  const replyMap = new Map(perUserReplies.map((r) => [r.sentById, r._count.id]));

  const perUser = perUserMessages
    .map((m) => ({
      userId: m.sentById,
      name: m.sentByName,
      messagesSent: m._count.id,
      replies: replyMap.get(m.sentById) ?? 0,
      replyRate: m._count.id > 0 ? Math.round((((replyMap.get(m.sentById) ?? 0) / m._count.id)) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.messagesSent - a.messagesSent);

  return NextResponse.json({
    scope,
    counts: {
      messagesSent, replies,
      replyRate: messagesSent > 0 ? Math.round((replies / messagesSent) * 1000) / 10 : 0,
      prospectsContacted: activeProspects.length,
      meetingsBooked, proposalsSent, clientsWon,
    },
    perUser,
  });
}

function zeros() {
  return { messagesSent: 0, replies: 0, replyRate: 0, prospectsContacted: 0, meetingsBooked: 0, proposalsSent: 0, clientsWon: 0 };
}
