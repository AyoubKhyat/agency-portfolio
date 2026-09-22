import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  FOLLOW_UP_EXCLUDED_STATUSES,
  computeFollowUpBucket,
  type FollowUpBucket,
} from "@/lib/follow-up";

/**
 * HOT prospects bucketed by follow-up stage.
 *
 *  - never_contacted: qualityLabel=HOT, sentAt=null
 *  - due_day_4: sentAt is 3+ days ago, followup1At=null
 *  - due_day_10: followup1At is 6+ days ago, followup2At=null
 *  - due_day_20: followup2At is 10+ days ago, followup3At=null
 *
 * Suppression is defined in @/lib/follow-up and applied TWICE on purpose:
 * once as a Prisma filter (so the `take` budget isn't spent on rows we will
 * discard) and once via computeFollowUpBucket (the authoritative rule). A
 * prospect with ANY replied outreach message never appears here, regardless
 * of whether anyone remembered to move their status to REPONDU.
 */

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
      status: { notIn: [...FOLLOW_UP_EXCLUDED_STATUSES] },
      // A reply on ANY outreach message takes the prospect out of the queue.
      outreachMessages: { none: { replied: true } },
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

  // Replies are already excluded by the query above; re-read them so the pure
  // rule gets a real value instead of a hardcoded `false` that could mask a
  // future query regression.
  const repliedRows = all.length === 0 ? [] : await prisma.outreachMessage.findMany({
    where: { prospectId: { in: all.map((p) => p.id) }, replied: true },
    select: { prospectId: true },
    distinct: ["prospectId"],
  });
  const repliedProspectIds = new Set(repliedRows.map((r) => r.prospectId));

  const allWithTouches = all.map((p) => ({
    ...p,
    whatsappTouchCount: touchCountByProspect.get(p.id) ?? 0,
  }));

  const now = Date.now();
  const buckets: Record<FollowUpBucket, typeof allWithTouches> = {
    never_contacted: [],
    due_day_4: [],
    due_day_10: [],
    due_day_20: [],
  };

  for (const p of allWithTouches) {
    const bucket = computeFollowUpBucket(
      { ...p, hasReply: repliedProspectIds.has(p.id) },
      now,
    );
    if (bucket) buckets[bucket].push(p);
  }

  // Sort each bucket by score (highest first), then by oldest action (push the staler ones up)
  for (const k of Object.keys(buckets) as FollowUpBucket[]) {
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
