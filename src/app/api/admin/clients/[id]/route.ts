import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

const updateSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  contractValue: z.number().nonnegative().optional(),
  acquisitionSource: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  accountManagerId: z.string().nullable().optional(),
  prospectId: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      accountManager: { select: { id: true, fullName: true, avatarInitials: true, role: true } },
      prospect: { select: { id: true, name: true, sector: true, status: true } },
      projects: { orderBy: { updatedAt: "desc" } },
      proposals: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(client);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", detail: parsed.error.flatten() }, { status: 400 });
  }

  const before = await prisma.client.findUnique({ where: { id }, select: { status: true, accountManagerId: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = parsed.data;
  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...data,
      accountManagerId: data.accountManagerId === undefined ? undefined : data.accountManagerId || null,
      prospectId: data.prospectId === undefined ? undefined : data.prospectId || null,
    },
  });

  // Log significant changes.
  if (data.status && before.status !== data.status) {
    await prisma.clientActivity.create({
      data: {
        clientId: id,
        userId: session.userId,
        userName: session.fullName,
        actionType: "STATUS_CHANGED",
        details: `${before.status} → ${data.status}`,
      },
    });
    // Notify the account manager if they didn't make the change themselves.
    if (updated.accountManagerId && updated.accountManagerId !== session.userId) {
      notifyUser(updated.accountManagerId, {
        type: "CLIENT_STATUS_CHANGED",
        title: `${updated.companyName} is now ${data.status.toLowerCase()}`,
        body: `${session.fullName} changed the status from ${before.status.toLowerCase()}`,
        link: `/admin/clients/${id}`,
      }).catch(() => {});
    }
  }
  if (data.accountManagerId !== undefined && before.accountManagerId !== updated.accountManagerId) {
    await prisma.clientActivity.create({
      data: {
        clientId: id,
        userId: session.userId,
        userName: session.fullName,
        actionType: "MANAGER_CHANGED",
      },
    });
    if (updated.accountManagerId && updated.accountManagerId !== session.userId) {
      notifyUser(updated.accountManagerId, {
        type: "ACCOUNT_ASSIGNED",
        title: `You're now managing ${updated.companyName}`,
        body: `${session.fullName} assigned the account to you`,
        link: `/admin/clients/${id}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
