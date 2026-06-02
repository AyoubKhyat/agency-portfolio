import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { logProspectActivity, notifyTeam, updateProspectStatus } from "@/lib/dal";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional(),
  amount: z.number().positive().optional(),
  services: z.string().optional(),
  timeline: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  contactPerson: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const current = await prisma.proposal.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.status === "ACCEPTED" && session.role !== "admin") {
    return NextResponse.json({ error: "Only admins can accept proposals" }, { status: 403 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "SENT") data.sentAt = new Date();

  const proposal = await prisma.proposal.update({
    where: { id },
    data,
    include: { prospect: { select: { id: true, name: true, sector: true, status: true } } },
  });

  try {
    if (parsed.data.status === "SENT") {
      await prisma.prospect.update({
        where: { id: current.prospectId },
        data: { proposalStatus: "SENT", proposalDate: new Date(), status: "PROPOSAL_SENT" },
      });
      await logProspectActivity({
        prospectId: current.prospectId,
        userId: session.userId,
        userName: session.fullName,
        actionType: "PROPOSAL_SENT",
        details: `Sent proposal — ${current.amount} ${current.currency}`,
      });
      // Auto follow-up: 3 days later, nudge if no reply.
      try {
        const due = new Date(); due.setDate(due.getDate() + 3); due.setHours(10, 0, 0, 0);
        await prisma.task.create({
          data: {
            title: `Follow up on proposal to ${proposal.prospect.name}`,
            description: `Sent ${current.amount} ${current.currency} proposal. If no reply, send a polite nudge.`,
            priority: "MEDIUM",
            status: "TODO",
            dueDate: due,
            parentType: "PROSPECT",
            parentId: current.prospectId,
            parentLabel: proposal.prospect.name,
            ownerId: session.userId,
            ownerName: session.fullName,
            createdById: session.userId,
            createdByName: session.fullName,
          },
        });
      } catch { /* swallow */ }
    }

    if (parsed.data.status === "ACCEPTED") {
      // Move the prospect into NEGOTIATION rather than CLIENT — that flip
      // now happens when the contract is signed.
      await prisma.prospect.update({
        where: { id: current.prospectId },
        data: { proposalStatus: "ACCEPTED", status: "NEGOTIATION" },
      });
      await logProspectActivity({
        prospectId: current.prospectId,
        userId: session.userId,
        userName: session.fullName,
        actionType: "PROPOSAL_ACCEPTED",
        details: `Accepted proposal — ${current.amount} ${current.currency}`,
      });

      // Auto-create a DRAFT Contract carrying over proposal details.
      let createdContract = null;
      try {
        createdContract = await prisma.contract.create({
          data: {
            title: proposal.packageName ?? `Engagement — ${proposal.prospect.name}`,
            proposalId: proposal.id,
            prospectId: current.prospectId,
            amount: current.amount ?? 0,
            currency: current.currency ?? "MAD",
            status: "DRAFT",
            paymentTerms: current.paymentTerms ?? "",
            notes: current.notes ?? "",
            createdById: session.userId,
            createdByName: session.fullName,
          },
        });
        await logProspectActivity({
          prospectId: current.prospectId,
          userId: session.userId,
          userName: session.fullName,
          actionType: "CONTRACT_CREATED",
          details: `${createdContract.title} — DRAFT`,
        });
        // Signature follow-up task.
        const due = new Date(); due.setDate(due.getDate() + 2); due.setHours(11, 0, 0, 0);
        await prisma.task.create({
          data: {
            title: `Send contract to ${proposal.prospect.name}`,
            description: `Proposal accepted. Send the contract for signature and confirm payment terms.`,
            priority: "HIGH",
            status: "TODO",
            dueDate: due,
            parentType: "PROSPECT",
            parentId: current.prospectId,
            parentLabel: proposal.prospect.name,
            ownerId: session.userId,
            ownerName: session.fullName,
            createdById: session.userId,
            createdByName: session.fullName,
          },
        });
      } catch { /* swallow */ }

      notifyTeam(session.userId, {
        type: "conversion",
        title: `Proposal accepted: ${proposal.prospect.name}`,
        body: `${session.fullName} accepted a ${current.amount} ${current.currency} proposal — contract draft created`,
        link: `/admin/prospecting/${current.prospectId}`,
      }).catch(() => {});
    }

    if (parsed.data.status === "REJECTED") {
      await prisma.prospect.update({
        where: { id: current.prospectId },
        data: { proposalStatus: "REJECTED" },
      });
      await logProspectActivity({
        prospectId: current.prospectId,
        userId: session.userId,
        userName: session.fullName,
        actionType: "PROPOSAL_REJECTED",
        details: `Proposal rejected`,
      });
    }

    if (parsed.data.amount) {
      await prisma.prospect.update({
        where: { id: current.prospectId },
        data: { proposalAmount: parsed.data.amount },
      });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 500 });
  }

  return NextResponse.json(proposal);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Only admins can delete proposals" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { id } = await params;
  await prisma.proposal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
