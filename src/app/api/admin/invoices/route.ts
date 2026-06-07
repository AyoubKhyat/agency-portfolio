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

const createSchema = z.object({
  clientName: z.string().min(1, "Client name required"),
  clientEmail: z.string().email().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  clientAddress: z.string().nullable().optional(),
  proposalId: z.string().nullable().optional(),
  items: z.array(lineItemSchema).min(1, "At least one line item required"),
  taxRate: z.number().nonnegative().optional().default(20),
  currency: z.string().optional().default("MAD"),
  status: z.enum(STATUSES).optional().default("DRAFT"),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  if (!hasPrisma()) return `${prefix}001`;

  // Find the latest invoice number for this year
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  if (!latest) return `${prefix}001`;

  const lastNum = parseInt(latest.invoiceNumber.replace(prefix, ""), 10);
  const next = (lastNum + 1).toString().padStart(3, "0");
  return `${prefix}${next}`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ invoices: [], total: 0, pages: 1 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 20;

  const where: Record<string, unknown> = {};
  if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
    where.status = status;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices,
    total,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (data.taxRate / 100);
  const total = subtotal + taxAmount;

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientName: data.clientName,
      clientEmail: data.clientEmail || null,
      clientPhone: data.clientPhone || null,
      clientAddress: data.clientAddress || null,
      proposalId: data.proposalId || null,
      items: JSON.stringify(data.items),
      subtotal,
      taxRate: data.taxRate,
      taxAmount,
      total,
      currency: data.currency ?? "MAD",
      status: data.status ?? "DRAFT",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes || null,
      createdById: session.userId,
      createdByName: session.fullName,
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
