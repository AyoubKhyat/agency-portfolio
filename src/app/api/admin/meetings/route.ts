import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const TYPES = ["CALL", "GOOGLE_MEET", "ZOOM", "WHATSAPP", "IN_PERSON"] as const;
const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const createSchema = z.object({
  title: z.string().min(1, "Title required"),
  clientId: z.string().nullable().optional(),
  prospectId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  type: z.enum(TYPES).optional().default("CALL"),
  status: z.enum(STATUSES).optional().default("SCHEDULED"),
  startAt: z.string(),  // ISO
  endAt: z.string().nullable().optional(),
  notes: z.string().optional().default(""),
});

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // today | tomorrow | week | month | upcoming | past | missed | all
  const ownerId = searchParams.get("ownerId");
  const clientId = searchParams.get("clientId");
  const prospectId = searchParams.get("prospectId");
  const status = searchParams.get("status");
  const from = searchParams.get("from"); // ISO date string — calendar range start
  const to = searchParams.get("to");     // ISO date string — calendar range end
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

  const now = new Date();
  const where: Record<string, unknown> = {};

  if (ownerId) where.ownerId = ownerId;
  if (clientId) where.clientId = clientId;
  if (prospectId) where.prospectId = prospectId;
  if (status && STATUSES.includes(status as typeof STATUSES[number])) where.status = status;

  // Arbitrary date range (used by calendar view)
  if (from && to) {
    where.startAt = { gte: new Date(from), lte: new Date(to) };
  } else if (scope === "mine") {
    where.ownerId = session.userId;
  } else if (scope === "today") {
    where.startAt = { gte: startOfDay(now), lte: endOfDay(now) };
  } else if (scope === "tomorrow") {
    const t = addDays(now, 1);
    where.startAt = { gte: startOfDay(t), lte: endOfDay(t) };
  } else if (scope === "week") {
    where.startAt = { gte: startOfDay(now), lt: addDays(startOfDay(now), 7) };
  } else if (scope === "month") {
    where.startAt = { gte: startOfDay(now), lt: addDays(startOfDay(now), 31) };
  } else if (scope === "upcoming") {
    where.startAt = { gte: now };
    where.status = { in: ["SCHEDULED"] };
  } else if (scope === "past") {
    where.startAt = { lt: now };
  } else if (scope === "missed") {
    where.startAt = { lt: now };
    where.status = { in: ["SCHEDULED", "NO_SHOW"] };
  }

  const meetings = await prisma.meeting.findMany({
    where,
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true, sector: true } },
      owner:    { select: { id: true, fullName: true, avatarInitials: true } },
    },
    orderBy: [
      { startAt: scope === "past" || scope === "missed" ? "desc" : "asc" },
    ],
    take: limit,
  });

  return NextResponse.json(meetings);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return NextResponse.json({ error: Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") }, { status: 400 });
  }
  const data = parsed.data;

  if (!data.clientId && !data.prospectId) {
    return NextResponse.json({ error: "Meeting must be linked to a client or a prospect" }, { status: 400 });
  }

  let ownerName: string | null = null;
  if (data.ownerId) {
    const u = await prisma.user.findUnique({ where: { id: data.ownerId }, select: { fullName: true } });
    ownerName = u?.fullName ?? null;
  }

  const startAt = new Date(data.startAt);
  const endAt = data.endAt ? new Date(data.endAt) : null;

  const meeting = await prisma.meeting.create({
    data: {
      title: data.title,
      clientId: data.clientId || null,
      prospectId: data.prospectId || null,
      ownerId: data.ownerId || session.userId,
      ownerName: ownerName ?? session.fullName,
      type: data.type ?? "CALL",
      status: data.status ?? "SCHEDULED",
      startAt,
      endAt,
      notes: data.notes ?? "",
      createdById: session.userId,
    },
    include: {
      client:   { select: { id: true, companyName: true } },
      prospect: { select: { id: true, name: true } },
      owner:    { select: { id: true, fullName: true, avatarInitials: true } },
    },
  });

  // Activity logging on the linked entity.
  try {
    if (meeting.clientId) {
      await prisma.clientActivity.create({
        data: {
          clientId: meeting.clientId,
          userId: session.userId,
          userName: session.fullName,
          actionType: "MEETING_SCHEDULED",
          details: `${meeting.title} — ${startAt.toLocaleString("fr-FR")}`,
        },
      });
    } else if (meeting.prospectId) {
      await prisma.prospectActivity.create({
        data: {
          prospectId: meeting.prospectId,
          userId: session.userId,
          userName: session.fullName,
          actionType: "MEETING_SCHEDULED",
          details: `${meeting.title} — ${startAt.toLocaleString("fr-FR")}`,
        },
      });
      // Advance the prospect along the funnel.
      const p = await prisma.prospect.findUnique({ where: { id: meeting.prospectId }, select: { status: true } });
      if (p && ["A_ENVOYER", "ENVOYE", "REPONDU"].includes(p.status)) {
        await prisma.prospect.update({ where: { id: meeting.prospectId }, data: { status: "MEETING" } });
      }
    }
  } catch { /* swallow */ }

  // Notify the owner (if different from creator).
  if (meeting.ownerId && meeting.ownerId !== session.userId) {
    notifyUser(meeting.ownerId, {
      type: "MEETING_SCHEDULED",
      title: `${session.fullName} scheduled a meeting with you`,
      body: `${meeting.title} — ${startAt.toLocaleString("fr-FR")}`,
      link: meeting.clientId ? `/admin/clients/${meeting.clientId}` : `/admin/prospecting/${meeting.prospectId}`,
    }).catch(() => {});
  }

  // Auto-create a prep task due the day before.
  try {
    const prepDue = new Date(startAt);
    prepDue.setDate(prepDue.getDate() - 1);
    prepDue.setHours(17, 0, 0, 0);
    const label = meeting.client?.companyName ?? meeting.prospect?.name ?? "meeting";
    const parentType = meeting.clientId ? "CLIENT" : "PROSPECT";
    const parentId = meeting.clientId ?? meeting.prospectId;
    await prisma.task.create({
      data: {
        title: `Prepare for: ${meeting.title}`,
        description: `Review history, set agenda, and prep questions for the ${meeting.type.toLowerCase().replace("_", " ")} with ${label}.`,
        priority: "MEDIUM",
        status: "TODO",
        dueDate: prepDue,
        parentType,
        parentId,
        parentLabel: label,
        ownerId: meeting.ownerId,
        ownerName: meeting.ownerName,
        createdById: session.userId,
        createdByName: session.fullName,
      },
    });
  } catch { /* swallow */ }

  return NextResponse.json(meeting, { status: 201 });
}
