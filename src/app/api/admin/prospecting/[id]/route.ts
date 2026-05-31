import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProspectById, updateProspectStatus, updateProspect, deleteProspect, assignProspectOwner, logProspectActivity, setProspectFirstContact, setProspectSentBy } from "@/lib/dal";
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
  status: z.enum(["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"]).optional(),
  ownerUserId: z.string().nullable().optional(),
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

  if (parsed.data.status) {
    const previousStatus = current.status;
    const prospect = await updateProspectStatus(id, parsed.data.status);

    const actionType = parsed.data.actionType || `STATUS_${parsed.data.status}`;

    await logProspectActivity({
      prospectId: id,
      userId: session.userId,
      userName: session.fullName,
      actionType,
      previousStatus,
      newStatus: parsed.data.status,
      details: parsed.data.details,
    });

    if (parsed.data.status === "ENVOYE" || parsed.data.status === "REPONDU") {
      await setProspectFirstContact(id, session.userId, session.fullName);
    }

    if (parsed.data.status === "ENVOYE") {
      await setProspectSentBy(id, session.userId, session.fullName);
    }

    return NextResponse.json(prospect);
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

  const { id } = await params;
  await deleteProspect(id);
  return NextResponse.json({ success: true });
}
