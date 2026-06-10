import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Returns prospects with their next pending follow-up step.
 * Cadence: Day 1 (initial) → Day 4 → Day 10 → Day 20.
 *
 * "Due" = the days-since-prev threshold has elapsed AND that step is not done.
 * "Upcoming" = step pending but not yet due.
 */

const CADENCE = {
  followup1Days: 3,
  followup2Days: 6,
  followup3Days: 10,
};

type SequenceItem = {
  prospectId: string;
  prospectName: string;
  sector: string;
  scoreLabel: string | null;
  step: "followup1" | "followup2" | "followup3";
  stepLabel: string;
  dueOn: Date | null;
  overdueDays: number; // negative = upcoming, 0 = today, positive = overdue
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ items: [], counts: { due: 0, upcoming: 0 } });

  // Only consider prospects in-flight: initial contact was made but the cycle isn't finished or replied
  const prospects = await prisma.prospect.findMany({
    where: {
      sentAt: { not: null },
      followup3At: null,
      status: { notIn: ["GAGNE", "REFUSE", "PERDU", "CLIENT"] },
    },
    select: {
      id: true,
      name: true,
      sector: true,
      scoreLabel: true,
      sentAt: true,
      followup1At: true,
      followup2At: true,
      followup3At: true,
    },
    take: 200,
  });

  const now = Date.now();
  const DAY = 86_400_000;
  const items: SequenceItem[] = [];

  for (const p of prospects) {
    let step: SequenceItem["step"] | null = null;
    let stepLabel = "";
    let dueOn: Date | null = null;

    if (!p.followup1At && p.sentAt) {
      step = "followup1";
      stepLabel = "Day 4 — First follow-up";
      dueOn = new Date(p.sentAt.getTime() + CADENCE.followup1Days * DAY);
    } else if (p.followup1At && !p.followup2At) {
      step = "followup2";
      stepLabel = "Day 10 — Second follow-up";
      dueOn = new Date(p.followup1At.getTime() + CADENCE.followup2Days * DAY);
    } else if (p.followup2At && !p.followup3At) {
      step = "followup3";
      stepLabel = "Day 20 — Final follow-up";
      dueOn = new Date(p.followup2At.getTime() + CADENCE.followup3Days * DAY);
    }

    if (!step || !dueOn) continue;

    const overdueDays = Math.floor((now - dueOn.getTime()) / DAY);
    items.push({
      prospectId: p.id,
      prospectName: p.name,
      sector: p.sector,
      scoreLabel: p.scoreLabel,
      step,
      stepLabel,
      dueOn,
      overdueDays,
    });
  }

  // Sort: most overdue first, then upcoming
  items.sort((a, b) => b.overdueDays - a.overdueDays);

  const due = items.filter((i) => i.overdueDays >= 0).length;
  const upcoming = items.length - due;

  return NextResponse.json({ items, counts: { due, upcoming } });
}
