import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Single CEO-grade aggregator. Everything the Command Center page needs in one
 * round trip — no per-widget /api calls.
 *
 * Reuses the existing Notification / Activity / Task models. Doesn't introduce
 * new tables. Numbers below are sourced as follows:
 *
 *   Revenue won        = sum of SIGNED + ACTIVE + COMPLETED contracts
 *                        (falls back to ACCEPTED proposals if no contracts)
 *   Pipeline value     = sum of DRAFT + SENT proposals + DRAFT +
 *                        PENDING_SIGNATURE contracts
 *   Revenue forecast   = accepted proposals + signed contracts + active
 *                        contract value (deduplicating where they overlap)
 *   Active clients     = Client.status = ACTIVE
 *   Active projects    = ClientProject not in (COMPLETED, ON_HOLD)
 *   Meetings this week = startAt within 7-day window
 *   Tasks overdue      = open tasks past their due date
 *   Conversion rate    = prospects with status CLIENT / total prospects
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = startOfDay(now);
  const weekEnd = addDays(today, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = addDays(today, -30);

  const [
    // Revenue
    contractsRevenue,       // SIGNED + ACTIVE + COMPLETED contracts
    acceptedProposals,      // ACCEPTED proposals
    pipelineProposals,      // DRAFT + SENT
    pipelineContracts,      // DRAFT + PENDING_SIGNATURE
    signedAndActiveValue,   // SIGNED + ACTIVE — current forecast
    wonThisMonth,
    wonLastMonth,
    // Counts
    activeClientsCount,
    totalClientsCount,
    activeProjectsCount,
    meetingsThisWeekCount,
    tasksOverdueCount,
    totalProspects,
    convertedProspects,
    // Funnel — counts as a chain
    funnelScheduled,
    funnelCompleted,
    funnelProposalSent,
    funnelContractSigned,
    funnelClients,
    // Recent wins (signed contracts, fall back to accepted proposals)
    recentSignedContracts,
    // Projects at risk
    projectsAtRisk,
    // Overdue tasks (top 5)
    overdueTasks,
    // Upcoming meetings (next 7 days)
    upcomingMeetings,
    // Sectors with revenue
    sectorBreakdown,
    // Team breakdown
    teamMembers,
  ] = await Promise.all([
    prisma.contract.aggregate({ where: { status: { in: ["SIGNED", "ACTIVE", "COMPLETED"] } }, _sum: { amount: true } }),
    prisma.proposal.aggregate({ where: { status: "ACCEPTED" }, _sum: { amount: true } }),
    prisma.proposal.aggregate({ where: { status: { in: ["DRAFT", "SENT"] } }, _sum: { amount: true } }),
    prisma.contract.aggregate({ where: { status: { in: ["DRAFT", "PENDING_SIGNATURE"] } }, _sum: { amount: true } }),
    prisma.contract.aggregate({ where: { status: { in: ["SIGNED", "ACTIVE"] } }, _sum: { amount: true } }),
    prisma.contract.aggregate({ where: { status: { in: ["SIGNED", "ACTIVE", "COMPLETED"] }, signedDate: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.contract.aggregate({ where: { status: { in: ["SIGNED", "ACTIVE", "COMPLETED"] }, signedDate: { gte: lastMonthStart, lt: monthStart } }, _sum: { amount: true }, _count: true }),

    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.client.count(),
    prisma.clientProject.count({ where: { status: { notIn: ["COMPLETED", "ON_HOLD"] } } }),
    prisma.meeting.count({ where: { startAt: { gte: today, lt: weekEnd } } }),
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: today } } }),
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: { in: ["CLIENT", "CONVERTI"] } } }),

    prisma.meeting.count(),
    prisma.meeting.count({ where: { status: "COMPLETED" } }),
    prisma.proposal.count({ where: { status: { in: ["SENT", "ACCEPTED", "REJECTED"] } } }),
    prisma.contract.count({ where: { status: { in: ["SIGNED", "ACTIVE", "COMPLETED"] } } }),
    prisma.client.count(),

    prisma.contract.findMany({
      where: { status: { in: ["SIGNED", "ACTIVE", "COMPLETED"] } },
      orderBy: { signedDate: "desc" },
      take: 6,
      include: {
        client:   { select: { id: true, companyName: true } },
        prospect: { select: { id: true, name: true, sector: true } },
      },
    }),

    prisma.clientProject.findMany({
      where: {
        status: { notIn: ["COMPLETED", "ON_HOLD"] },
        OR: [
          { dueDate: { lt: now } },
          { dueDate: { lt: addDays(now, 7) } },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),

    prisma.task.findMany({
      where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { owner: { select: { id: true, fullName: true, avatarInitials: true } } },
    }),

    prisma.meeting.findMany({
      where: { startAt: { gte: now, lt: weekEnd }, status: "SCHEDULED" },
      orderBy: { startAt: "asc" },
      take: 6,
      include: {
        client:   { select: { id: true, companyName: true } },
        prospect: { select: { id: true, name: true } },
        owner:    { select: { id: true, fullName: true, avatarInitials: true } },
      },
    }),

    // Top sectors by revenue (contracts grouped via prospect.sector)
    prisma.$queryRaw<{ sector: string; revenue: number; deals: bigint }[]>`
      SELECT p.sector AS sector,
             COALESCE(SUM(c.amount), 0)::float AS revenue,
             COUNT(c.id) AS deals
      FROM contracts c
      LEFT JOIN prospects p ON p.id = c.prospect_id
      WHERE c.status IN ('SIGNED', 'ACTIVE', 'COMPLETED') AND p.sector IS NOT NULL AND p.sector <> ''
      GROUP BY p.sector
      ORDER BY revenue DESC
      LIMIT 5
    `,

    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, avatarInitials: true, role: true },
    }),
  ]);

  // Revenue won: prefer real contract revenue when present, fall back to
  // accepted-proposal amounts during the early-data window where no contracts
  // exist yet.
  const contractsAmount = contractsRevenue._sum.amount ?? 0;
  const acceptedAmount  = acceptedProposals._sum.amount ?? 0;
  const revenueWon = contractsAmount > 0 ? contractsAmount : acceptedAmount;

  // Pipeline value: open proposals + open contract drafts.
  const pipelineValue =
    (pipelineProposals._sum.amount ?? 0) +
    (pipelineContracts._sum.amount ?? 0);

  // Forecast = signed + active contract value + accepted proposals not yet
  // contracted (rough estimate).
  const revenueForecast =
    (signedAndActiveValue._sum.amount ?? 0) +
    Math.max(0, acceptedAmount - contractsAmount);

  const conversionRate = totalProspects > 0
    ? Math.round((convertedProspects / totalProspects) * 100)
    : 0;

  // Top salesperson: count signed contracts per createdBy in last 90 days.
  const salesAgg = await prisma.contract.groupBy({
    by: ["createdById"],
    where: { status: { in: ["SIGNED", "ACTIVE", "COMPLETED"] }, signedDate: { not: null } },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 1,
  });
  let topSalesperson: { userId: string | null; fullName: string | null; avatarInitials: string | null; revenue: number; deals: number } | null = null;
  if (salesAgg.length > 0) {
    const top = salesAgg[0];
    const u = top.createdById ? teamMembers.find((t) => t.id === top.createdById) : null;
    topSalesperson = {
      userId: top.createdById,
      fullName: u?.fullName ?? null,
      avatarInitials: u?.avatarInitials ?? null,
      revenue: top._sum.amount ?? 0,
      deals: top._count._all,
    };
  }

  const topSector = sectorBreakdown.length > 0
    ? { sector: sectorBreakdown[0].sector, revenue: sectorBreakdown[0].revenue, deals: Number(sectorBreakdown[0].deals) }
    : null;

  // CRM health: a quick rollup of red-flag signals.
  const [
    unassignedProspects,
    missingPhone,
    overdueFollowUps,
    staleClients,
    contractsExpiring,
    meetingsWithoutOutcome,
  ] = await Promise.all([
    prisma.prospect.count({ where: { ownerUserId: null, status: { notIn: ["CLIENT", "LOST", "CONVERTI"] } } }),
    prisma.prospect.count({ where: { phone: "" } }),
    prisma.prospect.count({
      where: {
        followUpDate: { lt: today },
        status: { notIn: ["REPONDU", "CONVERTI", "CLIENT", "LOST", "COMPLETED"] },
      },
    }),
    prisma.client.count({
      where: { status: "ACTIVE", updatedAt: { lt: thirtyDaysAgo } },
    }),
    prisma.contract.count({
      where: {
        status: { in: ["ACTIVE", "SIGNED"] },
        endDate: { gte: now, lte: addDays(now, 30) },
      },
    }),
    prisma.meeting.count({ where: { status: "COMPLETED", outcome: "" } }),
  ]);

  const crmHealthSignals = [
    { label: "Unassigned prospects",     count: unassignedProspects,    severity: severityFor(unassignedProspects, 5, 20) },
    { label: "Missing phone",            count: missingPhone,           severity: severityFor(missingPhone, 5, 30) },
    { label: "Overdue follow-ups",       count: overdueFollowUps,       severity: severityFor(overdueFollowUps, 1, 10) },
    { label: "Stale clients (30d)",      count: staleClients,           severity: severityFor(staleClients, 1, 5) },
    { label: "Contracts expiring 30d",   count: contractsExpiring,      severity: severityFor(contractsExpiring, 1, 3) },
    { label: "Meetings missing outcome", count: meetingsWithoutOutcome, severity: severityFor(meetingsWithoutOutcome, 1, 5) },
  ];
  const crmHealthScore = computeHealthScore(crmHealthSignals);

  return NextResponse.json({
    kpis: {
      revenueWon,
      pipelineValue,
      revenueForecast,
      activeClients: activeClientsCount,
      totalClients: totalClientsCount,
      activeProjects: activeProjectsCount,
      meetingsThisWeek: meetingsThisWeekCount,
      tasksOverdue: tasksOverdueCount,
      conversionRate,
      wonThisMonth: { amount: wonThisMonth._sum.amount ?? 0, count: wonThisMonth._count ?? 0 },
      wonLastMonth: { amount: wonLastMonth._sum.amount ?? 0, count: wonLastMonth._count ?? 0 },
    },
    funnel: {
      scheduled:        funnelScheduled,
      completed:        funnelCompleted,
      proposalSent:     funnelProposalSent,
      contractSigned:   funnelContractSigned,
      clients:          funnelClients,
    },
    recentWins: recentSignedContracts.map((c) => ({
      id: c.id,
      title: c.title,
      amount: c.amount,
      currency: c.currency,
      signedDate: c.signedDate?.toISOString() ?? null,
      client: c.client,
      prospect: c.prospect,
      createdByName: c.createdByName,
    })),
    projectsAtRisk: projectsAtRisk.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      status: p.status,
      dueDate: p.dueDate?.toISOString() ?? null,
      progress: p.progress,
      daysOverdue: p.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86_400_000)) : 0,
    })),
    overdueTasks,
    upcomingMeetings,
    topSalesperson,
    topSector,
    sectorBreakdown: sectorBreakdown.map((s) => ({ sector: s.sector, revenue: s.revenue, deals: Number(s.deals) })),
    crmHealth: {
      score: crmHealthScore,
      signals: crmHealthSignals,
    },
  });
}

function severityFor(count: number, warnAt: number, dangerAt: number): "ok" | "warn" | "danger" {
  if (count >= dangerAt) return "danger";
  if (count >= warnAt) return "warn";
  return "ok";
}

function computeHealthScore(signals: { severity: "ok" | "warn" | "danger" }[]): number {
  let score = 100;
  for (const s of signals) {
    if (s.severity === "danger") score -= 15;
    else if (s.severity === "warn") score -= 7;
  }
  return Math.max(0, Math.min(100, score));
}
