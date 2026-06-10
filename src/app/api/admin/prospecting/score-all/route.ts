import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { scoreProspect } from "@/lib/prospect-scoring";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const prospects = await prisma.prospect.findMany({
    select: {
      id: true,
      hasWebsite: true,
      instagram: true,
      whatsappLink: true,
      sentAt: true,
      _count: { select: { proposals: true } },
    },
  });

  // Pre-compute replies and meetings per prospect in two queries
  const replyAgg = await prisma.outreachMessage.groupBy({
    by: ["prospectId"],
    _count: { id: true },
    where: { replied: true },
  });
  const replyMap = new Map(replyAgg.map((r) => [r.prospectId, r._count.id]));

  const meetingAgg = await prisma.meeting.groupBy({
    by: ["prospectId"],
    _count: { id: true },
    where: { status: "COMPLETED", prospectId: { not: null } },
  });
  const meetingMap = new Map(meetingAgg.map((m) => [m.prospectId!, m._count.id]));

  let updated = 0;
  for (const p of prospects) {
    const { score, label } = scoreProspect({
      hasWebsite: p.hasWebsite,
      instagram: p.instagram,
      whatsappLink: p.whatsappLink,
      sentAt: p.sentAt,
      outreachReplies: replyMap.get(p.id) ?? 0,
      meetingsCompleted: meetingMap.get(p.id) ?? 0,
      proposalCount: p._count.proposals,
    });

    await prisma.prospect.update({
      where: { id: p.id },
      data: { score, scoreLabel: label, scoredAt: new Date() },
    });
    updated++;
  }

  return NextResponse.json({ updated });
}
