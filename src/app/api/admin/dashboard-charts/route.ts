import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ leadFunnel: [], prospectPipeline: [], revenue: [], sectorDistribution: [], weeklyActivity: [], teamPerformance: [] });

  const now = new Date();

  // ── 1. Lead funnel: count per status ────────────────────────
  const leadFunnelRaw = await prisma.lead.groupBy({
    by: ["status"],
    _count: true,
  });
  const leadOrder = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];
  const leadFunnel = leadOrder.map((status) => ({
    status,
    count: leadFunnelRaw.find((r) => r.status === status)?._count || 0,
  }));

  // ── 2. Prospect pipeline: count per status ──────────────────
  const prospectPipelineRaw = await prisma.prospect.groupBy({
    by: ["status"],
    _count: true,
  });
  const prospectOrder = ["A_ENVOYER", "ENVOYE", "REPONDU", "MEETING", "PROPOSAL_SENT", "CLIENT"];
  const prospectPipeline = prospectOrder.map((status) => ({
    status,
    count: prospectPipelineRaw.find((r) => r.status === status)?._count || 0,
  }));

  // ── 3. Revenue: paid invoices grouped by month (last 6 months) ──
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const paidInvoices = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: sixMonthsAgo },
    },
    select: { total: true, paidAt: true },
  });

  // Also include accepted proposals as revenue source
  const acceptedProposals = await prisma.proposal.findMany({
    where: {
      status: "ACCEPTED",
      updatedAt: { gte: sixMonthsAgo },
    },
    select: { amount: true, updatedAt: true },
  });

  const revenueMap: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revenueMap[key] = 0;
  }

  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue;
    const d = new Date(inv.paidAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in revenueMap) revenueMap[key] += inv.total;
  }

  for (const prop of acceptedProposals) {
    const d = new Date(prop.updatedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in revenueMap) revenueMap[key] += prop.amount;
  }

  const revenue = Object.entries(revenueMap).map(([month, amount]) => ({
    month,
    label: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short" }),
    amount: Math.round(amount),
  }));

  // ── 4. Sector distribution: prospect count by sector (top 8) ──
  const sectorRaw = await prisma.prospect.groupBy({
    by: ["sector"],
    _count: { sector: true },
    orderBy: { _count: { sector: "desc" } },
    take: 8,
  });
  const sectorDistribution = sectorRaw.map((s) => ({
    sector: s.sector,
    count: s._count.sector,
  }));

  // ── 5. Weekly activity: prospect activities per day (last 7 days) ──
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const activities = await prisma.prospectActivity.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const activityMap: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    activityMap[key] = 0;
  }

  for (const a of activities) {
    const key = new Date(a.createdAt).toISOString().slice(0, 10);
    if (key in activityMap) activityMap[key]++;
  }

  const weeklyActivity = Object.entries(activityMap).map(([date, count]) => ({
    date,
    label: new Date(date).toLocaleDateString("fr-FR", { weekday: "short" }),
    count,
  }));

  // ── 6. Team performance: per user stats ─────────────────────
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      avatarInitials: true,
      sentProspects: { select: { id: true } },
    },
  });

  const teamPerformance = await Promise.all(
    users.map(async (u) => {
      const sent = await prisma.prospect.count({
        where: { sentByUserId: u.id, status: { not: "A_ENVOYER" } },
      });
      const replied = await prisma.prospect.count({
        where: { sentByUserId: u.id, status: { in: ["REPONDU", "MEETING", "PROPOSAL_SENT", "CLIENT", "CONVERTI"] } },
      });
      const converted = await prisma.prospect.count({
        where: { sentByUserId: u.id, status: { in: ["CLIENT", "CONVERTI"] } },
      });
      return {
        name: u.fullName,
        initials: u.avatarInitials,
        sent,
        replied,
        converted,
      };
    })
  );

  return NextResponse.json({
    leadFunnel,
    prospectPipeline,
    revenue,
    sectorDistribution,
    weeklyActivity,
    teamPerformance,
  });
}
