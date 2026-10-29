import { bulkUpdateStatusWith, updateProspectStatusWith } from "../prospect-first-contact";
import { statusWhere, channelWhere, evidenceWhere, sendRecordInclude, latestSendAt } from "../prospect-stages";
import { db } from "./db";

// ─── Prospecting ────────────────────────────────────────────────

export async function getProspects(page = 1, status?: string, sector?: string, ownerUserId?: string, search?: string, qualityLabel?: string, segment?: string, due?: string, channel?: string, evidence?: string) {
  const take = 20;
  const skip = (page - 1) * take;
  const where: Record<string, unknown> = {};
  // One status keeps the old exact match; a comma list (a simple stage) becomes status IN (...).
  const statusFilter = statusWhere(status);
  if (statusFilter) where.status = statusFilter;
  if (sector && sector !== "ALL") where.sector = sector;
  if (qualityLabel && qualityLabel !== "ALL") where.qualityLabel = qualityLabel;
  if (segment && segment !== "ALL") where.segment = segment;
  if (ownerUserId === "UNASSIGNED") {
    where.ownerUserId = null;
  } else if (ownerUserId && ownerUserId !== "ALL") {
    where.ownerUserId = ownerUserId;
  }
  // Workflow filter: due=today | due=overdue override any explicit status filter
  // to enforce the "active follow-ups only" semantics (excludes won/lost/converted).
  const isDueFilter = due === "today" || due === "overdue";
  if (isDueFilter) {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    if (due === "today") {
      const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
      where.followUpDate = { gte: startOfToday, lte: endOfToday };
    } else {
      where.followUpDate = { lt: startOfToday };
    }
    where.status = { notIn: ["CONVERTI", "CLIENT", "LOST"] };
  }
  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { instagram: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { neighborhood: { contains: search, mode: "insensitive" } },
    ];
  }
  // Channel / send-evidence filters go under AND so they never collide with the search OR.
  const andFilters = [channelWhere(channel), evidenceWhere(evidence)].filter(Boolean);
  if (andFilters.length) where.AND = andFilters;

  // Follow-up views sort oldest-first so the most urgent row rises to the top;
  // every other view keeps the default newest-first order.
  const orderBy = isDueFilter
    ? ({ followUpDate: "asc" } as const)
    : ({ createdAt: "desc" } as const);

  const [prospects, total] = await Promise.all([
    db().prospect.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        notes: { orderBy: { createdAt: "desc" }, take: 1 },
        owner: { select: { id: true, fullName: true, avatarInitials: true } },
        sentByUser: { select: { id: true, fullName: true, avatarInitials: true } },
        ...sendRecordInclude(),
      },
    }),
    db().prospect.count({ where }),
  ]);

  // Reduce the send-record includes to one date; the list shows evidence, not message bodies.
  const rows = prospects.map(({ outreachMessages, activities, ...p }) => ({
    ...p,
    lastSendAt: latestSendAt([outreachMessages[0]?.sentAt, activities[0]?.createdAt]),
  }));

  return { prospects: rows, total, pages: Math.ceil(total / take) };
}

export async function getProspectById(id: string) {
  return db().prospect.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
      sentByUser: { select: { id: true, fullName: true, avatarInitials: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
}

export async function findDuplicateProspect(phone: string, instagram?: string) {
  const digits = phone.replace(/\D/g, "");
  const conditions: Record<string, unknown>[] = [];

  // Match on last 8 digits of phone number to handle different country code formats
  if (digits.length >= 6) {
    conditions.push({ phone: { contains: digits.slice(-8) } });
  }

  // Match on Instagram handle (case-insensitive, strip leading @)
  if (instagram && instagram.trim().length >= 2) {
    const handle = instagram.replace(/^@/, "").trim();
    conditions.push({ instagram: { equals: handle, mode: "insensitive" } });
  }

  if (conditions.length === 0) return null;

  return db().prospect.findFirst({
    where: { OR: conditions },
    select: { id: true, name: true, phone: true, instagram: true, status: true },
  });
}

export async function createProspect(data: {
  name: string;
  phone: string;
  whatsappLink?: string;
  sector: string;
  neighborhood?: string;
  instagram?: string;
  hasWebsite?: boolean;
  priority?: number;
  status?: string;
  sentAt?: Date | null;
  ownerUserId?: string;
}) {
  // Never derive WhatsApp from the phone. Only an explicitly supplied link is
  // stored, and it stays UNVERIFIED (schema default) until manually confirmed.
  const whatsappLink = data.whatsappLink || "";
  return db().prospect.create({
    data: {
      name: data.name,
      phone: data.phone,
      whatsappLink,
      sector: data.sector,
      neighborhood: data.neighborhood ?? "",
      instagram: data.instagram ?? "",
      hasWebsite: data.hasWebsite ?? false,
      priority: data.priority ?? 2,
      status: data.status ?? "A_ENVOYER",
      sentAt: data.sentAt ?? null,
      ownerUserId: data.ownerUserId ?? null,
    },
  });
}

export async function updateProspect(id: string, data: Record<string, unknown>) {
  return db().prospect.update({ where: { id }, data });
}

export async function deleteProspect(id: string) {
  return db().prospect.delete({ where: { id } });
}

export async function updateProspectStatus(id: string, status: string) {
  // `sentAt` is the FIRST-contact anchor for the whole follow-up cadence
  // (day 4 / 10 / 20) — see @/lib/prospect-first-contact for why it must
  // never move once set.
  return updateProspectStatusWith(db(), id, status);
}

export async function assignProspectOwner(id: string, ownerUserId: string | null) {
  return db().prospect.update({
    where: { id },
    data: { ownerUserId },
  });
}

export async function bulkAssignOwner(prospectIds: string[], ownerUserId: string | null) {
  return db().prospect.updateMany({
    where: { id: { in: prospectIds } },
    data: { ownerUserId },
  });
}

export async function addProspectNote(prospectId: string, content: string, authorId?: string, authorName?: string) {
  return db().prospectNote.create({ data: { prospectId, content, authorId: authorId ?? null, authorName: authorName ?? null } });
}

// ─── Prospect Activities ────────────────────────────────────────

export async function logProspectActivity(data: {
  prospectId: string;
  userId: string;
  userName: string;
  actionType: string;
  previousStatus?: string;
  newStatus?: string;
  details?: string;
}) {
  const [activity] = await db().$transaction([
    db().prospectActivity.create({ data }),
    db().prospect.update({
      where: { id: data.prospectId },
      data: {
        lastActionByUserId: data.userId,
        lastActionByName: data.userName,
        lastActionAt: new Date(),
      },
    }),
  ]);

  return activity;
}

export async function setProspectSentBy(prospectId: string, userId: string, userName: string) {
  await db().prospect.update({
    where: { id: prospectId },
    data: { sentByUserId: userId, sentByName: userName },
  });
}

export async function bulkUpdateStatus(prospectIds: string[], status: string) {
  // Previously this set `sentAt: new Date()` unconditionally, which reset the
  // first-contact anchor on every already-contacted prospect in the selection
  // and silently re-queued them for initial outreach. It now only stamps rows
  // where the anchor is still null.
  return bulkUpdateStatusWith(db(), prospectIds, status);
}

export async function setProspectFirstContact(prospectId: string, userId: string, userName: string) {
  await db().prospect.updateMany({
    where: { id: prospectId, contactedByUserId: null },
    data: {
      contactedByUserId: userId,
      contactedByName: userName,
      contactedAt: new Date(),
    },
  });
}

export async function getProspectActivities(prospectId: string) {
  return db().prospectActivity.findMany({
    where: { prospectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecentActivities(limit = 50, userId?: string) {
  const where = userId ? { userId } : {};
  return db().prospectActivity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      prospect: { select: { id: true, name: true, sector: true } },
    },
  });
}
