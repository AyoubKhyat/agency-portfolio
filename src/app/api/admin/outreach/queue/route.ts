import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * HOT prospects bucketed by follow-up stage.
 *
 *  - never_contacted: qualityLabel=HOT, sentAt=null
 *  - due_day_4: sentAt is 3+ days ago, followup1At=null
 *  - due_day_10: followup1At is 6+ days ago, followup2At=null
 *  - due_day_20: followup2At is 10+ days ago, followup3At=null
 *
 * Excludes prospects already replied / converted (REPONDU / CONVERTI / CLIENT)
 * since those have moved past the cold-outreach phase.
 */

const DAY = 86_400_000;
const ACTIVE_STATUSES_EXCLUDED = ["REPONDU", "CONVERTI", "CLIENT", "PERDU", "REFUSE"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) {
    return NextResponse.json({
      buckets: { never_contacted: [], due_day_4: [], due_day_10: [], due_day_20: [] },
      counts: { never_contacted: 0, due_day_4: 0, due_day_10: 0, due_day_20: 0 },
    });
  }

  const all = await prisma.prospect.findMany({
    where: {
      qualityLabel: "HOT",
      status: { notIn: ACTIVE_STATUSES_EXCLUDED },
    },
    select: {
      id: true, name: true, phone: true, whatsappLink: true, instagram: true,
      sector: true, neighborhood: true, score: true, qualityLabel: true,
      sentAt: true, followup1At: true, followup2At: true, followup3At: true,
      status: true,
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
      lastActionByName: true, lastActionAt: true,
    },
    take: 1000,
  });

  // Touch count from the audit log — counts every WA/IG button click logged as ProspectActivity.
  // Used by /admin/outreach to cap pre-filled templates at "intro + 1 follow-up" per prospect.
  const touchRows = all.length === 0 ? [] : await prisma.prospectActivity.groupBy({
    by: ["prospectId"],
    where: {
      prospectId: { in: all.map((p) => p.id) },
      actionType: { in: ["SENT_WHATSAPP", "SENT_INSTAGRAM"] },
    },
    _count: { _all: true },
  });
  const touchCountByProspect = new Map<string, number>(
    touchRows.map((r) => [r.prospectId, r._count._all]),
  );
  const allWithTouches = all.map((p) => ({
    ...p,
    whatsappTouchCount: touchCountByProspect.get(p.id) ?? 0,
  }));

  const now = Date.now();
  type Bucket = "never_contacted" | "due_day_4" | "due_day_10" | "due_day_20";
  const buckets: Record<Bucket, typeof allWithTouches> = {
    never_contacted: [],
    due_day_4: [],
    due_day_10: [],
    due_day_20: [],
  };

  for (const p of allWithTouches) {
    // Most-advanced bucket the prospect qualifies for
    if (!p.sentAt) {
      buckets.never_contacted.push(p);
      continue;
    }
    if (!p.followup1At) {
      if (now - p.sentAt.getTime() >= 3 * DAY) buckets.due_day_4.push(p);
      continue;
    }
    if (!p.followup2At) {
      if (now - p.followup1At.getTime() >= 6 * DAY) buckets.due_day_10.push(p);
      continue;
    }
    if (!p.followup3At) {
      if (now - p.followup2At.getTime() >= 10 * DAY) buckets.due_day_20.push(p);
      continue;
    }
    // followup3At set → cycle complete, skip
  }

  // Sort each bucket by score (highest first), then by oldest action (push the staler ones up)
  for (const k of Object.keys(buckets) as Bucket[]) {
    buckets[k].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const aT = a.lastActionAt?.getTime() ?? 0;
      const bT = b.lastActionAt?.getTime() ?? 0;
      return aT - bT;
    });
  }

  return NextResponse.json({
    buckets,
    counts: {
      never_contacted: buckets.never_contacted.length,
      due_day_4: buckets.due_day_4.length,
      due_day_10: buckets.due_day_10.length,
      due_day_20: buckets.due_day_20.length,
    },
    totalHot: allWithTouches.length,
  });
}
