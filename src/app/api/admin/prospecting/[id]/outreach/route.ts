import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "EMAIL", "CALL"] as const;

const VARIANTS = ["A", "B", "C", "D"] as const;

const createSchema = z.object({
  templateId: z.string().nullable().optional(),
  channel: z.enum(CHANNELS).default("WHATSAPP"),
  body: z.string().min(1),
  variantLabel: z.enum(VARIANTS).nullable().optional(),
  tone: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
});

const REPLY_REASONS = [
  "INTERESTED", "MEETING_REQUESTED", "PROPOSAL_REQUESTED",
  "LATER", "NOT_INTERESTED", "HAS_PROVIDER", "TOO_EXPENSIVE", "NO_BUDGET",
] as const;

const patchSchema = z.object({
  messageId: z.string(),
  replied: z.boolean().optional(),
  replyReason: z.enum(REPLY_REASONS).nullable().optional(),
  meetingBooked: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { id } = await params;
  const messages = await prisma.outreachMessage.findMany({
    where: { prospectId: id },
    orderBy: { sentAt: "desc" },
    include: { template: { select: { name: true, key: true } } },
  });
  return NextResponse.json(messages);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  // Resolve template (for templateKey snapshot)
  let templateKey: string | null = null;
  if (parsed.data.templateId) {
    const t = await prisma.outreachTemplate.findUnique({
      where: { id: parsed.data.templateId },
      select: { key: true },
    });
    templateKey = t?.key ?? null;
  }

  const message = await prisma.outreachMessage.create({
    data: {
      prospectId: id,
      templateId: parsed.data.templateId ?? null,
      templateKey,
      channel: parsed.data.channel,
      body: parsed.data.body,
      variantLabel: parsed.data.variantLabel ?? null,
      tone: parsed.data.tone ?? null,
      objective: parsed.data.objective ?? null,
      sentById: session.userId,
      sentByName: session.fullName,
    },
  });

  // Stamp prospect last-action + sentAt if not set
  await prisma.prospect.update({
    where: { id },
    data: {
      sentAt: { set: undefined }, // don't overwrite; this is a no-op signal we just touched the row
      lastActionAt: new Date(),
      lastActionByUserId: session.userId,
      lastActionByName: session.fullName,
    },
  }).catch(() => null);

  // If no initial contact was set, set it now
  const prospect = await prisma.prospect.findUnique({ where: { id }, select: { sentAt: true } });
  if (prospect && !prospect.sentAt) {
    await prisma.prospect.update({ where: { id }, data: { sentAt: new Date() } });
  }

  return NextResponse.json(message, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.replied !== undefined) {
    data.replied = parsed.data.replied;
    data.repliedAt = parsed.data.replied ? new Date() : null;
    if (!parsed.data.replied) data.replyReason = null;
  }
  if (parsed.data.replyReason !== undefined) data.replyReason = parsed.data.replyReason;
  if (parsed.data.meetingBooked !== undefined) data.meetingBooked = parsed.data.meetingBooked;

  const updated = await prisma.outreachMessage.update({
    where: { id: parsed.data.messageId },
    data,
  });
  return NextResponse.json(updated);
}
