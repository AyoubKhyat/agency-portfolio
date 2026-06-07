import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const patchSchema = z.object({
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  clientAddress: z.string().nullable().optional(),
  items: z.array(lineItemSchema).min(1).optional(),
  taxRate: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(invoice);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;

  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Recalculate totals if items or taxRate changed
  let subtotal = existing.subtotal;
  let taxRate = data.taxRate ?? existing.taxRate;
  let taxAmount = existing.taxAmount;
  let total = existing.total;

  if (data.items) {
    subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    taxAmount = subtotal * (taxRate / 100);
    total = subtotal + taxAmount;
  } else if (data.taxRate !== undefined) {
    taxAmount = subtotal * (taxRate / 100);
    total = subtotal + taxAmount;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      ...(data.clientName !== undefined ? { clientName: data.clientName } : {}),
      ...(data.clientEmail !== undefined ? { clientEmail: data.clientEmail } : {}),
      ...(data.clientPhone !== undefined ? { clientPhone: data.clientPhone } : {}),
      ...(data.clientAddress !== undefined ? { clientAddress: data.clientAddress } : {}),
      ...(data.items ? { items: JSON.stringify(data.items) } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      // Mark paid timestamp
      ...(data.status === "PAID" && !existing.paidAt ? { paidAt: new Date() } : {}),
      subtotal,
      taxRate,
      taxAmount,
      total,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;

  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
