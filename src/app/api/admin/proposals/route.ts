import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { logProspectActivity, notifyTeam } from "@/lib/dal";
import { z } from "zod";

const createSchema = z.object({
  prospectId: z.string().min(1),
  contactPerson: z.string().optional().default(""),
  services: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional().default("MAD"),
  timeline: z.string().optional().default(""),
  paymentTerms: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  packageName: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional().default("DRAFT"),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const url = new URL(req.url);
  const prospectId = url.searchParams.get("prospectId");

  const where = prospectId ? { prospectId } : {};
  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { prospect: { select: { id: true, name: true, sector: true, status: true } } },
  });

  return NextResponse.json(proposals);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
  const proposal = await prisma.proposal.create({
    data: {
      ...parsed.data,
      createdById: session.userId,
      createdByName: session.fullName,
    },
    include: { prospect: { select: { id: true, name: true, sector: true } } },
  });

  await prisma.prospect.update({
    where: { id: parsed.data.prospectId },
    data: { proposalAmount: parsed.data.amount, proposalStatus: parsed.data.status },
  });

  await logProspectActivity({
    prospectId: parsed.data.prospectId,
    userId: session.userId,
    userName: session.fullName,
    actionType: "PROPOSAL_CREATED",
    details: `Created ${parsed.data.packageName || "custom"} proposal — ${parsed.data.amount} ${parsed.data.currency}`,
  });

  return NextResponse.json(proposal, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to create proposal" }, { status: 500 });
  }
}
