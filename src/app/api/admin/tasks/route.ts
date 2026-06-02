import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const PARENT_TYPES = ["PROSPECT", "CLIENT", "PROJECT", "PROPOSAL"] as const;

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  priority: z.enum(PRIORITIES).optional().default("MEDIUM"),
  status: z.enum(STATUSES).optional().default("TODO"),
  dueDate: z.string().nullable().optional(),
  parentType: z.enum(PARENT_TYPES).nullable().optional(),
  parentId: z.string().nullable().optional(),
  parentLabel: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const status = searchParams.get("status");
  const parentType = searchParams.get("parentType");
  const parentId = searchParams.get("parentId");
  const scope = searchParams.get("scope"); // mine | overdue | today | upcoming | all
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

  const where: Record<string, unknown> = {};
  if (ownerId) where.ownerId = ownerId;
  if (status && STATUSES.includes(status as typeof STATUSES[number])) where.status = status;
  if (parentType) where.parentType = parentType;
  if (parentId) where.parentId = parentId;

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);

  if (scope === "mine") {
    where.ownerId = session.userId;
    where.status = { in: ["TODO", "IN_PROGRESS", "BLOCKED"] };
  } else if (scope === "overdue") {
    where.status = { in: ["TODO", "IN_PROGRESS", "BLOCKED"] };
    where.dueDate = { lt: startOfDay };
  } else if (scope === "today") {
    where.status = { in: ["TODO", "IN_PROGRESS", "BLOCKED"] };
    where.dueDate = { gte: startOfDay, lte: endOfDay };
  } else if (scope === "upcoming") {
    where.status = { in: ["TODO", "IN_PROGRESS", "BLOCKED"] };
    where.dueDate = { gt: endOfDay };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
    },
    orderBy: [
      { status: "asc" },
      { dueDate: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msgs = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`);
    return NextResponse.json({ error: msgs.join("; ") || "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  // Resolve owner name for denormalized display.
  let ownerName: string | null = null;
  if (data.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { fullName: true },
    });
    ownerName = owner?.fullName ?? null;
  }

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      priority: data.priority ?? "MEDIUM",
      status: data.status ?? "TODO",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      parentType: data.parentType || null,
      parentId: data.parentId || null,
      parentLabel: data.parentLabel || null,
      ownerId: data.ownerId || null,
      ownerName,
      createdById: session.userId,
      createdByName: session.fullName,
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
