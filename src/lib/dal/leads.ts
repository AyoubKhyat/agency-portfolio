import { db } from "./db";

// ─── Leads ───────────────────────────────────────────────────────

/**
 * Id of a lead with the same email (case-insensitive), the same message and the
 * same selected service (subject), created since `since`, or null. Used to
 * ignore resubmissions of one inquiry.
 */
export async function findRecentDuplicateLead(email: string, message: string, subject: string, since: Date): Promise<string | null> {
  const lead = await db().lead.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, message, subject, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return lead?.id ?? null;
}

export async function createLead(data: {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  assignedToId?: string;
  assignedToName?: string;
}) {
  return db().lead.create({ data });
}

/**
 * Find the active team member (sales or admin) with the fewest assigned leads.
 * Used for round-robin lead auto-assignment.
 */
export async function getLeastLoadedUser() {
  const eligibleUsers = await db().user.findMany({
    where: {
      isActive: true,
      role: { in: ["sales", "admin", "Sales", "Admin"] },
    },
    select: { id: true, fullName: true },
  });

  if (eligibleUsers.length === 0) return null;

  // Count leads assigned to each eligible user
  const counts = await Promise.all(
    eligibleUsers.map(async (user) => {
      const count = await db().lead.count({
        where: { assignedToId: user.id },
      });
      return { user, count };
    })
  );

  // Return the user with the fewest leads
  counts.sort((a, b) => a.count - b.count);
  return counts[0].user;
}

export async function getLeads(page = 1, status?: string) {
  const take = 20;
  const skip = (page - 1) * take;
  const where = status && status !== "ALL" ? { status } : {};

  const [leads, total] = await Promise.all([
    db().lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    db().lead.count({ where }),
  ]);

  return { leads, total, pages: Math.ceil(total / take) };
}

export async function getLeadById(id: string) {
  return db().lead.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  });
}

export async function updateLeadStatus(id: string, status: string) {
  return db().lead.update({ where: { id }, data: { status } });
}

export async function addLeadNote(leadId: string, content: string) {
  return db().leadNote.create({ data: { leadId, content } });
}
