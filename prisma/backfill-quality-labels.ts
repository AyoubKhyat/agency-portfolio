/**
 * Backfill qualityLabel + score for every existing prospect.
 * Uses current contact data (phone, instagram, hasWebsite/website, email).
 * Run: npx tsx prisma/backfill-quality-labels.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeQualityLabel } from "../src/lib/prospect-quality";
import { scoreProspect } from "../src/lib/prospect-scoring";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const prospects = await prisma.prospect.findMany({
    select: {
      id: true, phone: true, whatsappLink: true, instagram: true,
      hasWebsite: true, website: true, email: true,
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

  let hot = 0, warm = 0, cold = 0;
  for (const p of prospects) {
    const signals = {
      phone: p.phone || null,
      whatsapp: p.whatsappLink || null,
      instagram: p.instagram || null,
      website: p.website || null,
      email: p.email || null,
    };
    const qualityLabel = computeQualityLabel(signals);
    const { score, label } = scoreProspect({
      hasWebsite: p.hasWebsite,
      instagram: p.instagram,
      whatsappLink: p.whatsappLink,
      phone: p.phone,
      email: p.email,
      website: p.website,
      sentAt: p.sentAt,
      outreachReplies: replyMap.get(p.id) ?? 0,
      meetingsCompleted: meetingMap.get(p.id) ?? 0,
      proposalCount: p._count.proposals,
    });
    await prisma.prospect.update({
      where: { id: p.id },
      data: { qualityLabel, score, scoreLabel: label, scoredAt: new Date() },
    });
    if (qualityLabel === "HOT") hot++;
    else if (qualityLabel === "WARM") warm++;
    else cold++;
  }
  console.log(`Backfilled ${prospects.length} prospects: ${hot} HOT, ${warm} WARM, ${cold} COLD`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
