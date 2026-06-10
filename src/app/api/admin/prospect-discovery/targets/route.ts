import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const putSchema = z.object({
  userId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetImports: z.number().int().min(0).max(500).optional(),
  targetContacts: z.number().int().min(0).max(500).optional(),
});

function parseDateOnly(s: string): Date {
  // Force midnight UTC so the Postgres date column lands on the right calendar day
  return new Date(`${s}T00:00:00Z`);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ targets: [] });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const date = parseDateOnly(dateStr);
  const dayStart = new Date(date);
  const dayEnd = new Date(date.getTime() + 86_400_000);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });

  const existingTargets = await prisma.dailyTarget.findMany({
    where: { date },
  });
  const targetMap = new Map(existingTargets.map((t) => [t.userId, t]));

  // Per-user actuals
  const results = await Promise.all(
    users.map(async (u) => {
      const target = targetMap.get(u.id);
      const [importedToday, contactedToday, repliedToday] = await Promise.all([
        prisma.prospect.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
            OR: [{ ownerUserId: u.id }, { lastActionByUserId: u.id }],
          },
        }),
        prisma.outreachMessage.count({
          where: { sentById: u.id, sentAt: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.outreachMessage.count({
          where: { sentById: u.id, repliedAt: { gte: dayStart, lt: dayEnd } },
        }),
      ]);

      return {
        userId: u.id,
        name: u.fullName,
        role: u.role,
        targetImports: target?.targetImports ?? 15,
        targetContacts: target?.targetContacts ?? 15,
        importedToday,
        contactedToday,
        repliedToday,
      };
    })
  );

  return NextResponse.json({ date: dateStr, targets: results });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const date = parseDateOnly(parsed.data.date);

  const target = await prisma.dailyTarget.upsert({
    where: { userId_date: { userId: parsed.data.userId, date } },
    update: {
      ...(parsed.data.targetImports !== undefined ? { targetImports: parsed.data.targetImports } : {}),
      ...(parsed.data.targetContacts !== undefined ? { targetContacts: parsed.data.targetContacts } : {}),
    },
    create: {
      userId: parsed.data.userId,
      date,
      targetImports: parsed.data.targetImports ?? 15,
      targetContacts: parsed.data.targetContacts ?? 15,
    },
  });

  return NextResponse.json(target);
}
