import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * System Status v2.
 *
 * Returns a structured `checks` block per business area (meetings, contracts,
 * clients, projects, tasks, crm). Each check has:
 *   - id      stable identifier the UI can route on
 *   - label   human title
 *   - count   how many records hit the condition
 *   - severity 'ok' | 'warn' | 'danger'
 *   - records sample of the offending IDs (max 5) for quick-action links
 *   - href    deep link to the relevant admin page (with filter)
 *
 * Plus an overall `healthScore` 0-100. Reuses existing tables only.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database", dbStatus: "down" }, { status: 503 });

  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);
  const sevenDaysAgo = addDays(now, -7);
  const fourteenDaysAgo = addDays(now, -14);
  const thirtyDaysAgo = addDays(now, -30);
  const thirtyDaysFromNow = addDays(now, 30);

  try {
    // ─── Team ────────────────────────────────────────────────────────────
    const users = await prisma.user.findMany({
      select: { id: true, fullName: true, avatarInitials: true, role: true, isActive: true, updatedAt: true },
      orderBy: { fullName: "asc" },
    });
    const lastActivityPerUser = await prisma.prospectActivity.groupBy({
      by: ["userId"],
      _max: { createdAt: true },
    });
    const team = users.map((u) => ({
      ...u,
      lastActivity: lastActivityPerUser.find((a) => a.userId === u.id)?._max.createdAt || null,
    }));

    // ─── Meetings ────────────────────────────────────────────────────────
    const [
      meetingsPastScheduled,
      meetingsNoOutcome,
      meetingsNoNextAction,
    ] = await Promise.all([
      prisma.meeting.findMany({
        where: { status: "SCHEDULED", startAt: { lt: now } },
        select: { id: true, title: true, startAt: true, client: { select: { companyName: true } }, prospect: { select: { name: true } } },
        orderBy: { startAt: "asc" },
        take: 5,
      }),
      prisma.meeting.findMany({
        where: { status: "COMPLETED", outcome: "" },
        select: { id: true, title: true, startAt: true, client: { select: { companyName: true } }, prospect: { select: { name: true } } },
        orderBy: { startAt: "desc" },
        take: 5,
      }),
      prisma.meeting.findMany({
        where: { status: "COMPLETED", nextAction: "" },
        select: { id: true, title: true, startAt: true, client: { select: { companyName: true } }, prospect: { select: { name: true } } },
        orderBy: { startAt: "desc" },
        take: 5,
      }),
    ]);
    const [meetingsPastScheduledCount, meetingsNoOutcomeCount, meetingsNoNextActionCount] = await Promise.all([
      prisma.meeting.count({ where: { status: "SCHEDULED", startAt: { lt: now } } }),
      prisma.meeting.count({ where: { status: "COMPLETED", outcome: "" } }),
      prisma.meeting.count({ where: { status: "COMPLETED", nextAction: "" } }),
    ]);

    // ─── Contracts ───────────────────────────────────────────────────────
    const [
      contractsDraftAged,
      contractsPendingAged,
      contractsExpiringSoon,
      contractsMissingStart,
    ] = await Promise.all([
      prisma.contract.findMany({
        where: { status: "DRAFT", createdAt: { lt: sevenDaysAgo } },
        select: { id: true, title: true, createdAt: true, amount: true, currency: true, client: { select: { companyName: true } }, prospect: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
      prisma.contract.findMany({
        where: { status: "PENDING_SIGNATURE", updatedAt: { lt: sevenDaysAgo } },
        select: { id: true, title: true, updatedAt: true, amount: true, currency: true, client: { select: { companyName: true } }, prospect: { select: { name: true } } },
        orderBy: { updatedAt: "asc" },
        take: 5,
      }),
      prisma.contract.findMany({
        where: { status: { in: ["ACTIVE", "SIGNED"] }, endDate: { gte: now, lte: thirtyDaysFromNow } },
        select: { id: true, title: true, endDate: true, amount: true, currency: true, client: { select: { companyName: true } }, prospect: { select: { name: true } } },
        orderBy: { endDate: "asc" },
        take: 5,
      }),
      prisma.contract.findMany({
        where: { status: { in: ["SIGNED", "ACTIVE"] }, startDate: null },
        select: { id: true, title: true, client: { select: { companyName: true } } },
        take: 5,
      }),
    ]);
    const [contractsDraftAgedCount, contractsPendingAgedCount, contractsExpiringSoonCount, contractsMissingStartCount] = await Promise.all([
      prisma.contract.count({ where: { status: "DRAFT", createdAt: { lt: sevenDaysAgo } } }),
      prisma.contract.count({ where: { status: "PENDING_SIGNATURE", updatedAt: { lt: sevenDaysAgo } } }),
      prisma.contract.count({ where: { status: { in: ["ACTIVE", "SIGNED"] }, endDate: { gte: now, lte: thirtyDaysFromNow } } }),
      prisma.contract.count({ where: { status: { in: ["SIGNED", "ACTIVE"] }, startDate: null } }),
    ]);

    // ─── Clients ─────────────────────────────────────────────────────────
    const [
      clientsNoManager,
      clientsStale,
      clientsNoActiveProject,
    ] = await Promise.all([
      prisma.client.findMany({
        where: { accountManagerId: null, status: "ACTIVE" },
        select: { id: true, companyName: true, industry: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.client.findMany({
        where: { status: "ACTIVE", updatedAt: { lt: thirtyDaysAgo } },
        select: { id: true, companyName: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 5,
      }),
      prisma.$queryRaw<{ id: string; company_name: string }[]>`
        SELECT c.id, c.company_name
        FROM clients c
        WHERE c.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM client_projects cp
            WHERE cp.client_id = c.id AND cp.status NOT IN ('COMPLETED', 'ON_HOLD')
          )
        LIMIT 5
      `,
    ]);
    const [clientsNoManagerCount, clientsStaleCount, clientsNoActiveProjectCountRaw] = await Promise.all([
      prisma.client.count({ where: { accountManagerId: null, status: "ACTIVE" } }),
      prisma.client.count({ where: { status: "ACTIVE", updatedAt: { lt: thirtyDaysAgo } } }),
      prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) AS cnt FROM clients c
        WHERE c.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM client_projects cp
            WHERE cp.client_id = c.id AND cp.status NOT IN ('COMPLETED', 'ON_HOLD')
          )
      `,
    ]);
    const clientsNoActiveProjectCount = Number(clientsNoActiveProjectCountRaw[0]?.cnt ?? 0);

    // ─── Projects ────────────────────────────────────────────────────────
    const [
      projectsOverdue,
      projectsNoOwner,
      projectsInactive,
      projectsNoTasksRaw,
    ] = await Promise.all([
      prisma.clientProject.findMany({
        where: { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "LIVE", "ON_HOLD"] } },
        select: { id: true, name: true, clientName: true, dueDate: true, status: true, progress: true },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      prisma.clientProject.findMany({
        where: { ownerUserId: null, status: { notIn: ["COMPLETED", "ON_HOLD"] } },
        select: { id: true, name: true, clientName: true },
        take: 5,
      }),
      prisma.clientProject.findMany({
        where: { status: { notIn: ["COMPLETED", "ON_HOLD"] }, updatedAt: { lt: fourteenDaysAgo } },
        select: { id: true, name: true, clientName: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: 5,
      }),
      prisma.$queryRaw<{ id: string; name: string; client_name: string }[]>`
        SELECT cp.id, cp.name, cp.client_name
        FROM client_projects cp
        WHERE cp.status NOT IN ('COMPLETED', 'ON_HOLD')
          AND NOT EXISTS (
            SELECT 1 FROM tasks t WHERE t.parent_type = 'PROJECT' AND t.parent_id = cp.id
          )
        LIMIT 5
      `,
    ]);
    const [projectsOverdueCount, projectsNoOwnerCount, projectsInactiveCount, projectsNoTasksCountRaw] = await Promise.all([
      prisma.clientProject.count({ where: { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "LIVE", "ON_HOLD"] } } }),
      prisma.clientProject.count({ where: { ownerUserId: null, status: { notIn: ["COMPLETED", "ON_HOLD"] } } }),
      prisma.clientProject.count({ where: { status: { notIn: ["COMPLETED", "ON_HOLD"] }, updatedAt: { lt: fourteenDaysAgo } } }),
      prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) AS cnt FROM client_projects cp
        WHERE cp.status NOT IN ('COMPLETED', 'ON_HOLD')
          AND NOT EXISTS (
            SELECT 1 FROM tasks t WHERE t.parent_type = 'PROJECT' AND t.parent_id = cp.id
          )
      `,
    ]);
    const projectsNoTasksCount = Number(projectsNoTasksCountRaw[0]?.cnt ?? 0);

    // ─── Tasks ───────────────────────────────────────────────────────────
    const [tasksOverdueCount, tasksUnassignedCount, tasksBlockedCount, tasksOverdueSample] = await Promise.all([
      prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: todayStart } } }),
      prisma.task.count({ where: { ownerId: null, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } }),
      prisma.task.count({ where: { status: "BLOCKED" } }),
      prisma.task.findMany({
        where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: todayStart } },
        select: { id: true, title: true, dueDate: true, ownerName: true, parentLabel: true },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
    ]);

    // ─── CRM ─────────────────────────────────────────────────────────────
    const [
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
      completedProjects,
      unreadNotifications,
      recentActivities,
      staleProspectsCount,
    ] = await Promise.all([
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
      prisma.clientProject.count({ where: { status: "COMPLETED" } }),
      prisma.notification.count({ where: { read: false } }),
      prisma.prospectActivity.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.prospect.count({
        where: {
          status: { in: ["ENVOYE", "REPONDU"] },
          updatedAt: { lt: thirtyDaysAgo },
        },
      }),
    ]);

    const duplicatePhonesRaw = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(DISTINCT phone) AS cnt FROM (
        SELECT phone FROM prospects WHERE phone <> '' GROUP BY phone HAVING COUNT(*) > 1
      ) dups
    `;
    const duplicateInstagramsRaw = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(DISTINCT instagram) AS cnt FROM (
        SELECT instagram FROM prospects WHERE instagram <> '' GROUP BY instagram HAVING COUNT(*) > 1
      ) dups
    `;
    const duplicatePhoneCount = Number(duplicatePhonesRaw[0]?.cnt || 0);
    const duplicateInstagramCount = Number(duplicateInstagramsRaw[0]?.cnt || 0);

    function sev(count: number, warnAt: number, dangerAt: number) {
      if (count >= dangerAt) return "danger" as const;
      if (count >= warnAt) return "warn" as const;
      return "ok" as const;
    }

    const checks = {
      meetings: [
        { id: "past-scheduled",  label: "Past meetings still SCHEDULED",  count: meetingsPastScheduledCount, severity: sev(meetingsPastScheduledCount, 1, 5), records: meetingsPastScheduled,    href: "/admin/meetings?scope=missed" },
        { id: "no-outcome",      label: "Completed without outcome",      count: meetingsNoOutcomeCount,     severity: sev(meetingsNoOutcomeCount, 2, 8),     records: meetingsNoOutcome,       href: "/admin/meetings?scope=all" },
        { id: "no-next-action",  label: "Completed without next action",  count: meetingsNoNextActionCount,  severity: sev(meetingsNoNextActionCount, 2, 8),  records: meetingsNoNextAction,    href: "/admin/meetings?scope=all" },
      ],
      contracts: [
        { id: "draft-aged",      label: "DRAFT contracts > 7 days",       count: contractsDraftAgedCount,    severity: sev(contractsDraftAgedCount, 1, 3),    records: contractsDraftAged,      href: "/admin/contracts?status=DRAFT" },
        { id: "pending-aged",    label: "Pending signature > 7 days",     count: contractsPendingAgedCount,  severity: sev(contractsPendingAgedCount, 1, 3),  records: contractsPendingAged,    href: "/admin/contracts?status=PENDING_SIGNATURE" },
        { id: "expiring-30",     label: "Expiring in 30 days",            count: contractsExpiringSoonCount, severity: sev(contractsExpiringSoonCount, 1, 3), records: contractsExpiringSoon,   href: "/admin/contracts?status=ACTIVE" },
        { id: "missing-start",   label: "Signed without start date",      count: contractsMissingStartCount, severity: sev(contractsMissingStartCount, 1, 3), records: contractsMissingStart,   href: "/admin/contracts?status=SIGNED" },
      ],
      clients: [
        { id: "no-manager",      label: "No account manager",             count: clientsNoManagerCount,      severity: sev(clientsNoManagerCount, 1, 3),      records: clientsNoManager,        href: "/admin/clients?ownerId=" },
        { id: "stale-30",        label: "No activity in 30 days",         count: clientsStaleCount,          severity: sev(clientsStaleCount, 1, 3),          records: clientsStale,            href: "/admin/clients" },
        { id: "no-active-proj",  label: "No active project",              count: clientsNoActiveProjectCount,severity: sev(clientsNoActiveProjectCount, 1, 3),records: clientsNoActiveProject,  href: "/admin/clients?status=ACTIVE" },
      ],
      projects: [
        { id: "overdue",         label: "Overdue projects",               count: projectsOverdueCount,       severity: sev(projectsOverdueCount, 1, 3),       records: projectsOverdue,         href: "/admin/pipeline" },
        { id: "no-owner",        label: "Missing owner",                  count: projectsNoOwnerCount,       severity: sev(projectsNoOwnerCount, 1, 3),       records: projectsNoOwner,         href: "/admin/pipeline" },
        { id: "inactive-14",     label: "No update in 14 days",           count: projectsInactiveCount,      severity: sev(projectsInactiveCount, 1, 3),      records: projectsInactive,        href: "/admin/pipeline" },
        { id: "no-tasks",        label: "No tasks tracked",               count: projectsNoTasksCount,       severity: sev(projectsNoTasksCount, 2, 5),       records: projectsNoTasksRaw,      href: "/admin/pipeline" },
      ],
      tasks: [
        { id: "overdue",         label: "Overdue tasks",                  count: tasksOverdueCount,          severity: sev(tasksOverdueCount, 1, 5),          records: tasksOverdueSample,      href: "/admin/tasks?scope=overdue" },
        { id: "unassigned",      label: "Unassigned tasks",               count: tasksUnassignedCount,       severity: sev(tasksUnassignedCount, 1, 5),       records: [],                      href: "/admin/tasks" },
        { id: "blocked",         label: "Blocked tasks",                  count: tasksBlockedCount,          severity: sev(tasksBlockedCount, 1, 5),          records: [],                      href: "/admin/tasks?status=BLOCKED" },
      ],
      crm: [
        { id: "unassigned-pros", label: "Unassigned prospects",           count: unassignedProspects,        severity: sev(unassignedProspects, 5, 30),       records: [],                      href: "/admin/prospecting?ownerId=" },
        { id: "stale-prospects", label: "Stale prospects (no update 30d)",count: staleProspectsCount,        severity: sev(staleProspectsCount, 5, 20),       records: [],                      href: "/admin/prospecting" },
        { id: "dup-phones",      label: "Duplicate phone numbers",        count: duplicatePhoneCount,        severity: sev(duplicatePhoneCount, 1, 5),        records: [],                      href: "/admin/prospecting" },
        { id: "dup-instagrams",  label: "Duplicate Instagram handles",    count: duplicateInstagramCount,    severity: sev(duplicateInstagramCount, 1, 5),    records: [],                      href: "/admin/prospecting" },
        { id: "missing-phone",   label: "Missing phone",                  count: missingPhone,               severity: sev(missingPhone, 10, 30),             records: [],                      href: "/admin/prospecting" },
        { id: "missing-ig",      label: "Missing Instagram",              count: missingInstagram,           severity: sev(missingInstagram, 10, 30),         records: [],                      href: "/admin/prospecting" },
      ],
    };

    // Health score: -10 per danger, -4 per warn across every check.
    let healthScore = 100;
    for (const group of Object.values(checks)) {
      for (const c of group) {
        if (c.severity === "danger") healthScore -= 10;
        else if (c.severity === "warn") healthScore -= 4;
      }
    }
    healthScore = Math.max(0, Math.min(100, healthScore));

    return NextResponse.json({
      dbStatus: "ok",
      apiStatus: "ok",
      timestamp: now.toISOString(),
      healthScore,
      team: { total: users.length, active: users.filter((u) => u.isActive).length, members: team },
      // Legacy block kept for the existing UI; new clients use `checks`.
      crm: { total: totalProspects, assigned: assignedProspects, unassigned: unassignedProspects, duplicates: duplicatePhoneCount + duplicateInstagramCount, missingPhone, missingInstagram },
      followUps: { overdue: overdueFollowUps, dueToday: followUpsDueToday, dueThisWeek: followUpsDueThisWeek },
      proposals: { draft: proposalDraft, sent: proposalSent, accepted: proposalAccepted, rejected: proposalRejected },
      projects: { active: activeProjects, overdue: projectsOverdueCount, completed: completedProjects },
      system: { unreadNotifications, activitiesToday: recentActivities },
      checks,
    });
  } catch (e) {
    return NextResponse.json({
      dbStatus: "error",
      apiStatus: "ok",
      error: e instanceof Error ? e.message : "Unknown error",
    }, { status: 500 });
  }
}
