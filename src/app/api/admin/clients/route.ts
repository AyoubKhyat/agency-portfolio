import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

const createSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactPerson: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  email: z.string().optional().default(""),
  website: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  contractValue: z.number().nonnegative().optional().default(0),
  acquisitionSource: z.string().optional().default(""),
  status: z.enum(STATUSES).optional().default("ACTIVE"),
  accountManagerId: z.string().nullable().optional(),
  prospectId: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const ownerId = searchParams.get("ownerId");
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (status && STATUSES.includes(status as typeof STATUSES[number])) where.status = status;
  if (ownerId) where.accountManagerId = ownerId;
  if (q) {
    where.OR = [
      { companyName:   { contains: q, mode: "insensitive" } },
      { contactPerson: { contains: q, mode: "insensitive" } },
      { email:         { contains: q, mode: "insensitive" } },
      { phone:         { contains: q } },
      { industry:      { contains: q, mode: "insensitive" } },
    ];
  }

  const clients = await prisma.client.findMany({
    where,
    include: {
      accountManager: { select: { id: true, fullName: true, avatarInitials: true } },
      _count: { select: { projects: true, proposals: true, notes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(clients);
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

  const client = await prisma.client.create({
    data: {
      ...data,
      accountManagerId: data.accountManagerId || null,
      prospectId: data.prospectId || null,
    },
  });

  await prisma.clientActivity.create({
    data: {
      clientId: client.id,
      userId: session.userId,
      userName: session.fullName,
      actionType: "CLIENT_CREATED",
    },
  });

  return NextResponse.json(client, { status: 201 });
}
