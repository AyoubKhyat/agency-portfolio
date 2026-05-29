import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProspectById, updateProspectStatus, updateProspect, deleteProspect } from "@/lib/dal";
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({
    status: z.enum(["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"]),
  }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const prospect = await updateProspectStatus(id, parsed.data.status);
  return NextResponse.json(prospect);
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
