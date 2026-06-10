import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "EMAIL", "CALL"] as const;
const LANGS = ["fr", "en", "ar"] as const;

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(CHANNELS).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
  language: z.enum(LANGS).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.outreachTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  await prisma.outreachTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
