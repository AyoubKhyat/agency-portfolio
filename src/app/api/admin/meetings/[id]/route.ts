import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const TYPES = ["CALL", "GOOGLE_MEET", "ZOOM", "WHATSAPP", "IN_PERSON"] as const;
const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const patchSchema = z.object({
  title:      z.string().min(1).optional(),
  type:       z.enum(TYPES).optional(),
  status:     z.enum(STATUSES).optional(),
  startAt:    z.string().optional(),
  endAt:      z.string().nullable().optional(),
  notes:      z.string().optional(),
  outcome:    z.string().optional(),
  nextAction: z.string().optional(),
  ownerId:    z.string().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true, sector: true } },
      owner:    { select: { id: true, fullName: true, avatarInitials: true } },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const data = parsed.data;

  const before = await prisma.meeting.findUnique({
    where: { id },
    include: { client: { select: { id: true, companyName: true } }, prospect: { select: { id: true, name: true } } },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let ownerName: string | null | undefined = undefined;
  if (data.ownerId !== undefined) {
    if (data.ownerId) {
      const u = await prisma.user.findUnique({ where: { id: data.ownerId }, select: { fullName: true } });
      ownerName = u?.fullName ?? null;
    } else {
      ownerName = null;
    }
  }

  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      ...(data.title      !== undefined ? { title:      data.title }      : {}),
      ...(data.type       !== undefined ? { type:       data.type }       : {}),
      ...(data.status     !== undefined ? { status:     data.status }     : {}),
      ...(data.startAt    !== undefined ? { startAt:    new Date(data.startAt) } : {}),
      ...(data.endAt      !== undefined ? { endAt:      data.endAt ? new Date(data.endAt) : null } : {}),
      ...(data.notes      !== undefined ? { notes:      data.notes }      : {}),
      ...(data.outcome    !== undefined ? { outcome:    data.outcome }    : {}),
      ...(data.nextAction !== undefined ? { nextAction: data.nextAction } : {}),
      ...(data.ownerId    !== undefined ? { ownerId:    data.ownerId || null } : {}),
      ...(ownerName       !== undefined ? { ownerName }                   : {}),
    },
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true } },
      owner:    { select: { id: true, fullName: true, avatarInitials: true } },
    },
  });

  const justCompleted = data.status === "COMPLETED" && before.status !== "COMPLETED";
  const justCancelled = data.status && data.status !== before.status && (data.status === "CANCELLED" || data.status === "NO_SHOW");
  const ownerReassigned = data.ownerId !== undefined && meeting.ownerId && meeting.ownerId !== before.ownerId && meeting.ownerId !== session.userId;

  try {
    // Activity log on status transitions.
    const actionType =
      justCompleted ? "MEETING_COMPLETED" :
      justCancelled ? `MEETING_${data.status}` :
      null;

    if (actionType) {
      if (meeting.clientId) {
        await prisma.clientActivity.create({
          data: {
            clientId: meeting.clientId,
            userId: session.userId,
            userName: session.fullName,
            actionType,
            details: meeting.title + (meeting.outcome ? ` — ${meeting.outcome.slice(0, 120)}` : ""),
          },
        });
      } else if (meeting.prospectId) {
        await prisma.prospectActivity.create({
          data: {
            prospectId: meeting.prospectId,
            userId: session.userId,
            userName: session.fullName,
            actionType,
            details: meeting.title + (meeting.outcome ? ` — ${meeting.outcome.slice(0, 120)}` : ""),
          },
        });
      }
    }

    // Auto follow-up task on completion (only if not already created).
    if (justCompleted && meeting.nextAction) {
      const followUpDue = new Date();
      followUpDue.setDate(followUpDue.getDate() + 3);
      followUpDue.setHours(10, 0, 0, 0);
      const label = meeting.client?.companyName ?? meeting.prospect?.name ?? "meeting";
      const parentType = meeting.clientId ? "CLIENT" : "PROSPECT";
      const parentId = meeting.clientId ?? meeting.prospectId;
      await prisma.task.create({
        data: {
          title: meeting.nextAction.slice(0, 120),
          description: `Follow-up from meeting "${meeting.title}" on ${meeting.startAt.toLocaleDateString("fr-FR")}.`,
          priority: "HIGH",
          status: "TODO",
          dueDate: followUpDue,
          parentType,
          parentId,
          parentLabel: label,
          ownerId: meeting.ownerId,
          ownerName: meeting.ownerName,
          createdById: session.userId,
          createdByName: session.fullName,
        },
      });
    }
  } catch { /* swallow */ }

  if (ownerReassigned) {
    notifyUser(meeting.ownerId!, {
      type: "MEETING_REASSIGNED",
      title: `${session.fullName} assigned you a meeting`,
      body: `${meeting.title} — ${meeting.startAt.toLocaleString("fr-FR")}`,
      link: meeting.clientId ? `/admin/clients/${meeting.clientId}` : `/admin/prospecting/${meeting.prospectId}`,
    }).catch(() => {});
  }

  return NextResponse.json(meeting);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { id } = await params;
  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
