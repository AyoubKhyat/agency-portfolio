import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { scoreProspect } from "@/lib/prospect-scoring";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;

  const p = await prisma.prospect.findUnique({
    where: { id },
    select: {
      hasWebsite: true,
      instagram: true,
      whatsappLink: true,
      sentAt: true,
      _count: { select: { proposals: true } },
    },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [replies, meetingsDone] = await Promise.all([
    prisma.outreachMessage.count({ where: { prospectId: id, replied: true } }),
    prisma.meeting.count({ where: { prospectId: id, status: "COMPLETED" } }),
  ]);

  const { score, label } = scoreProspect({
    hasWebsite: p.hasWebsite,
    instagram: p.instagram,
    whatsappLink: p.whatsappLink,
    sentAt: p.sentAt,
    outreachReplies: replies,
    meetingsCompleted: meetingsDone,
    proposalCount: p._count.proposals,
  });

  const updated = await prisma.prospect.update({
    where: { id },
    data: { score, scoreLabel: label, scoredAt: new Date() },
    select: { score: true, scoreLabel: true, scoredAt: true },
  });

  return NextResponse.json(updated);
}
