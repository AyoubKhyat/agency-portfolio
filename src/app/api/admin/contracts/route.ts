import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const STATUSES = ["DRAFT", "PENDING_SIGNATURE", "SIGNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

const createSchema = z.object({
  title:        z.string().min(1, "Title required"),
  clientId:     z.string().nullable().optional(),
  proposalId:   z.string().nullable().optional(),
  prospectId:   z.string().nullable().optional(),
  amount:       z.number().nonnegative().optional().default(0),
  currency:     z.string().optional().default("MAD"),
  status:       z.enum(STATUSES).optional().default("DRAFT"),
  paymentTerms: z.string().optional().default(""),
  notes:        z.string().optional().default(""),
  startDate:    z.string().nullable().optional(),
  endDate:      z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const prospectId = searchParams.get("prospectId");
  const status = searchParams.get("status");
  const expiring = searchParams.get("expiring"); // "30" → next 30 days

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (prospectId) where.prospectId = prospectId;
  if (status && STATUSES.includes(status as typeof STATUSES[number])) where.status = status;
  if (expiring) {
    const days = Math.min(Math.max(Number(expiring) || 30, 1), 365);
    const now = new Date();
    const cutoff = new Date(now); cutoff.setDate(now.getDate() + days);
    where.endDate = { gte: now, lte: cutoff };
    where.status = { in: ["ACTIVE", "SIGNED"] };
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true } },
      proposal: { select: { id: true, packageName: true, amount: true, currency: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(contracts);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  if (!data.clientId && !data.prospectId) {
    return NextResponse.json({ error: "Contract must be linked to a client or a prospect" }, { status: 400 });
  }

  const contract = await prisma.contract.create({
    data: {
      title: data.title,
      clientId: data.clientId || null,
      proposalId: data.proposalId || null,
      prospectId: data.prospectId || null,
      amount: data.amount ?? 0,
      currency: data.currency ?? "MAD",
      status: data.status ?? "DRAFT",
      paymentTerms: data.paymentTerms ?? "",
      notes: data.notes ?? "",
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdById: session.userId,
      createdByName: session.fullName,
    },
    include: {
      client:   { select: { id: true, companyName: true, accountManagerId: true } },
      prospect: { select: { id: true, name: true } },
    },
  });

  try {
    if (contract.clientId) {
      await prisma.clientActivity.create({
        data: {
          clientId: contract.clientId,
          userId: session.userId,
          userName: session.fullName,
          actionType: "CONTRACT_CREATED",
          details: `${contract.title} — ${contract.amount} ${contract.currency}`,
        },
      });
      if (contract.client?.accountManagerId && contract.client.accountManagerId !== session.userId) {
        notifyUser(contract.client.accountManagerId, {
          type: "CONTRACT_CREATED",
          title: `Contract drafted for ${contract.client.companyName}`,
          body: `${contract.title} — ${contract.amount} ${contract.currency}`,
          link: `/admin/clients/${contract.clientId}`,
        }).catch(() => {});
      }
    } else if (contract.prospectId) {
      await prisma.prospectActivity.create({
        data: {
          prospectId: contract.prospectId,
          userId: session.userId,
          userName: session.fullName,
          actionType: "CONTRACT_CREATED",
          details: `${contract.title} — ${contract.amount} ${contract.currency}`,
        },
      });
    }
  } catch { /* swallow */ }

  return NextResponse.json(contract, { status: 201 });
}
