import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

type PerUserStats = {
  userId: string;
  name: string;
  messagesSent: number;
  repliesReceived: number;
  replyRate: number;
  meetingsBooked: number;
  proposalsSent: number;
  clientsWon: number;
};

type CoachingHighlight = { label: string; value: string; meta: string } | null;

const SINCE_DAYS = 90;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) {
    return NextResponse.json({ perUser: [], totals: null, coaching: { bestMessage: null, bestSector: null, bestSalesperson: null } });
  }

  const since = new Date(Date.now() - SINCE_DAYS * 86_400_000);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  /* ---------- Per-user aggregates ---------- */
  const perUser: PerUserStats[] = await Promise.all(
    users.map(async (u) => {
      const [messagesSent, repliesReceived, meetingsBooked, proposalsSent, clientsWon] = await Promise.all([
        prisma.outreachMessage.count({ where: { sentById: u.id, sentAt: { gte: since } } }),
        prisma.outreachMessage.count({ where: { sentById: u.id, replied: true, sentAt: { gte: since } } }),
        prisma.meeting.count({ where: { ownerId: u.id, createdAt: { gte: since } } }).catch(() => 0),
        prisma.proposal.count({ where: { createdById: u.id, createdAt: { gte: since } } }).catch(() => 0),
        prisma.client.count({ where: { accountManagerId: u.id, createdAt: { gte: since } } }).catch(() => 0),
      ]);

      return {
        userId: u.id,
        name: u.fullName,
        messagesSent,
        repliesReceived,
        replyRate: messagesSent > 0 ? Math.round((repliesReceived / messagesSent) * 1000) / 10 : 0,
        meetingsBooked,
        proposalsSent,
        clientsWon,
      };
    })
  );

  /* ---------- Totals ---------- */
  const totals = perUser.reduce(
    (acc, u) => ({
      messagesSent: acc.messagesSent + u.messagesSent,
      repliesReceived: acc.repliesReceived + u.repliesReceived,
      meetingsBooked: acc.meetingsBooked + u.meetingsBooked,
      proposalsSent: acc.proposalsSent + u.proposalsSent,
      clientsWon: acc.clientsWon + u.clientsWon,
    }),
    { messagesSent: 0, repliesReceived: 0, meetingsBooked: 0, proposalsSent: 0, clientsWon: 0 }
  );
  const replyRate = totals.messagesSent > 0 ? Math.round((totals.repliesReceived / totals.messagesSent) * 1000) / 10 : 0;

  /* ---------- Coaching: best message ---------- */
  const templates = await prisma.outreachTemplate.findMany({
    include: {
      _count: {
        select: {
          messages: { where: { sentAt: { gte: since } } },
        },
      },
    },
  });
  // For each template, compute reply rate manually
  const templateStats = await Promise.all(
    templates.map(async (t) => {
      const sent = t._count.messages;
      const replies = sent > 0
        ? await prisma.outreachMessage.count({ where: { templateId: t.id, replied: true, sentAt: { gte: since } } })
        : 0;
      const rate = sent > 0 ? replies / sent : 0;
      return { name: t.name, channel: t.channel, sent, replies, rate };
    })
  );
  const bestTemplate = templateStats
    .filter((t) => t.sent >= 3) // need some volume to be meaningful
    .sort((a, b) => b.rate - a.rate)[0];

  const bestMessage: CoachingHighlight = bestTemplate
    ? {
        label: bestTemplate.name,
        value: `${Math.round(bestTemplate.rate * 1000) / 10}% reply rate`,
        meta: `${bestTemplate.replies} / ${bestTemplate.sent} on ${bestTemplate.channel.toLowerCase()}`,
      }
    : null;

  /* ---------- Coaching: best sector ---------- */
  // Sectors with the highest conversion to client over last SINCE_DAYS
  const recentClients = await prisma.client.findMany({
    where: { createdAt: { gte: since }, prospectId: { not: null } },
    select: { prospectId: true },
  });
  const sectorWins: Record<string, number> = {};
  if (recentClients.length > 0) {
    const prospectIds = recentClients.map((c) => c.prospectId!).filter(Boolean);
    const prospects = await prisma.prospect.findMany({
      where: { id: { in: prospectIds } },
      select: { sector: true },
    });
    for (const p of prospects) {
      if (p.sector) sectorWins[p.sector] = (sectorWins[p.sector] || 0) + 1;
    }
  }
  const topSectorEntry = Object.entries(sectorWins).sort((a, b) => b[1] - a[1])[0];
  const bestSector: CoachingHighlight = topSectorEntry
    ? { label: topSectorEntry[0], value: `${topSectorEntry[1]} clients won`, meta: `last ${SINCE_DAYS} days` }
    : null;

  /* ---------- Coaching: best salesperson ---------- */
  const ranked = [...perUser]
    .filter((u) => u.messagesSent >= 5)
    .sort((a, b) => b.replyRate - a.replyRate || b.clientsWon - a.clientsWon);
  const topUser = ranked[0];
  const bestSalesperson: CoachingHighlight = topUser
    ? { label: topUser.name, value: `${topUser.replyRate}% reply rate`, meta: `${topUser.clientsWon} won · ${topUser.messagesSent} sent` }
    : null;

  /* ---------- Template performance (Feature 3) ---------- */
  const templatePerformance = await Promise.all(
    templates.map(async (t) => {
      const sent = await prisma.outreachMessage.count({ where: { templateId: t.id, sentAt: { gte: since } } });
      if (sent === 0) return null;
      const [replied, meetingBooked] = await Promise.all([
        prisma.outreachMessage.count({ where: { templateId: t.id, replied: true, sentAt: { gte: since } } }),
        prisma.outreachMessage.count({ where: { templateId: t.id, meetingBooked: true, sentAt: { gte: since } } }),
      ]);
      return {
        id: t.id,
        name: t.name,
        channel: t.channel,
        sent,
        replied,
        meetingBooked,
        replyRate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
        meetingRate: sent > 0 ? Math.round((meetingBooked / sent) * 1000) / 10 : 0,
      };
    })
  );
  const templateStatsFiltered = templatePerformance.filter((t): t is NonNullable<typeof t> => t !== null);

  /* ---------- Conversion funnel (Feature 5) ---------- */
  const [funnelSent, funnelReplied, funnelMeetings, funnelProposals, funnelContracts, funnelClients] = await Promise.all([
    prisma.outreachMessage.count({ where: { sentAt: { gte: since } } }),
    prisma.outreachMessage.count({ where: { replied: true, sentAt: { gte: since } } }),
    prisma.meeting.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.proposal.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.contract.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.client.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
  ]);
  const funnel = [
    { stage: "Messages sent", count: funnelSent, conversionFromPrev: null as number | null },
    { stage: "Replies", count: funnelReplied, conversionFromPrev: funnelSent > 0 ? Math.round((funnelReplied / funnelSent) * 1000) / 10 : 0 },
    { stage: "Meetings", count: funnelMeetings, conversionFromPrev: funnelReplied > 0 ? Math.round((funnelMeetings / funnelReplied) * 1000) / 10 : 0 },
    { stage: "Proposals", count: funnelProposals, conversionFromPrev: funnelMeetings > 0 ? Math.round((funnelProposals / funnelMeetings) * 1000) / 10 : 0 },
    { stage: "Contracts", count: funnelContracts, conversionFromPrev: funnelProposals > 0 ? Math.round((funnelContracts / funnelProposals) * 1000) / 10 : 0 },
    { stage: "Clients won", count: funnelClients, conversionFromPrev: funnelContracts > 0 ? Math.round((funnelClients / funnelContracts) * 1000) / 10 : 0 },
  ];

  /* ---------- Reply reasons distribution (Feature 4) ---------- */
  const replyReasonAgg = await prisma.outreachMessage.groupBy({
    by: ["replyReason"],
    _count: { id: true },
    where: { replied: true, replyReason: { not: null }, sentAt: { gte: since } },
  });
  const replyReasons = replyReasonAgg
    .map((r) => ({ reason: r.replyReason as string, count: r._count.id }))
    .sort((a, b) => b.count - a.count);
  const totalTaggedReplies = replyReasons.reduce((sum, r) => sum + r.count, 0);

  /* ---------- Per-variant performance (A/B/C/D) ---------- */
  const variantAgg = await prisma.outreachMessage.groupBy({
    by: ["variantLabel"],
    _count: { id: true },
    where: { variantLabel: { not: null }, sentAt: { gte: since } },
  });
  const variantPerformance = await Promise.all(
    variantAgg.map(async (v) => {
      const sent = v._count.id;
      const replied = await prisma.outreachMessage.count({
        where: { variantLabel: v.variantLabel, replied: true, sentAt: { gte: since } },
      });
      return {
        variant: v.variantLabel!,
        sent,
        replied,
        replyRate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
      };
    })
  );
  variantPerformance.sort((a, b) => b.replyRate - a.replyRate);

  /* ---------- Per-tone performance ---------- */
  const toneAgg = await prisma.outreachMessage.groupBy({
    by: ["tone"],
    _count: { id: true },
    where: { tone: { not: null }, sentAt: { gte: since } },
  });
  const tonePerformance = await Promise.all(
    toneAgg.map(async (t) => {
      const sent = t._count.id;
      const replied = await prisma.outreachMessage.count({
        where: { tone: t.tone, replied: true, sentAt: { gte: since } },
      });
      return {
        tone: t.tone!,
        sent,
        replied,
        replyRate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
      };
    })
  );
  tonePerformance.sort((a, b) => b.replyRate - a.replyRate);

  /* ---------- Winning template per sector ---------- */
  // For each (sector, template) pair, compute reply rate. Surface winners where sample >= 5.
  const sectorTemplatePairs = await prisma.outreachMessage.findMany({
    where: { templateId: { not: null }, sentAt: { gte: since } },
    select: {
      templateId: true,
      replied: true,
      prospect: { select: { sector: true } },
    },
  });
  const pairStats: Record<string, { sent: number; replied: number; templateId: string; sector: string }> = {};
  for (const m of sectorTemplatePairs) {
    if (!m.prospect?.sector || !m.templateId) continue;
    const key = `${m.prospect.sector}::${m.templateId}`;
    pairStats[key] = pairStats[key] || { sent: 0, replied: 0, templateId: m.templateId, sector: m.prospect.sector };
    pairStats[key].sent++;
    if (m.replied) pairStats[key].replied++;
  }
  const templateById = new Map(templates.map((t) => [t.id, t.name]));
  const sectorWinners: Record<string, { templateId: string; templateName: string; sent: number; replied: number; replyRate: number }> = {};
  for (const stat of Object.values(pairStats)) {
    if (stat.sent < 5) continue; // require meaningful sample
    const rate = stat.replied / stat.sent;
    const current = sectorWinners[stat.sector];
    if (!current || rate > current.replied / current.sent) {
      sectorWinners[stat.sector] = {
        templateId: stat.templateId,
        templateName: templateById.get(stat.templateId) || stat.templateId,
        sent: stat.sent,
        replied: stat.replied,
        replyRate: Math.round(rate * 1000) / 10,
      };
    }
  }

  /* ---------- "Winning insight" — pick the highest-impact discovery ---------- */
  let winningInsight: { label: string; value: string; meta: string } | null = null;
  const topVariant = variantPerformance.find((v) => v.sent >= 5);
  const topTone = tonePerformance.find((t) => t.sent >= 5);
  const topSectorWinner = Object.entries(sectorWinners).sort((a, b) => b[1].replyRate - a[1].replyRate)[0];
  if (topSectorWinner) {
    const [sector, w] = topSectorWinner;
    winningInsight = {
      label: `${w.templateName} performs best for ${sector}`,
      value: `${w.replyRate}% reply rate`,
      meta: `${w.replied} / ${w.sent} sends`,
    };
  } else if (topVariant) {
    const variantLabels: Record<string, string> = {
      A: "Variant A · WhatsApp short",
      B: "Variant B · WhatsApp long",
      C: "Variant C · Instagram short",
      D: "Variant D · Instagram long",
    };
    winningInsight = {
      label: variantLabels[topVariant.variant] || topVariant.variant,
      value: `${topVariant.replyRate}% reply rate`,
      meta: `${topVariant.replied} / ${topVariant.sent} AI sends`,
    };
  } else if (topTone) {
    winningInsight = {
      label: `${topTone.tone.replace(/_/g, " ")} tone wins`,
      value: `${topTone.replyRate}% reply rate`,
      meta: `${topTone.replied} / ${topTone.sent} sends`,
    };
  }

  /* ---------- Monthly snapshot (Feature 6) — current calendar month ---------- */
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [monthlyMessages, monthlyReplies, monthlyClients] = await Promise.all([
    prisma.outreachMessage.count({ where: { sentAt: { gte: monthStart } } }),
    prisma.outreachMessage.count({ where: { replied: true, sentAt: { gte: monthStart } } }),
    prisma.client.count({ where: { createdAt: { gte: monthStart } } }).catch(() => 0),
  ]);

  return NextResponse.json({
    sinceDays: SINCE_DAYS,
    totals: { ...totals, replyRate },
    perUser,
    coaching: { bestMessage, bestSector, bestSalesperson },
    templatePerformance: templateStatsFiltered.sort((a, b) => b.replyRate - a.replyRate),
    funnel,
    replyReasons,
    totalTaggedReplies,
    variantPerformance,
    tonePerformance,
    sectorWinners,
    winningInsight,
    monthly: {
      label: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      messagesSent: monthlyMessages,
      repliesReceived: monthlyReplies,
      clientsWon: monthlyClients,
      replyRate: monthlyMessages > 0 ? Math.round((monthlyReplies / monthlyMessages) * 1000) / 10 : 0,
    },
  });
}
