import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getStageByKey } from "@/lib/prospect-stages";
import { buildBusinessMoney, SIGNED_CONTRACT_STATUSES, AWAITING_SIGNATURE_STATUS } from "@/lib/business-report";

/** Stored statuses of the shared Won stage (CLIENT / CONVERTI). */
const WON_STATUSES = getStageByKey("WON")?.statuses ?? [];

/**
 * Single CEO-grade aggregator. Everything the Command Center page needs in one
 * round trip — no per-widget /api calls.
 *
 * Reuses the existing Notification / Activity / Task models. Doesn't introduce
 * new tables. Numbers below are sourced as follows:
 *
 *   Money figures      = built by src/lib/business-report.ts (MAD only, no
 *                        conversion, no fallback): signed contract value,
 *                        sent-proposal pipeline, drafts, contracts awaiting
 *                        signature, accepted-but-unsigned proposals, and paid
 *                        invoices (VAT included) on their own.
 *   Active clients     = Client.status = ACTIVE
 *   Active projects    = ClientProject not in (COMPLETED, ON_HOLD)
 *   Meetings this week = startAt within 7-day window
 *   Tasks overdue      = open tasks past their due date
 *   Prospects won      = prospects in the Won stage (CLIENT / CONVERTI) /
 *                        total prospects, all time (shown as "Prospects won (%)")
 *   Funnel             = all-time counts, no date window
 */
export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = startOfDay(now);
  const weekEnd = addDays(today, 7);
  const thirtyDaysAgo = addDays(today, -30);

  const [
    // Money: plain rows, every rule lives in business-report.ts
    proposalRows,
    contractRows,
    paidInvoiceRows,
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
    // Team breakdown
    teamMembers,
  ] = await Promise.all([
    prisma.proposal.findMany({
      where: { status: { in: ["DRAFT", "SENT", "ACCEPTED"] } },
      select: { id: true, status: true, amount: true, currency: true },
    }),
    prisma.contract.findMany({
      where: { status: { in: [...SIGNED_CONTRACT_STATUSES, AWAITING_SIGNATURE_STATUS] } },
      select: {
        id: true, status: true, amount: true, currency: true, proposalId: true, signedDate: true, createdById: true,
        prospect: { select: { sector: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { status: "PAID" },
      select: { status: true, total: true, currency: true, paidAt: true },
    }),

    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.client.count(),
    prisma.clientProject.count({ where: { status: { notIn: ["COMPLETED", "ON_HOLD"] } } }),
    prisma.meeting.count({ where: { startAt: { gte: today, lt: weekEnd } } }),
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: today } } }),
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: { in: [...WON_STATUSES] } } }),

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

    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, avatarInitials: true, role: true },
    }),
  ]);

  const money = buildBusinessMoney({
    proposals: proposalRows,
    contracts: contractRows.map((c) => ({
      id: c.id, status: c.status, amount: c.amount, currency: c.currency, proposalId: c.proposalId,
      signedDate: c.signedDate, createdById: c.createdById, sector: c.prospect?.sector ?? null,
    })),
    invoices: paidInvoiceRows,
  }, now);

  const conversionRate = totalProspects > 0
    ? Math.round((convertedProspects / totalProspects) * 100)
    : 0;

  // Leaderboard and sectors use the same MAD-only signed contracts as the totals.
  const top = money.topSalesperson;
  const topUser = top ? teamMembers.find((t) => t.id === top.userId) : null;
  const topSalesperson = top
    ? { userId: top.userId, fullName: topUser?.fullName ?? null, avatarInitials: topUser?.avatarInitials ?? null, revenue: top.revenue, deals: top.deals }
    : null;
  const topSector = money.sectors[0] ?? null;

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
    // Counts stored follow-up dates, including historical records; not all are backed by a recorded send.
    { label: "Overdue follow-up dates",  count: overdueFollowUps,       severity: severityFor(overdueFollowUps, 1, 10) },
    { label: "Stale clients (30d)",      count: staleClients,           severity: severityFor(staleClients, 1, 5) },
    { label: "Contracts expiring 30d",   count: contractsExpiring,      severity: severityFor(contractsExpiring, 1, 3) },
    { label: "Meetings missing outcome", count: meetingsWithoutOutcome, severity: severityFor(meetingsWithoutOutcome, 1, 5) },
  ];
  const crmHealthScore = computeHealthScore(crmHealthSignals);

  return NextResponse.json({
    kpis: {
      activeClients: activeClientsCount,
      totalClients: totalClientsCount,
      activeProjects: activeProjectsCount,
      meetingsThisWeek: meetingsThisWeekCount,
      tasksOverdue: tasksOverdueCount,
      conversionRate,
    },
    money: {
      signed: money.signed,
      pipeline: money.pipeline,
      paidInvoices: money.paidInvoices,
      excluded: money.excluded,
      proposalsWithSeveralContracts: money.proposalsWithSeveralContracts,
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
    sectorBreakdown: money.sectors,
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
