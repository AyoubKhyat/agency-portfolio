import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { id } = await params;
  const project = await prisma.clientProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(project);
}

const patchSchema = z.object({
  name: z.string().optional(),
  clientName: z.string().optional(),
  description: z.string().optional(),
  services: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  budget: z.number().optional(),
  amountPaid: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
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

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  else if (parsed.data.startDate === null) data.startDate = null;
  if (parsed.data.dueDate) data.dueDate = new Date(parsed.data.dueDate);
  else if (parsed.data.dueDate === null) data.dueDate = null;
  if (parsed.data.status === "COMPLETED") data.completedAt = new Date();
  if (parsed.data.status === "LIVE") data.progress = 100;

  const project = await prisma.clientProject.update({ where: { id }, data: data as never });

  return NextResponse.json(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { id } = await params;
  await prisma.clientProject.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
