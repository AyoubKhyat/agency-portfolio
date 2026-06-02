import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyUser, notifyUsers } from "@/lib/notify";

const STATUSES = ["DRAFT", "PENDING_SIGNATURE", "SIGNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

const patchSchema = z.object({
  title:        z.string().min(1).optional(),
  status:       z.enum(STATUSES).optional(),
  amount:       z.number().nonnegative().optional(),
  currency:     z.string().optional(),
  paymentTerms: z.string().optional(),
  notes:        z.string().optional(),
  signedDate:   z.string().nullable().optional(),
  startDate:    z.string().nullable().optional(),
  endDate:      z.string().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { id } = await params;
  const c = await prisma.contract.findUnique({
    where: { id },
    include: {
      client:   { select: { id: true, companyName: true, accountManagerId: true } },
      prospect: { select: { id: true, name: true, sector: true, phone: true } },
      proposal: { select: { id: true, packageName: true, amount: true, currency: true } },
    },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

/**
 * Side-effects when a contract becomes SIGNED:
 *   1. Ensure a Client record exists (lift the prospect to a real account).
 *   2. Link the contract + originating proposal + ClientProject (if any) to that Client.
 *   3. Mark the prospect status = CLIENT and stamp lastActionBy.
 *   4. Fire an ACCOUNT_ASSIGNED notification to the new account manager.
 *   5. Create an onboarding task on the new client.
 */
async function signContract(args: {
  contractId: string;
  signedDate: Date;
  sessionUserId: string;
  sessionFullName: string;
}) {
  const contract = await prisma.contract.findUnique({
    where: { id: args.contractId },
    include: {
      client: true,
      prospect: true,
      proposal: true,
    },
  });
  if (!contract) return null;

  let clientId = contract.clientId;
  let client = contract.client;

  // Step 1 — create Client if missing.
  if (!client && contract.prospect) {
    const p = contract.prospect;
    client = await prisma.client.create({
      data: {
        companyName: p.name,
        contactPerson: "",
        phone: p.phone ?? "",
        whatsapp: p.whatsappLink ?? "",
        email: "",
        website: "",
        industry: p.sector ?? "",
        contractValue: contract.amount ?? 0,
        acquisitionSource: "Prospecting",
        status: "ACTIVE",
        accountManagerId: p.ownerUserId ?? null,
        prospectId: p.id,
      },
    });
    clientId = client.id;
    await prisma.contract.update({ where: { id: contract.id }, data: { clientId } });
  } else if (client && contract.amount > 0) {
    // Add the contract value into the client's running total.
    await prisma.client.update({
      where: { id: client.id },
      data: { contractValue: { increment: contract.amount } },
    });
  }

  // Step 2 — link proposal / projects to the client.
  if (clientId && contract.proposalId) {
    await prisma.proposal.updateMany({
      where: { id: contract.proposalId, clientId: null },
      data: { clientId },
    });
  }
  if (clientId && contract.prospect) {
    await prisma.clientProject.updateMany({
      where: { prospectId: contract.prospect.id, clientId: null },
      data: { clientId },
    });
  }

  // Step 3 — flip prospect to CLIENT.
  if (contract.prospect) {
    await prisma.prospect.update({
      where: { id: contract.prospect.id },
      data: {
        status: "CLIENT",
        lastActionByUserId: args.sessionUserId,
        lastActionByName: args.sessionFullName,
        lastActionAt: args.signedDate,
      },
    });
    await prisma.prospectActivity.create({
      data: {
        prospectId: contract.prospect.id,
        userId: args.sessionUserId,
        userName: args.sessionFullName,
        actionType: "STATUS_CLIENT",
        details: `Contract signed: ${contract.title}`,
      },
    });
  }

  // Step 4 — activity + notifications on the client.
  if (clientId) {
    await prisma.clientActivity.create({
      data: {
        clientId,
        userId: args.sessionUserId,
        userName: args.sessionFullName,
        actionType: "CONTRACT_SIGNED",
        details: `${contract.title} — ${contract.amount} ${contract.currency}`,
      },
    });

    const mgr = (await prisma.client.findUnique({ where: { id: clientId }, select: { accountManagerId: true, companyName: true } }));
    if (mgr?.accountManagerId && mgr.accountManagerId !== args.sessionUserId) {
      notifyUser(mgr.accountManagerId, {
        type: "CONTRACT_SIGNED",
        title: `Contract signed for ${mgr.companyName}`,
        body: `${contract.title} — ${contract.amount} ${contract.currency}`,
        link: `/admin/clients/${clientId}`,
      }).catch(() => {});
    }

    // Step 5 — onboarding task.
    const due = new Date(args.signedDate);
    due.setDate(due.getDate() + 2);
    due.setHours(10, 0, 0, 0);
    const ownerId = mgr?.accountManagerId ?? null;
    let ownerName: string | null = null;
    if (ownerId) {
      const u = await prisma.user.findUnique({ where: { id: ownerId }, select: { fullName: true } });
      ownerName = u?.fullName ?? null;
    }
    await prisma.task.create({
      data: {
        title: `Onboard ${mgr?.companyName ?? "new client"}`,
        description: `Kick off the engagement: send welcome email, schedule kickoff meeting, set up project board.`,
        priority: "HIGH",
        status: "TODO",
        dueDate: due,
        parentType: "CLIENT",
        parentId: clientId,
        parentLabel: mgr?.companyName ?? null,
        ownerId,
        ownerName,
        createdById: args.sessionUserId,
        createdByName: args.sessionFullName,
      },
    });

    // Broadcast to the whole active team for a "we won!" moment.
    const team = await prisma.user.findMany({ where: { isActive: true, id: { not: args.sessionUserId } }, select: { id: true } });
    if (team.length > 0) {
      notifyUsers(team.map((t) => t.id), {
        type: "conversion",
        title: `New signed client: ${mgr?.companyName ?? ""}`,
        body: `${contract.title} — ${contract.amount} ${contract.currency}, signed by ${args.sessionFullName}`,
        link: `/admin/clients/${clientId}`,
      }).catch(() => {});
    }
  }

  return prisma.contract.findUnique({
    where: { id: contract.id },
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true } },
      proposal: { select: { id: true, packageName: true, amount: true } },
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const data = parsed.data;

  const before = await prisma.contract.findUnique({ where: { id }, select: { status: true, clientId: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SIGNED is admin-only because it converts the prospect into a Client.
  if (data.status === "SIGNED" && session.role !== "admin") {
    return NextResponse.json({ error: "Only admins can sign contracts" }, { status: 403 });
  }

  const justSigned = data.status === "SIGNED" && before.status !== "SIGNED";

  await prisma.contract.update({
    where: { id },
    data: {
      ...(data.title        !== undefined ? { title:        data.title }        : {}),
      ...(data.status       !== undefined ? { status:       data.status }       : {}),
      ...(data.amount       !== undefined ? { amount:       data.amount }       : {}),
      ...(data.currency     !== undefined ? { currency:     data.currency }     : {}),
      ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
      ...(data.notes        !== undefined ? { notes:        data.notes }        : {}),
      ...(data.signedDate   !== undefined ? { signedDate:   data.signedDate ? new Date(data.signedDate) : null } : {}),
      ...(data.startDate    !== undefined ? { startDate:    data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.endDate      !== undefined ? { endDate:      data.endDate ? new Date(data.endDate) : null } : {}),
      ...(justSigned && !data.signedDate ? { signedDate: new Date() } : {}),
    },
  });

  if (justSigned) {
    const signedDate = data.signedDate ? new Date(data.signedDate) : new Date();
    const result = await signContract({ contractId: id, signedDate, sessionUserId: session.userId, sessionFullName: session.fullName });
    if (result) return NextResponse.json(result);
  }

  // Activity log for non-signing status changes.
  if (data.status && data.status !== before.status && !justSigned) {
    const after = await prisma.contract.findUnique({ where: { id }, include: { client: { select: { id: true, companyName: true } } } });
    try {
      if (after?.clientId) {
        await prisma.clientActivity.create({
          data: {
            clientId: after.clientId,
            userId: session.userId,
            userName: session.fullName,
            actionType: `CONTRACT_${data.status}`,
            details: after.title,
          },
        });
      }
    } catch { /* swallow */ }
  }

  const refreshed = await prisma.contract.findUnique({
    where: { id },
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true } },
      proposal: { select: { id: true, packageName: true, amount: true } },
    },
  });
  return NextResponse.json(refreshed);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { id } = await params;
  await prisma.contract.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
