/**
 * Recompute scoreLabel + score for every prospect.
 * Run: npx tsx prisma/score-all-prospects.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { scoreProspect } from "../src/lib/prospect-scoring";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
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

  let i = 0;
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
    i++;
  }
  console.log(`Scored ${i} prospects.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
