import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Dashboard card counts for the inbox.
 *  - unanswered: replies where no follow-up action (meeting/proposal/CONVERTI) has happened yet
 *  - today: outreach messages marked replied today
 *  - meetingsWaitingToBeBooked: replyReason=MEETING_REQUESTED AND no meeting yet
 *  - proposalsRequested: replyReason=PROPOSAL_REQUESTED AND no proposal yet
 *  - hotOpportunities: replyReason in MEETING/PROPOSAL/INTERESTED AND not yet converted/lost
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ unanswered: 0, today: 0, meetingsWaiting: 0, proposalsRequested: 0, hotOpportunities: 0 });

  const todayStart = new Date(new Date().toDateString());

  // All replied prospects (one row each)
  const replied = await prisma.prospect.findMany({
    where: {
      OR: [
        { status: "REPONDU" },
        { outreachMessages: { some: { replied: true } } },
      ],
    },
    select: {
      id: true, status: true,
      outreachMessages: {
        where: { replied: true },
        orderBy: { repliedAt: "desc" },
        take: 1,
        select: { repliedAt: true, replyReason: true },
      },
      _count: { select: { proposals: true, meetings: true } },
    },
  });

  // Today's replies (count of OutreachMessage where repliedAt is today)
  const todayCount = await prisma.outreachMessage.count({
    where: { repliedAt: { gte: todayStart } },
  });

  let unanswered = 0;
  let meetingsWaiting = 0;
  let proposalsRequested = 0;
  let hotOpportunities = 0;

  const HOT_REASONS = new Set(["MEETING_REQUESTED", "PROPOSAL_REQUESTED", "INTERESTED"]);
  const LOST = new Set(["CONVERTI", "PERDU", "REFUSE", "CLIENT"]);

  for (const p of replied) {
    const reason = p.outreachMessages[0]?.replyReason || null;
    const isLost = LOST.has(p.status);
    const hasMeeting = p._count.meetings > 0;
    const hasProposal = p._count.proposals > 0;

    if (!isLost && !hasMeeting && !hasProposal) {
      unanswered++;
    }
    if (reason === "MEETING_REQUESTED" && !hasMeeting && !isLost) meetingsWaiting++;
    if (reason === "PROPOSAL_REQUESTED" && !hasProposal && !isLost) proposalsRequested++;
    if (reason && HOT_REASONS.has(reason) && !isLost) hotOpportunities++;
  }

  return NextResponse.json({
    unanswered,
    today: todayCount,
    meetingsWaiting,
    proposalsRequested,
    hotOpportunities,
  });
}
