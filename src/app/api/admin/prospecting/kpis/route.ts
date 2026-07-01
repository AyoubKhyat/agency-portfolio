import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

// Reads cookie → dynamic. Never cache; segment/proposal state changes are the whole point.
export const dynamic = "force-dynamic";

/**
 * Relationship KPIs — replaces the old "343 prospects / 295 sent" mindset.
 * All figures derived from existing tables (Prospect, Meeting, Proposal, Client).
 * No new schema.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const empty = {
    warmRelationships: 0,
    agencyOpportunities: 0,
    luxuryBrands: 0,
    legacyCold: 0,
    meetingsScheduled: 0,
    proposalValue: 0,
    pipelineValue: 0,
    clientsWon: 0,
    upcomingFollowups: 0,
    currency: "MAD",
  };
  if (!hasPrisma()) return NextResponse.json(empty);

  try {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 86_400_000);

    const [segmentCounts, meetingsScheduled, proposalAgg, clientsWon, upcomingFollowups] = await Promise.all([
      prisma.prospect.groupBy({
        by: ["segment"],
        _count: { _all: true },
      }),
      prisma.meeting.count({
        where: { status: "SCHEDULED", startAt: { gte: now } },
      }),
      prisma.proposal.aggregate({
        where: { status: { in: ["DRAFT", "SENT"] } },
        _sum: { amount: true },
      }),
      prisma.client.count(),
      prisma.prospect.count({
        where: {
          followUpDate: { gte: now, lte: in14Days },
          status: { notIn: ["CONVERTI", "CLIENT", "LOST"] },
        },
      }),
    ]);

    const bySegment = new Map<string, number>(segmentCounts.map((r) => [r.segment, r._count._all]));

    // Pipeline value = proposals still in play (DRAFT, SENT, ACCEPTED not yet converted to contract-only)
    const pipelineAgg = await prisma.proposal.aggregate({
      where: { status: { in: ["DRAFT", "SENT", "ACCEPTED"] } },
      _sum: { amount: true },
    });

    return NextResponse.json({
      warmRelationships: bySegment.get("WARM_NETWORK") ?? 0,
      agencyOpportunities: bySegment.get("AGENCY_EU") ?? 0,
      luxuryBrands: bySegment.get("LUXURY_BRAND") ?? 0,
      legacyCold: bySegment.get("LEGACY_COLD") ?? 0,
      meetingsScheduled,
      proposalValue: proposalAgg._sum.amount ?? 0,
      pipelineValue: pipelineAgg._sum.amount ?? 0,
      clientsWon,
      upcomingFollowups,
      currency: "MAD",
    });
  } catch (err) {
    console.error("[GET /api/admin/prospecting/kpis] failed:", err);
    return NextResponse.json(empty);
  }
}
