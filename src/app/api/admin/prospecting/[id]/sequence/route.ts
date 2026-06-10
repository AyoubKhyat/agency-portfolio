import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const STEPS = ["initial", "followup1", "followup2", "followup3"] as const;

const patchSchema = z.object({
  step: z.enum(STEPS),
  done: z.boolean(),
});

const FIELD_MAP: Record<typeof STEPS[number], "sentAt" | "followup1At" | "followup2At" | "followup3At"> = {
  initial: "sentAt",
  followup1: "followup1At",
  followup2: "followup2At",
  followup3: "followup3At",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const p = await prisma.prospect.findUnique({
    where: { id },
    select: { sentAt: true, followup1At: true, followup2At: true, followup3At: true },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    initial: { done: !!p.sentAt, at: p.sentAt },
    followup1: { done: !!p.followup1At, at: p.followup1At },
    followup2: { done: !!p.followup2At, at: p.followup2At },
    followup3: { done: !!p.followup3At, at: p.followup3At },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const field = FIELD_MAP[parsed.data.step];
  const updated = await prisma.prospect.update({
    where: { id },
    data: {
      [field]: parsed.data.done ? new Date() : null,
      lastActionAt: new Date(),
      lastActionByUserId: session.userId,
      lastActionByName: session.fullName,
    },
    select: { sentAt: true, followup1At: true, followup2At: true, followup3At: true },
  });

  return NextResponse.json({
    initial: { done: !!updated.sentAt, at: updated.sentAt },
    followup1: { done: !!updated.followup1At, at: updated.followup1At },
    followup2: { done: !!updated.followup2At, at: updated.followup2At },
    followup3: { done: !!updated.followup3At, at: updated.followup3At },
  });
}
