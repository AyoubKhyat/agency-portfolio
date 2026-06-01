import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProspectById, updateProspectStatus, updateProspect, deleteProspect, assignProspectOwner, logProspectActivity, setProspectFirstContact, setProspectSentBy, notifyTeam } from "@/lib/dal";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const prospect = await getProspectById(id);
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(prospect);
}

const patchSchema = z.object({
  status: z.enum(["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "CLIENT", "LOST"]).optional(),
  ownerUserId: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  proposalAmount: z.number().nullable().optional(),
  proposalDate: z.string().nullable().optional(),
  proposalStatus: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).nullable().optional(),
  actionType: z.string().optional(),
  details: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const current = await getProspectById(id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.ownerUserId !== undefined) {
    await assignProspectOwner(id, parsed.data.ownerUserId);
    await logProspectActivity({
      prospectId: id,
      userId: session.userId,
      userName: session.fullName,
      actionType: "ASSIGNED",
      details: parsed.data.ownerUserId
        ? `Assigned prospect`
        : "Unassigned prospect",
    });
  }

  if (parsed.data.followUpDate !== undefined) {
    await updateProspect(id, { followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null });
  }

  if (parsed.data.proposalAmount !== undefined || parsed.data.proposalDate !== undefined || parsed.data.proposalStatus !== undefined) {
    const proposalData: Record<string, unknown> = {};
    if (parsed.data.proposalAmount !== undefined) proposalData.proposalAmount = parsed.data.proposalAmount;
    if (parsed.data.proposalDate !== undefined) proposalData.proposalDate = parsed.data.proposalDate ? new Date(parsed.data.proposalDate) : null;
    if (parsed.data.proposalStatus !== undefined) proposalData.proposalStatus = parsed.data.proposalStatus;
    await updateProspect(id, proposalData);
  }

  if (parsed.data.status) {
    const previousStatus = current.status;
    const prospect = await updateProspectStatus(id, parsed.data.status);

    const actionType = parsed.data.actionType || `STATUS_${parsed.data.status}`;

    if (parsed.data.status === "ENVOYE") {
      if (!current.ownerUserId) {
        await assignProspectOwner(id, session.userId);
      }
      await setProspectSentBy(id, session.userId, session.fullName);
      await setProspectFirstContact(id, session.userId, session.fullName);
    }

    if (parsed.data.status === "REPONDU") {
      await setProspectFirstContact(id, session.userId, session.fullName);
    }

    await logProspectActivity({
      prospectId: id,
      userId: session.userId,
      userName: session.fullName,
      actionType,
      previousStatus,
      newStatus: parsed.data.status,
      details: parsed.data.details,
    });

    if (parsed.data.status === "REPONDU") {
      notifyTeam(session.userId, { type: "reply", title: `${current.name} replied`, body: `${session.fullName} got a reply from ${current.name}`, link: `/admin/prospecting/${id}` }).catch(() => {});
    }
    if (parsed.data.status === "CONVERTI" || parsed.data.status === "CLIENT") {
      notifyTeam(session.userId, { type: "conversion", title: `${current.name} converted`, body: `${session.fullName} converted ${current.name}`, link: `/admin/prospecting/${id}` }).catch(() => {});
    }

    const updated = await getProspectById(id);

    if (parsed.data.status === "ENVOYE" && !current.followUpDate) {
      const suggestedDate = new Date(Date.now() + 3 * 86400000);
      return NextResponse.json({ ...updated, suggestedFollowUp: suggestedDate.toISOString() });
    }
    if (parsed.data.status === "REPONDU" && !current.followUpDate) {
      const suggestedDate = new Date(Date.now() + 86400000);
      return NextResponse.json({ ...updated, suggestedFollowUp: suggestedDate.toISOString() });
    }

    return NextResponse.json(updated);
  }

  const updated = await getProspectById(id);
  return NextResponse.json(updated);
}

const updateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  whatsappLink: z.string().optional(),
  sector: z.string().min(1),
  neighborhood: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  hasWebsite: z.boolean().optional().default(false),
  priority: z.number().int().min(1).max(3).optional().default(2),
  status: z.string().optional(),
  ownerUserId: z.string().nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const errors = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${v?.join(", ")}`);
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const phone = parsed.data.phone.replace(/\D/g, "");
  const whatsappLink = parsed.data.whatsappLink || `https://wa.me/${phone}`;

  const prospect = await updateProspect(id, { ...parsed.data, whatsappLink });

  await logProspectActivity({
    prospectId: id,
    userId: session.userId,
    userName: session.fullName,
    actionType: "UPDATED",
    details: "Updated prospect details",
  });

  return NextResponse.json(prospect);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Only admins can delete prospects" }, { status: 403 });

  const { id } = await params;
  await deleteProspect(id);
  return NextResponse.json({ success: true });
}
