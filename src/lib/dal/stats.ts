import { countByStage, latestSendAt, SEND_ACTION_TYPES, VERIFIED_CHANNEL_WHERE, UNVERIFIED_CHANNEL_WHERE, CONTACTED_WHERE, RECORDED_SEND_WHERE, LEGACY_SEND_WHERE, NO_RECORDED_SEND_WHERE } from "../prospect-stages";
import { buildProspectingReport, buildProposalReport, type ReportProspect } from "../prospecting-report";
import { LEAD_TEST_STATUS } from "../lead-status";
import { LEAD_QUEUE_CLOCK_SQL, LEAD_QUEUE_ENQUIRIES_SQL, LEAD_QUEUE_PROSPECTS_SQL } from "../lead-queue-sql";
import { buildLeadQueue, type EnquiryRow, type LeadQueue, type ProspectRow } from "../next-action";
import { db } from "./db";

// ─── Team Stats ─────────────────────────────────────────────────

export async function getTeamStats() {
  const users = await db().user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, avatarInitials: true, role: true },
  });

  const stats = await Promise.all(
    users.map(async (user) => {
      const [assigned, sent, contacted, replied, converted] = await Promise.all([
        db().prospect.count({ where: { ownerUserId: user.id } }),
        db().prospect.count({ where: { sentByUserId: user.id } }),
        db().prospect.count({ where: { contactedByUserId: user.id } }),
        db().prospect.count({ where: { contactedByUserId: user.id, status: "REPONDU" } }),
        db().prospect.count({ where: { contactedByUserId: user.id, status: "CONVERTI" } }),
      ]);

      const lastActivity = await db().prospectActivity.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, actionType: true },
      });

      return {
        user,
        assigned,
        sent,
        contacted,
        replied,
        converted,
        replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
        conversionRate: contacted > 0 ? Math.round((converted / contacted) * 100) : 0,
        lastActivity: lastActivity?.createdAt ?? null,
        lastActionType: lastActivity?.actionType ?? null,
      };
    })
  );

  return stats;
}

// ─── Notifications ─────────────────────────────────────────────

export async function createNotification(data: { userId: string; type: string; title: string; body?: string; link?: string }) {
  return db().notification.create({ data });
}

export async function notifyTeam(excludeUserId: string, data: { type: string; title: string; body?: string; link?: string }) {
  const users = await db().user.findMany({ where: { isActive: true, id: { not: excludeUserId } }, select: { id: true } });
  if (users.length === 0) return;
  await db().notification.createMany({
    data: users.map((u) => ({ userId: u.id, ...data })),
  });
}

// ─── Stats ───────────────────────────────────────────────────────

export async function getAdminStats() {
  const [totalProjects, visibleProjects, totalLeads, newLeads, totalProspects, pendingProspects] =
    await Promise.all([
      db().project.count(),
      db().project.count({ where: { visible: true } }),
      db().lead.count(),
      db().lead.count({ where: { status: "NEW" } }),
      db().prospect.count(),
      db().prospect.count({ where: { status: "A_ENVOYER" } }),
    ]);

  return { totalProjects, visibleProjects, totalLeads, newLeads, totalProspects, pendingProspects };
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const weekFromNow = new Date(todayStart.getTime() + 7 * 86400000);

  const [
    leadsByStatus,
    prospectsByStatus,
    prospectsBySector,
    followUpCandidates,
    totalProjects,
    recentLeads,
    followUpsDueToday,
    followUpsOverdue,
    followUpsUpcoming,
  ] = await Promise.all([
    db().lead.groupBy({ by: ["status"], _count: true }),
    db().prospect.groupBy({ by: ["status"], _count: true }),
    db().prospect.groupBy({ by: ["sector"], _count: { sector: true }, orderBy: { _count: { sector: "desc" } }, take: 10 }),
    db().prospect.count({ where: { status: "ENVOYE", sentAt: { lt: new Date(Date.now() - 3 * 86400000) } } }),
    db().project.count({ where: { visible: true } }),
    db().lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, fullName: true, status: true, createdAt: true, subject: true } }),
    db().prospect.count({ where: { followUpDate: { gte: todayStart, lt: tomorrowStart } } }),
    db().prospect.count({ where: { followUpDate: { lt: todayStart }, status: { notIn: ["REPONDU", "CONVERTI"] } } }),
    db().prospect.count({ where: { followUpDate: { gte: tomorrowStart, lt: weekFromNow } } }),
  ]);

  return { leadsByStatus, prospectsByStatus, prospectsBySector, followUpCandidates, totalProjects, recentLeads, followUpsDueToday, followUpsOverdue, followUpsUpcoming };
}

/**
 * Today dashboard — what needs doing now. Read-only.
 * Follow-up windows use the same rules as the prospect list's ?due= filter, so
 * every number here matches the list its link opens. Website enquiries count
 * status NEW only. Nothing guesses which enquiries are tests: an enquiry drops
 * out only when a person marks it "Internal test" (status TEST) by hand.
 */
export async function getTodaySummary(now: Date = new Date()) {
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const activeStatus = { notIn: ["CONVERTI", "CLIENT", "LOST"] };
  const prospectRow = { id: true, name: true, sector: true, followUpDate: true, lastActionAt: true, whatsappStatus: true, instagramStatus: true } as const;

  const [
    newEnquiries, latestEnquiries, testEnquiries,
    replied, repliedList,
    dueToday, overdue, dueTodayRecorded, overdueRecorded, dueLegacy, followUpList,
    readyVerified, readyUnverified,
    meetingsToday,
    byStatus,
    contacted, contactedRecorded, contactedLegacy, contactedNotRecorded, contactedChannelVerified,
  ] = await Promise.all([
    db().lead.count({ where: { status: "NEW" } }),
    db().lead.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, fullName: true, subject: true, createdAt: true } }),
    db().lead.count({ where: { status: LEAD_TEST_STATUS } }),
    db().prospect.count({ where: { status: "REPONDU" } }),
    db().prospect.findMany({ where: { status: "REPONDU" }, orderBy: { lastActionAt: { sort: "desc", nulls: "last" } }, take: 5, select: prospectRow }),
    db().prospect.count({ where: { followUpDate: { gte: startOfToday, lte: endOfToday }, status: activeStatus } }),
    db().prospect.count({ where: { followUpDate: { lt: startOfToday }, status: activeStatus } }),
    // Same windows, limited to a send recorded since the July 2026 cleanup — the only follow-ups backed by evidence.
    db().prospect.count({ where: { followUpDate: { gte: startOfToday, lte: endOfToday }, status: activeStatus, ...RECORDED_SEND_WHERE } }),
    db().prospect.count({ where: { followUpDate: { lt: startOfToday }, status: activeStatus, ...RECORDED_SEND_WHERE } }),
    db().prospect.count({ where: { followUpDate: { lte: endOfToday }, status: activeStatus, ...LEGACY_SEND_WHERE } }),
    db().prospect.findMany({ where: { followUpDate: { lte: endOfToday }, status: activeStatus, ...RECORDED_SEND_WHERE }, orderBy: { followUpDate: "asc" }, take: 5, select: prospectRow }),
    db().prospect.count({ where: { status: "A_ENVOYER", ...VERIFIED_CHANNEL_WHERE } }),
    db().prospect.count({ where: { status: "A_ENVOYER", ...UNVERIFIED_CHANNEL_WHERE } }),
    db().meeting.findMany({
      where: { status: "SCHEDULED", startAt: { gte: startOfToday, lte: endOfToday } },
      orderBy: { startAt: "asc" }, take: 10,
      select: { id: true, title: true, type: true, startAt: true, client: { select: { id: true, companyName: true } }, prospect: { select: { id: true, name: true } } },
    }),
    db().prospect.groupBy({ by: ["status"], _count: true }),
    db().prospect.count({ where: CONTACTED_WHERE }),
    db().prospect.count({ where: { AND: [CONTACTED_WHERE, RECORDED_SEND_WHERE] } }),
    db().prospect.count({ where: { AND: [CONTACTED_WHERE, LEGACY_SEND_WHERE] } }),
    db().prospect.count({ where: { AND: [CONTACTED_WHERE, NO_RECORDED_SEND_WHERE] } }),
    db().prospect.count({ where: { AND: [CONTACTED_WHERE, VERIFIED_CHANNEL_WHERE] } }),
  ]);

  return {
    enquiries: { new: newEnquiries, latest: latestEnquiries, markedTest: testEnquiries },
    replies: { count: replied, list: repliedList },
    followUps: {
      dueToday, overdue, list: followUpList,
      recorded: { dueToday: dueTodayRecorded, overdue: overdueRecorded },
      // Not backed: only pre-cleanup send records (legacy) or none at all.
      unbacked: { dueToday: dueToday - dueTodayRecorded, overdue: overdue - overdueRecorded, legacy: dueLegacy },
    },
    readyToContact: { verified: readyVerified, unverified: readyUnverified },
    meetingsToday,
    stages: countByStage(byStatus.map((r) => ({ status: r.status, count: r._count }))),
    // Send records and channel state are separate facts; never add one to the other.
    outreach: {
      contacted, sendRecorded: contactedRecorded, legacySendOnly: contactedLegacy,
      noSendRecord: contactedNotRecorded, channelVerified: contactedChannelVerified,
    },
  };
}

export type TodaySummary = Awaited<ReturnType<typeof getTodaySummary>>;

/** The Leads Command Center queue. Read-only. The SQL holds no parameters and the rules are in next-action.ts. */
export async function getLeadQueue(): Promise<LeadQueue> {
  const [clock, prospects, enquiries] = await Promise.all([
    db().$queryRawUnsafe<{ today: string }[]>(LEAD_QUEUE_CLOCK_SQL),
    db().$queryRawUnsafe<ProspectRow[]>(LEAD_QUEUE_PROSPECTS_SQL),
    db().$queryRawUnsafe<EnquiryRow[]>(LEAD_QUEUE_ENQUIRIES_SQL),
  ]);
  return buildLeadQueue(prospects, enquiries, clock[0].today);
}

/**
 * Prospecting report data. Read-only. Fetches plain rows and leaves every
 * calculation to prospecting-report.ts, which reuses Today's definitions.
 */
export async function getAnalyticsData() {
  const [prospects, proposals] = await Promise.all([
    db().prospect.findMany({
      select: {
        sector: true, status: true, sentAt: true,
        outreachMessages: { select: { sentAt: true }, orderBy: { sentAt: "desc" }, take: 1 },
        activities: {
          where: { actionType: { in: [...SEND_ACTION_TYPES] } },
          select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1,
        },
      },
    }),
    db().proposal.findMany({ select: { status: true, amount: true, currency: true } }),
  ]);

  const rows: ReportProspect[] = prospects.map((p) => ({
    sector: p.sector,
    status: p.status,
    sentAt: p.sentAt,
    lastSendAt: latestSendAt([p.outreachMessages[0]?.sentAt, p.activities[0]?.createdAt]),
  }));

  return {
    report: buildProspectingReport(rows),
    proposals: buildProposalReport(proposals),
  };
}

export async function getClients() {
  const [convertedProspects, qualifiedLeads] = await Promise.all([
    db().prospect.findMany({
      where: { status: "CONVERTI" },
      orderBy: { updatedAt: "desc" },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db().lead.findMany({
      where: { status: { in: ["QUALIFIED", "CLOSED"] } },
      orderBy: { updatedAt: "desc" },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  return { convertedProspects, qualifiedLeads };
}

// ─── Workload / Capacity ────────────────────────────────────────

export async function getWorkloadData() {
  const users = await db().user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, avatarInitials: true, role: true },
  });

  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const members = await Promise.all(
    users.map(async (user) => {
      const [
        todoTasks,
        inProgressTasks,
        reviewTasks,
        blockedTasks,
        doneTasks,
        openProspects,
        meetingsThisWeek,
      ] = await Promise.all([
        db().task.count({ where: { ownerId: user.id, status: "TODO" } }),
        db().task.count({ where: { ownerId: user.id, status: "IN_PROGRESS" } }),
        db().task.count({ where: { ownerId: user.id, status: "REVIEW" } }),
        db().task.count({ where: { ownerId: user.id, status: "BLOCKED" } }),
        db().task.count({ where: { ownerId: user.id, status: "DONE" } }),
        db().prospect.count({
          where: { ownerUserId: user.id, status: { notIn: ["CONVERTI", "LOST"] } },
        }),
        db().meeting.count({
          where: {
            ownerId: user.id,
            status: { in: ["SCHEDULED", "COMPLETED"] },
            startAt: { gte: weekStart, lt: weekEnd },
          },
        }),
      ]);

      const activeTasks = todoTasks + inProgressTasks + reviewTasks + blockedTasks;
      const totalActiveItems = activeTasks + openProspects + meetingsThisWeek;

      return {
        user,
        tasks: {
          todo: todoTasks,
          inProgress: inProgressTasks,
          review: reviewTasks,
          blocked: blockedTasks,
          done: doneTasks,
          active: activeTasks,
        },
        openProspects,
        meetingsThisWeek,
        totalActiveItems,
      };
    })
  );

  return members;
}
