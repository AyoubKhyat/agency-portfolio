import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Revenue Command Center — money-focused view.
 * One endpoint returning every section so the page loads in one round trip.
 */

// Probability per pipeline stage (used for forecast + opportunity ranking)
const STAGE_PROBABILITY: Record<string, number> = {
  A_ENVOYER: 0.05,
  ENVOYE: 0.10,
  PAS_DE_WHATSAPP: 0,
  REPONDU: 0.25,
  MEETING: 0.40,
  PROPOSAL_SENT: 0.60,
  NEGOTIATION: 0.75,
  CONTRACT_SENT: 0.85,
  CLIENT: 1.0,
  CONVERTI: 1.0,
  LOST: 0,
  PERDU: 0,
  REFUSE: 0,
};

// Estimated days-to-close per stage (used for forecast windowing)
const STAGE_DAYS_TO_CLOSE: Record<string, number> = {
  A_ENVOYER: 60,
  ENVOYE: 45,
  REPONDU: 30,
  MEETING: 21,
  PROPOSAL_SENT: 14,
  NEGOTIATION: 7,
  CONTRACT_SENT: 3,
};

const TERMINAL_STATUSES = new Set(["LOST", "PERDU", "REFUSE", "CLIENT", "CONVERTI", "PAS_DE_WHATSAPP"]);
const WON_STATUSES = new Set(["CLIENT", "CONVERTI"]);

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfWeek(d: Date) { const dt = startOfDay(d); dt.setDate(dt.getDate() - dt.getDay()); return dt; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfQuarter(d: Date) { const q = Math.floor(d.getMonth() / 3) * 3; return new Date(d.getFullYear(), q, 1); }

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const now = new Date();
  const winStart = {
    today: startOfDay(now),
    week: startOfWeek(now),
    month: startOfMonth(now),
    quarter: startOfQuarter(now),
  };

  // Pull all proposals, contracts, clients, meetings, prospects in parallel.
  // For scale, the data here is small (hundreds of rows) so this is fine.
  const [proposals, contracts, clients, prospects, meetings, outreachMessages, users] = await Promise.all([
    prisma.proposal.findMany({
      select: { id: true, amount: true, currency: true, status: true, prospectId: true, createdAt: true, sentAt: true, createdById: true, createdByName: true },
    }),
    prisma.contract.findMany({
      select: { id: true, amount: true, currency: true, status: true, prospectId: true, clientId: true, createdAt: true, signedDate: true, signedAt: true, createdById: true },
    }),
    prisma.client.findMany({
      select: { id: true, companyName: true, contractValue: true, status: true, prospectId: true, accountManagerId: true, createdAt: true },
    }),
    prisma.prospect.findMany({
      where: { status: { notIn: ["LOST", "REFUSE", "PERDU"] } },
      select: {
        id: true, name: true, sector: true, neighborhood: true,
        status: true, score: true, qualityLabel: true,
        proposalAmount: true, proposalDate: true, proposalStatus: true,
        lastActionAt: true, createdAt: true, sentAt: true,
        owner: { select: { id: true, fullName: true, avatarInitials: true } },
      },
    }),
    prisma.meeting.findMany({
      select: { id: true, status: true, prospectId: true, ownerId: true, startAt: true, createdAt: true },
    }),
    prisma.outreachMessage.findMany({
      where: { sentAt: { gte: winStart.month } },
      select: { sentAt: true, replied: true, repliedAt: true, sentById: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, avatarInitials: true },
    }),
  ]);

  /* ---------- 1) Revenue pipeline ---------- */
  function metricsFor(start: Date) {
    // Proposals created in window
    const proposalsInWin = proposals.filter((p) => p.createdAt >= start);
    const proposalValue = proposalsInWin.reduce((s, p) => s + (p.amount || 0), 0);

    // Contracts created in window
    const contractsInWin = contracts.filter((c) => c.createdAt >= start);
    const contractValue = contractsInWin.reduce((s, c) => s + (c.amount || 0), 0);

    // Won in window — contracts signed or clients created
    const wonFromContracts = contracts
      .filter((c) => (c.status === "SIGNED" || c.status === "ACTIVE" || c.status === "COMPLETED") && (c.signedDate || c.signedAt) && new Date(c.signedDate || c.signedAt!) >= start)
      .reduce((s, c) => s + (c.amount || 0), 0);
    const wonFromClients = clients
      .filter((c) => c.createdAt >= start)
      .reduce((s, c) => s + (c.contractValue || 0), 0);
    const wonRevenue = Math.max(wonFromContracts, wonFromClients);

    // Lost — proposals rejected or contracts cancelled (best-effort by createdAt window)
    const lostRevenue = proposals
      .filter((p) => p.status === "REJECTED" && p.createdAt >= start)
      .reduce((s, p) => s + (p.amount || 0), 0)
      + contracts.filter((c) => c.status === "CANCELLED" && c.createdAt >= start).reduce((s, c) => s + (c.amount || 0), 0);

    // Potential — open opportunities (any prospect with proposalAmount > 0, not terminal)
    const potential = prospects
      .filter((p) => !TERMINAL_STATUSES.has(p.status) && (p.proposalAmount || 0) > 0)
      .reduce((s, p) => s + (p.proposalAmount || 0), 0);

    return { potential, proposalValue, contractValue, wonRevenue, lostRevenue };
  }

  const pipeline = {
    today: metricsFor(winStart.today),
    week: metricsFor(winStart.week),
    month: metricsFor(winStart.month),
    quarter: metricsFor(winStart.quarter),
  };

  /* ---------- 2 + 5) Opportunity ranking + CEO top 10 ---------- */
  // Build an "opportunities" set: prospects that have any deal-shape signal
  const opportunities = prospects
    .filter((p) => {
      if (TERMINAL_STATUSES.has(p.status)) return false;
      const propAmt = p.proposalAmount || 0;
      const hasProposalRec = proposals.some((pr) => pr.prospectId === p.id);
      const hasContractRec = contracts.some((c) => c.prospectId === p.id);
      const isActiveStage = ["REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "CONTRACT_SENT"].includes(p.status);
      return propAmt > 0 || hasProposalRec || hasContractRec || isActiveStage;
    })
    .map((p) => {
      const proposalRec = proposals.find((pr) => pr.prospectId === p.id);
      const contractRec = contracts.find((c) => c.prospectId === p.id);
      const proposalValue = contractRec?.amount || proposalRec?.amount || p.proposalAmount || 0;
      const stage = contractRec ? "CONTRACT_SENT" : (proposalRec ? "PROPOSAL_SENT" : p.status);
      const probability = STAGE_PROBABILITY[stage] ?? STAGE_PROBABILITY[p.status] ?? 0.1;
      const expectedRevenue = Math.round(proposalValue * probability);
      const expectedClose = new Date((p.lastActionAt || p.createdAt).getTime() + (STAGE_DAYS_TO_CLOSE[stage] || 30) * 86_400_000);
      return {
        id: p.id, name: p.name, sector: p.sector, city: p.neighborhood || "Marrakech",
        score: p.score, qualityLabel: p.qualityLabel,
        stage, proposalValue, probability, expectedRevenue,
        owner: p.owner,
        expectedClose: expectedClose.toISOString(),
        lastActionAt: p.lastActionAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => b.expectedRevenue - a.expectedRevenue);

  const top50 = opportunities.slice(0, 50);
  const ceoTop10 = opportunities.slice(0, 10);

  /* ---------- 3) Forecast ---------- */
  function forecastFor(days: number) {
    const cutoff = new Date(now.getTime() + days * 86_400_000);
    const inWindow = opportunities.filter((o) => new Date(o.expectedClose) <= cutoff && o.probability > 0);
    const expected = inWindow.reduce((s, o) => s + o.proposalValue * o.probability, 0);
    const best = inWindow.reduce((s, o) => s + o.proposalValue, 0);
    const worst = expected * 0.5;
    return { best: Math.round(best), expected: Math.round(expected), worst: Math.round(worst), count: inWindow.length };
  }

  const forecast = {
    in7: forecastFor(7),
    in30: forecastFor(30),
    in90: forecastFor(90),
  };

  /* ---------- 4) Stalled deals ---------- */
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

  type StalledItem = { id: string; prospectId: string | null; name: string; amount: number; daysStalled: number; lastEvent: string };

  // Meeting done > 7d ago, but no Proposal record for that prospect
  const proposalsByProspect = new Set(proposals.map((p) => p.prospectId).filter(Boolean));
  const meetingDoneNoProposal: StalledItem[] = meetings
    .filter((m) => m.status === "COMPLETED" && m.startAt && m.startAt < sevenDaysAgo)
    .filter((m) => m.prospectId && !proposalsByProspect.has(m.prospectId))
    .map((m) => {
      const p = prospects.find((pp) => pp.id === m.prospectId);
      return {
        id: m.id, prospectId: m.prospectId,
        name: p?.name || "Unknown",
        amount: p?.proposalAmount || 0,
        daysStalled: Math.floor((now.getTime() - m.startAt!.getTime()) / 86_400_000),
        lastEvent: `meeting ${m.startAt!.toISOString().slice(0, 10)}`,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Proposal SENT > 7d ago, but no Contract for the prospect
  const contractsByProspect = new Set(contracts.map((c) => c.prospectId).filter(Boolean));
  const proposalSentNoReply: StalledItem[] = proposals
    .filter((p) => p.status === "SENT" && (p.sentAt || p.createdAt) < sevenDaysAgo)
    .filter((p) => p.prospectId && !contractsByProspect.has(p.prospectId))
    .map((p) => {
      const prospect = prospects.find((pp) => pp.id === p.prospectId);
      const when = p.sentAt || p.createdAt;
      return {
        id: p.id, prospectId: p.prospectId,
        name: prospect?.name || "Unknown",
        amount: p.amount || 0,
        daysStalled: Math.floor((now.getTime() - when.getTime()) / 86_400_000),
        lastEvent: `proposal sent ${when.toISOString().slice(0, 10)}`,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Contract PENDING_SIGNATURE or DRAFT > 14d ago, unsigned
  const contractSentUnsigned: StalledItem[] = contracts
    .filter((c) => (c.status === "PENDING_SIGNATURE" || c.status === "DRAFT") && c.createdAt < fourteenDaysAgo)
    .map((c) => {
      const prospect = prospects.find((pp) => pp.id === c.prospectId);
      return {
        id: c.id, prospectId: c.prospectId,
        name: prospect?.name || "Unknown",
        amount: c.amount || 0,
        daysStalled: Math.floor((now.getTime() - c.createdAt.getTime()) / 86_400_000),
        lastEvent: `contract sent ${c.createdAt.toISOString().slice(0, 10)}`,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  /* ---------- 6) Team performance (this month) ---------- */
  const team = users.map((u) => {
    const messages = outreachMessages.filter((m) => m.sentById === u.id).length;
    const replies = outreachMessages.filter((m) => m.sentById === u.id && m.replied).length;
    const userMeetings = meetings.filter((m) => m.ownerId === u.id && m.createdAt >= winStart.month).length;
    const userProposals = proposals.filter((p) => p.createdById === u.id && p.createdAt >= winStart.month).length;
    const userContracts = contracts.filter((c) => c.createdById === u.id && c.createdAt >= winStart.month).length;
    const revenueWon = clients
      .filter((c) => c.accountManagerId === u.id && c.createdAt >= winStart.month)
      .reduce((s, c) => s + (c.contractValue || 0), 0);
    return {
      userId: u.id, name: u.fullName, avatarInitials: u.avatarInitials,
      messages, replies,
      replyRate: messages > 0 ? Math.round((replies / messages) * 1000) / 10 : 0,
      meetings: userMeetings, proposals: userProposals, contracts: userContracts,
      revenueWon: Math.round(revenueWon),
    };
  }).sort((a, b) => b.revenueWon - a.revenueWon);

  /* ---------- 7) Alerts ---------- */
  const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000);

  const proposalsStale = proposals.filter((p) => p.status === "SENT" && (p.sentAt || p.createdAt) < sevenDaysAgo).length;
  const contractsStale = contracts.filter((c) => (c.status === "PENDING_SIGNATURE" || c.status === "DRAFT") && c.createdAt < fourteenDaysAgo).length;
  const meetingsWithoutFollowup = meetingDoneNoProposal.length;
  const highValueInactive = prospects
    .filter((p) => !TERMINAL_STATUSES.has(p.status))
    .filter((p) => (p.proposalAmount || 0) >= 30000)
    .filter((p) => !p.lastActionAt || p.lastActionAt < tenDaysAgo)
    .length;

  const alertCount = proposalsStale + contractsStale + meetingsWithoutFollowup + highValueInactive;
  let overallHealth: "green" | "orange" | "red" = "green";
  if (alertCount >= 5) overallHealth = "red";
  else if (alertCount >= 1) overallHealth = "orange";

  return NextResponse.json({
    pipeline,
    opportunities: top50,
    ceoTop10,
    forecast,
    stalled: { meetingDoneNoProposal, proposalSentNoReply, contractSentUnsigned },
    team,
    alerts: { proposalsStale, contractsStale, meetingsWithoutFollowup, highValueInactive, overallHealth },
    meta: {
      totalProspects: prospects.length,
      activeOpportunities: opportunities.length,
      currency: "MAD",
    },
  });
}
