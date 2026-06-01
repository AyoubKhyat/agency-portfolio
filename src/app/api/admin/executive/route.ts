import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({});

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalProspects,
    totalClients,
    activeProjects,
    wonDealsThisMonth,
    wonDealsLastMonth,
    proposalsSent,
    proposalsAccepted,
    totalRevenue,
    collectedRevenue,
    projectsByStatus,
    overdueTasks,
    teamMembers,
    recentWins,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: { in: ["CLIENT", "CONVERTI"] } } }),
    prisma.clientProject.count({ where: { status: { notIn: ["COMPLETED", "ON_HOLD"] } } }),
    prisma.proposal.count({ where: { status: "ACCEPTED", updatedAt: { gte: thisMonthStart } } }),
    prisma.proposal.count({ where: { status: "ACCEPTED", updatedAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
    prisma.proposal.count({ where: { status: { in: ["SENT", "ACCEPTED", "REJECTED"] } } }),
    prisma.proposal.count({ where: { status: "ACCEPTED" } }),
    prisma.proposal.aggregate({ where: { status: "ACCEPTED" }, _sum: { amount: true } }),
    prisma.clientProject.aggregate({ _sum: { amountPaid: true } }),
    prisma.clientProject.groupBy({ by: ["status"], _count: true }),
    prisma.clientProject.count({ where: { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "LIVE", "ON_HOLD"] } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.proposal.findMany({
      where: { status: "ACCEPTED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { prospect: { select: { name: true, sector: true } } },
    }),
  ]);

  const conversionRate = totalProspects > 0 ? Math.round((totalClients / totalProspects) * 100) : 0;
  const proposalAcceptRate = proposalsSent > 0 ? Math.round((proposalsAccepted / proposalsSent) * 100) : 0;

  return NextResponse.json({
    totalProspects,
    totalClients,
    activeProjects,
    wonDealsThisMonth,
    wonDealsLastMonth,
    conversionRate,
    proposalAcceptRate,
    totalRevenue: totalRevenue._sum.amount || 0,
    collectedRevenue: collectedRevenue._sum.amountPaid || 0,
    projectsByStatus,
    overdueTasks,
    teamMembers,
    recentWins,
  });
}
