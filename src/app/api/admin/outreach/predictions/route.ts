import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Top-20 HOT prospects most likely to convert to clients.
 *
 * Scoring factors (max ~150, capped 100):
 *  +40 has WhatsApp (= phone)
 *  +30 has Instagram
 *  +15 has website
 *  +10 recent activity in last 7 days
 *  +25 per previous reply (cap 2 → +50)
 *  +10 sector has converted clients in last 90 days
 *  +20 status = REPONDU (warmed up)
 *  +15 has a meeting scheduled or completed
 *  +10 sender already tried at least once (engaged but not closed)
 */
const SINCE_DAYS = 90;
const RECENT_DAYS = 7;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ predictions: [] });

  const sinceRecent = new Date(Date.now() - RECENT_DAYS * 86_400_000);
  const sinceConversions = new Date(Date.now() - SINCE_DAYS * 86_400_000);

  // Sectors with successful client conversions in last 90 days
  const recentWinClients = await prisma.client.findMany({
    where: { createdAt: { gte: sinceConversions }, prospectId: { not: null } },
    select: { prospect: { select: { sector: true } } },
  });
  const winningSectorsCount: Record<string, number> = {};
  for (const c of recentWinClients) {
    const s = c.prospect?.sector;
    if (s) winningSectorsCount[s] = (winningSectorsCount[s] || 0) + 1;
  }
  const winningSectors = new Set(Object.keys(winningSectorsCount));

  // All HOT prospects with related counts
  const hotProspects = await prisma.prospect.findMany({
    where: {
      qualityLabel: "HOT",
      status: { notIn: ["CONVERTI", "CLIENT", "PERDU", "REFUSE"] },
    },
    select: {
      id: true, name: true, sector: true, neighborhood: true,
      phone: true, instagram: true, hasWebsite: true, website: true,
      qualityLabel: true, score: true, status: true,
      sentAt: true, lastActionAt: true,
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
      _count: {
        select: {
          outreachMessages: { where: { replied: true } },
          meetings: true,
        },
      },
    },
  });

  type Ranked = (typeof hotProspects)[0] & {
    predictionScore: number;
    reasons: string[];
  };

  const ranked: Ranked[] = hotProspects.map((p) => {
    let s = 0;
    const reasons: string[] = [];

    const hasPhone = !!(p.phone && p.phone.trim());
    const hasInsta = !!(p.instagram && p.instagram.trim());
    const hasSite = p.hasWebsite || !!(p.website && p.website.trim());

    if (hasPhone) { s += 40; reasons.push("WhatsApp reachable"); }
    if (hasInsta) { s += 30; reasons.push("Instagram"); }
    if (hasSite) { s += 15; reasons.push("Website"); }

    const replies = p._count.outreachMessages;
    if (replies > 0) {
      s += Math.min(replies, 2) * 25;
      reasons.push(`${replies} previous repl${replies === 1 ? "y" : "ies"}`);
    }

    if (p.lastActionAt && p.lastActionAt > sinceRecent) {
      s += 10;
      reasons.push("Recent activity");
    }

    if (winningSectors.has(p.sector)) {
      s += 10;
      const wins = winningSectorsCount[p.sector];
      reasons.push(`${p.sector} converts (${wins} this quarter)`);
    }

    if (p.status === "REPONDU") {
      s += 20;
      reasons.push("Already warmed up");
    }

    if (p._count.meetings > 0) {
      s += 15;
      reasons.push("Has meeting");
    }

    if (p.sentAt) {
      s += 10;
      reasons.push("Engaged");
    }

    s = Math.min(100, s);
    return { ...p, predictionScore: s, reasons };
  });

  ranked.sort((a, b) => b.predictionScore - a.predictionScore);
  const top20 = ranked.slice(0, 20);

  return NextResponse.json({
    predictions: top20,
    metadata: {
      sinceDays: SINCE_DAYS,
      hotConsidered: hotProspects.length,
      winningSectorsThisQuarter: Object.entries(winningSectorsCount)
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
  });
}
