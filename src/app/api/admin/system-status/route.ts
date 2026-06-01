import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database", dbStatus: "down" }, { status: 503 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

  try {
    const [
      users,
      totalProspects,
      assignedProspects,
      unassignedProspects,
      missingPhone,
      missingInstagram,
      overdueFollowUps,
      followUpsDueToday,
      followUpsDueThisWeek,
      proposalDraft,
      proposalSent,
      proposalAccepted,
      proposalRejected,
      activeProjects,
      overdueProjects,
      completedProjects,
      unreadNotifications,
      recentActivities,
    ] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, fullName: true, avatarInitials: true, role: true, isActive: true, updatedAt: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.prospect.count(),
      prisma.prospect.count({ where: { ownerUserId: { not: null } } }),
      prisma.prospect.count({ where: { ownerUserId: null } }),
      prisma.prospect.count({ where: { phone: "" } }),
      prisma.prospect.count({ where: { instagram: "" } }),
      prisma.prospect.count({ where: { followUpDate: { lt: todayStart }, status: { notIn: ["REPONDU", "CONVERTI", "CLIENT", "LOST", "COMPLETED"] } } }),
      prisma.prospect.count({ where: { followUpDate: { gte: todayStart, lt: tomorrowStart } } }),
      prisma.prospect.count({ where: { followUpDate: { gte: todayStart, lt: weekEnd } } }),
      prisma.proposal.count({ where: { status: "DRAFT" } }),
      prisma.proposal.count({ where: { status: "SENT" } }),
      prisma.proposal.count({ where: { status: "ACCEPTED" } }),
      prisma.proposal.count({ where: { status: "REJECTED" } }),
      prisma.clientProject.count({ where: { status: { notIn: ["COMPLETED", "ON_HOLD"] } } }),
      prisma.clientProject.count({ where: { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "LIVE", "ON_HOLD"] } } }),
      prisma.clientProject.count({ where: { status: "COMPLETED" } }),
      prisma.notification.count({ where: { read: false } }),
      prisma.prospectActivity.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    const duplicatePhones = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT phone) as cnt FROM (
        SELECT phone FROM prospects WHERE phone != '' GROUP BY phone HAVING COUNT(*) > 1
      ) dups
    ` as { cnt: bigint }[];

    const duplicateInstagrams = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT instagram) as cnt FROM (
        SELECT instagram FROM prospects WHERE instagram != '' GROUP BY instagram HAVING COUNT(*) > 1
      ) dups
    ` as { cnt: bigint }[];

    const duplicateCount = Number(duplicatePhones[0]?.cnt || 0) + Number(duplicateInstagrams[0]?.cnt || 0);

    const lastActivityPerUser = await prisma.prospectActivity.groupBy({
      by: ["userId"],
      _max: { createdAt: true },
    });

    const team = users.map((u) => ({
      ...u,
      lastActivity: lastActivityPerUser.find((a) => a.userId === u.id)?._max.createdAt || null,
    }));

    return NextResponse.json({
      dbStatus: "ok",
      apiStatus: "ok",
      timestamp: now.toISOString(),
      team: {
        total: users.length,
        active: users.filter((u) => u.isActive).length,
        members: team,
      },
      crm: {
        total: totalProspects,
        assigned: assignedProspects,
        unassigned: unassignedProspects,
        duplicates: duplicateCount,
        missingPhone,
        missingInstagram,
      },
      followUps: {
        overdue: overdueFollowUps,
        dueToday: followUpsDueToday,
        dueThisWeek: followUpsDueThisWeek,
      },
      proposals: {
        draft: proposalDraft,
        sent: proposalSent,
        accepted: proposalAccepted,
        rejected: proposalRejected,
      },
      projects: {
        active: activeProjects,
        overdue: overdueProjects,
        completed: completedProjects,
      },
      system: {
        unreadNotifications,
        activitiesToday: recentActivities,
      },
    });
  } catch (e) {
    return NextResponse.json({
      dbStatus: "error",
      apiStatus: "ok",
      error: e instanceof Error ? e.message : "Unknown error",
    }, { status: 500 });
  }
}
