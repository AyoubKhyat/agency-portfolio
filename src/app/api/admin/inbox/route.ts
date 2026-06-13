import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Reply Inbox — every prospect that has replied (or been marked REPONDU)
 * with their latest reply reason, owner, and whether downstream artifacts
 * (meeting, proposal) already exist.
 *
 * Priority (highest first):
 *   1. MEETING_REQUESTED  → can't sit on this
 *   2. PROPOSAL_REQUESTED → close-of-mouth window
 *   3. INTERESTED         → warm but ambiguous
 *   4. LATER              → callback scheduled
 *   5. everything else
 */

const PRIORITY: Record<string, number> = {
  MEETING_REQUESTED: 1,
  PROPOSAL_REQUESTED: 2,
  INTERESTED: 3,
  LATER: 4,
  NOT_INTERESTED: 8,
  HAS_PROVIDER: 7,
  TOO_EXPENSIVE: 6,
  NO_BUDGET: 6,
};

const VIEWS = [
  "ALL", "NEW",
  "MEETING_REQUESTED", "PROPOSAL_REQUESTED", "INTERESTED", "LATER",
  "NO_BUDGET", "NOT_INTERESTED", "HAS_PROVIDER", "TOO_EXPENSIVE",
] as const;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ items: [] });

  const { searchParams } = new URL(req.url);
  const view = (searchParams.get("view") || "ALL").toUpperCase();
  const ownerId = searchParams.get("ownerId");

  // Pull every prospect that has replied
  const repliedProspects = await prisma.prospect.findMany({
    where: {
      OR: [
        { status: "REPONDU" },
        { outreachMessages: { some: { replied: true } } },
      ],
      ...(ownerId && ownerId !== "ALL" ? { ownerUserId: ownerId === "UNASSIGNED" ? null : ownerId } : {}),
    },
    select: {
      id: true, name: true, phone: true, whatsappLink: true, instagram: true,
      sector: true, neighborhood: true, qualityLabel: true, score: true,
      status: true, followUpDate: true, lastActionAt: true, lastActionByName: true,
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
      outreachMessages: {
        where: { replied: true },
        orderBy: { repliedAt: "desc" },
        take: 1,
        select: { repliedAt: true, replyReason: true, body: true, channel: true, templateKey: true },
      },
      proposals: { select: { id: true, status: true }, take: 1 },
      meetings: { select: { id: true, status: true, startAt: true }, orderBy: { startAt: "desc" }, take: 1 },
      _count: { select: { proposals: true, meetings: true } },
    },
    take: 500,
  });

  // Hydrate with the latest reply meta + sort key
  type Item = {
    id: string; name: string; phone: string; whatsappLink: string; instagram: string;
    sector: string; city: string;
    qualityLabel: string | null; score: number | null;
    status: string;
    followUpDate: string | null;
    latestReplyAt: string | null;
    latestReplyReason: string | null;
    latestReplyBody: string | null;
    latestReplyChannel: string | null;
    owner: { id: string; fullName: string; avatarInitials: string } | null;
    hasMeeting: boolean; nextMeetingAt: string | null;
    hasProposal: boolean;
    priority: number;
  };

  const items: Item[] = repliedProspects.map((p) => {
    const latest = p.outreachMessages[0];
    const reason = latest?.replyReason || (p.status === "REPONDU" ? null : null);
    const meeting = p.meetings[0];
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      whatsappLink: p.whatsappLink,
      instagram: p.instagram,
      sector: p.sector,
      city: p.neighborhood || "Marrakech",
      qualityLabel: p.qualityLabel,
      score: p.score,
      status: p.status,
      followUpDate: p.followUpDate?.toISOString() ?? null,
      latestReplyAt: latest?.repliedAt?.toISOString() ?? null,
      latestReplyReason: reason,
      latestReplyBody: latest?.body ?? null,
      latestReplyChannel: latest?.channel ?? null,
      owner: p.owner,
      hasMeeting: p._count.meetings > 0,
      nextMeetingAt: meeting?.startAt?.toISOString() ?? null,
      hasProposal: p._count.proposals > 0,
      priority: reason ? (PRIORITY[reason] ?? 9) : 5,
    };
  });

  // Sort by priority, then by latestReplyAt desc
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aT = a.latestReplyAt ? new Date(a.latestReplyAt).getTime() : 0;
    const bT = b.latestReplyAt ? new Date(b.latestReplyAt).getTime() : 0;
    return bT - aT;
  });

  // View filter (server-side)
  let filtered = items;
  if (view === "NEW") {
    // New = replied within 48h AND no downstream action yet
    const cutoff = Date.now() - 48 * 3600 * 1000;
    filtered = items.filter((i) => {
      const t = i.latestReplyAt ? new Date(i.latestReplyAt).getTime() : 0;
      return t >= cutoff && !i.hasMeeting && !i.hasProposal && i.status !== "CONVERTI";
    });
  } else if (view !== "ALL" && VIEWS.includes(view as (typeof VIEWS)[number])) {
    filtered = items.filter((i) => i.latestReplyReason === view);
  }

  // Counts for tab badges (across all owners for the visible owner filter)
  const counts = {
    all: items.length,
    new: items.filter((i) => {
      const t = i.latestReplyAt ? new Date(i.latestReplyAt).getTime() : 0;
      return t >= Date.now() - 48 * 3600 * 1000 && !i.hasMeeting && !i.hasProposal && i.status !== "CONVERTI";
    }).length,
    meeting_requested: items.filter((i) => i.latestReplyReason === "MEETING_REQUESTED").length,
    proposal_requested: items.filter((i) => i.latestReplyReason === "PROPOSAL_REQUESTED").length,
    interested: items.filter((i) => i.latestReplyReason === "INTERESTED").length,
    later: items.filter((i) => i.latestReplyReason === "LATER").length,
    no_budget: items.filter((i) => i.latestReplyReason === "NO_BUDGET").length,
    not_interested: items.filter((i) => i.latestReplyReason === "NOT_INTERESTED").length,
  };

  return NextResponse.json({ items: filtered, counts, view });
}
