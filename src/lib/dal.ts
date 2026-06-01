import { prisma, hasPrisma } from "./prisma";
import { FALLBACK_PROJECTS, FALLBACK_SLUGS } from "./fallback-projects";
import { getTranslations } from "next-intl/server";
import { hashPassword } from "./auth";

function db() {
  if (!hasPrisma()) throw new Error("Database not available");
  return prisma;
}

// ─── Projects ────────────────────────────────────────────────────

async function getFallbackProjects(locale: string) {
  let t: Awaited<ReturnType<typeof getTranslations>>;
  try {
    t = await getTranslations({ locale, namespace: "Portfolio" });
  } catch {
    return FALLBACK_PROJECTS.map((p) => ({
      ...p, title: p.slug, desc: "", tags: "",
    }));
  }

  const keyMap: Record<string, string> = {
    "hammam-nour": "project11",
    goudoukh: "project9",
    tannour: "project10",
    terrene: "project7",
    "victory-path": "project8",
    "aylani-parfums": "project12",
    "luxury-copro": "project13",
  };

  return FALLBACK_PROJECTS.map((p) => {
    const key = keyMap[p.slug] ?? p.slug;
    return {
      ...p,
      title: safeT(t, `${key}_title`) ?? p.slug,
      desc: safeT(t, `${key}_desc`) ?? "",
      tags: safeT(t, `${key}_tags`) ?? "",
    };
  });
}

function safeT(t: (key: string) => string, key: string): string | null {
  try { return t(key); } catch { return null; }
}

export async function getVisibleProjects(locale: string) {
  if (!hasPrisma()) return getFallbackProjects(locale);
  const projects = await prisma.project.findMany({
    where: { visible: true },
    orderBy: { sortOrder: "asc" },
    include: {
      translations: { where: { locale } },
    },
  });

  if (projects.length === 0) return getFallbackProjects(locale);

  return projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    category: p.category,
    url: p.url,
    image: p.image,
    tag: p.tag,
    sortOrder: p.sortOrder,
    title: p.translations[0]?.title ?? p.slug,
    desc: p.translations[0]?.desc ?? "",
    tags: p.translations[0]?.tags ?? "",
  }));
}

export async function getProjectBySlug(slug: string, locale: string) {
  if (!hasPrisma()) return getFallbackSlug(slug, locale);
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      translations: { where: { locale } },
    },
  });

  if (!project || !project.visible) return getFallbackSlug(slug, locale);

  const t = project.translations[0];
  return { ...project, translation: t ?? null };
}

async function getFallbackSlug(slug: string, locale: string) {
  const fp = FALLBACK_PROJECTS.find((p) => p.slug === slug);
  if (!fp) return null;

  let cs: Awaited<ReturnType<typeof getTranslations>>;
  try {
    cs = await getTranslations({ locale, namespace: "CaseStudy" });
  } catch { return null; }

  const s = (key: string) => safeT(cs, key) ?? "";

  return {
    ...fp,
    visible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    translation: {
      id: fp.id,
      projectId: fp.id,
      locale,
      title: s(`${slug}_title`) || fp.slug,
      desc: s(`${slug}_meta_desc`),
      tags: "",
      tagline: s(`${slug}_tagline`),
      metaDesc: s(`${slug}_meta_desc`),
      client: s(`${slug}_client`),
      industry: s(`${slug}_industry`),
      challenge: s(`${slug}_challenge`),
      solution: s(`${slug}_solution`),
      step1Title: s(`${slug}_step1_title`),
      step1Desc: s(`${slug}_step1_desc`),
      step2Title: s(`${slug}_step2_title`),
      step2Desc: s(`${slug}_step2_desc`),
      step3Title: s(`${slug}_step3_title`),
      step3Desc: s(`${slug}_step3_desc`),
      features: s(`${slug}_features`),
      tech: s(`${slug}_tech`),
      result1Value: s(`${slug}_result1_value`),
      result1Label: s(`${slug}_result1_label`),
      result2Value: s(`${slug}_result2_value`),
      result2Label: s(`${slug}_result2_label`),
      result3Value: s(`${slug}_result3_value`),
      result3Label: s(`${slug}_result3_label`),
    },
  };
}

export async function getAllProjectSlugs() {
  if (!hasPrisma()) return FALLBACK_SLUGS;
  try {
    const projects = await prisma.project.findMany({
      where: { visible: true },
      select: { slug: true },
      orderBy: { sortOrder: "asc" },
    });
    return projects.length > 0 ? projects.map((p) => p.slug) : FALLBACK_SLUGS;
  } catch {
    return FALLBACK_SLUGS;
  }
}

export async function getProjectsForAdmin() {
  return db().project.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      translations: { where: { locale: "fr" } },
    },
  });
}

export async function getProjectByIdForAdmin(id: string) {
  return db().project.findUnique({
    where: { id },
    include: { translations: true },
  });
}

export type ProjectInput = {
  slug: string;
  category: string;
  url: string;
  image: string;
  tag: string;
  visible?: boolean;
  translations: {
    locale: string;
    title: string;
    desc: string;
    tags: string;
    tagline?: string;
    metaDesc?: string;
    client?: string;
    industry?: string;
    challenge?: string;
    solution?: string;
    step1Title?: string;
    step1Desc?: string;
    step2Title?: string;
    step2Desc?: string;
    step3Title?: string;
    step3Desc?: string;
    features?: string;
    tech?: string;
    result1Value?: string;
    result1Label?: string;
    result2Value?: string;
    result2Label?: string;
    result3Value?: string;
    result3Label?: string;
  }[];
};

export async function createProject(data: ProjectInput) {
  const maxOrder = await db().project.aggregate({ _max: { sortOrder: true } });
  return db().project.create({
    data: {
      slug: data.slug,
      category: data.category,
      url: data.url,
      image: data.image,
      tag: data.tag,
      visible: data.visible ?? true,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      translations: {
        create: data.translations,
      },
    },
    include: { translations: true },
  });
}

export async function updateProject(id: string, data: ProjectInput) {
  await db().projectTranslation.deleteMany({ where: { projectId: id } });

  return db().project.update({
    where: { id },
    data: {
      slug: data.slug,
      category: data.category,
      url: data.url,
      image: data.image,
      tag: data.tag,
      visible: data.visible,
      translations: {
        create: data.translations,
      },
    },
    include: { translations: true },
  });
}

export async function deleteProject(id: string) {
  return db().project.delete({ where: { id } });
}

export async function toggleProjectVisibility(id: string) {
  const project = await db().project.findUnique({ where: { id } });
  if (!project) return null;
  return db().project.update({
    where: { id },
    data: { visible: !project.visible },
  });
}

export async function reorderProjects(orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    db().project.update({ where: { id }, data: { sortOrder: index } })
  );
  return db().$transaction(updates);
}

// ─── Leads ───────────────────────────────────────────────────────

export async function createLead(data: {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  return db().lead.create({ data });
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

// ─── Users ──────────────────────────────────────────────────────

export async function getUsers() {
  return db().user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarInitials: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getUserById(id: string) {
  return db().user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarInitials: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function createUser(data: {
  fullName: string;
  email: string;
  password: string;
  role: string;
  avatarInitials: string;
}) {
  const passwordHash = await hashPassword(data.password);
  return db().user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      role: data.role,
      avatarInitials: data.avatarInitials,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarInitials: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateUser(id: string, data: {
  fullName?: string;
  email?: string;
  role?: string;
  avatarInitials?: string;
  isActive?: boolean;
  password?: string;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.avatarInitials !== undefined) updateData.avatarInitials = data.avatarInitials;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password) updateData.passwordHash = await hashPassword(data.password);

  return db().user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarInitials: true,
      isActive: true,
      createdAt: true,
    },
  });
}

// ─── Prospecting ────────────────────────────────────────────────

export async function getProspects(page = 1, status?: string, sector?: string, ownerUserId?: string, search?: string) {
  const take = 20;
  const skip = (page - 1) * take;
  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") where.status = status;
  if (sector && sector !== "ALL") where.sector = sector;
  if (ownerUserId === "UNASSIGNED") {
    where.ownerUserId = null;
  } else if (ownerUserId && ownerUserId !== "ALL") {
    where.ownerUserId = ownerUserId;
  }
  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { instagram: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { neighborhood: { contains: search, mode: "insensitive" } },
    ];
  }

  const [prospects, total] = await Promise.all([
    db().prospect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        notes: { orderBy: { createdAt: "desc" }, take: 1 },
        owner: { select: { id: true, fullName: true, avatarInitials: true } },
        sentByUser: { select: { id: true, fullName: true, avatarInitials: true } },
      },
    }),
    db().prospect.count({ where }),
  ]);

  return { prospects, total, pages: Math.ceil(total / take) };
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
  const phone = data.phone.replace(/\D/g, "");
  const whatsappLink = data.whatsappLink || `https://wa.me/${phone}`;
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
  const data: Record<string, unknown> = { status };
  if (status === "ENVOYE") data.sentAt = new Date();
  return db().prospect.update({ where: { id }, data });
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
  const activity = await db().prospectActivity.create({ data });

  await db().prospect.update({
    where: { id: data.prospectId },
    data: {
      lastActionByUserId: data.userId,
      lastActionByName: data.userName,
      lastActionAt: new Date(),
    },
  });

  return activity;
}

export async function setProspectSentBy(prospectId: string, userId: string, userName: string) {
  await db().prospect.update({
    where: { id: prospectId },
    data: { sentByUserId: userId, sentByName: userName, sentAt: new Date() },
  });
}

export async function bulkUpdateStatus(prospectIds: string[], status: string) {
  const data: Record<string, unknown> = { status };
  if (status === "ENVOYE") data.sentAt = new Date();
  return db().prospect.updateMany({
    where: { id: { in: prospectIds } },
    data,
  });
}

export async function setProspectFirstContact(prospectId: string, userId: string, userName: string) {
  const prospect = await db().prospect.findUnique({ where: { id: prospectId } });
  if (prospect && !prospect.contactedByUserId) {
    await db().prospect.update({
      where: { id: prospectId },
      data: {
        contactedByUserId: userId,
        contactedByName: userName,
        contactedAt: new Date(),
      },
    });
  }
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

// ─── Team Stats ─────────────────────────────────────────────────

export async function getTeamStats() {
  const users = await db().user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, avatarInitials: true, role: true },
  });

  const stats = await Promise.all(
    users.map(async (user) => {
      const [assigned, sent, contacted, replied, converted] = await Promise.all([
        db().prospect.count({ where: { ownerUserId: user.id } }),
        db().prospect.count({ where: { sentByUserId: user.id } }),
        db().prospect.count({ where: { contactedByUserId: user.id } }),
        db().prospect.count({ where: { contactedByUserId: user.id, status: "REPONDU" } }),
        db().prospect.count({ where: { contactedByUserId: user.id, status: "CONVERTI" } }),
      ]);

      const lastActivity = await db().prospectActivity.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, actionType: true },
      });

      return {
        user,
        assigned,
        sent,
        contacted,
        replied,
        converted,
        replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
        conversionRate: contacted > 0 ? Math.round((converted / contacted) * 100) : 0,
        lastActivity: lastActivity?.createdAt ?? null,
        lastActionType: lastActivity?.actionType ?? null,
      };
    })
  );

  return stats;
}

// ─── Stats ───────────────────────────────────────────────────────

export async function getAdminStats() {
  const [totalProjects, visibleProjects, totalLeads, newLeads, totalProspects, pendingProspects] =
    await Promise.all([
      db().project.count(),
      db().project.count({ where: { visible: true } }),
      db().lead.count(),
      db().lead.count({ where: { status: "NEW" } }),
      db().prospect.count(),
      db().prospect.count({ where: { status: "A_ENVOYER" } }),
    ]);

  return { totalProjects, visibleProjects, totalLeads, newLeads, totalProspects, pendingProspects };
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const weekFromNow = new Date(todayStart.getTime() + 7 * 86400000);

  const [
    leadsByStatus,
    prospectsByStatus,
    prospectsBySector,
    followUpCandidates,
    totalProjects,
    recentLeads,
    followUpsDueToday,
    followUpsOverdue,
    followUpsUpcoming,
  ] = await Promise.all([
    db().lead.groupBy({ by: ["status"], _count: true }),
    db().prospect.groupBy({ by: ["status"], _count: true }),
    db().prospect.groupBy({ by: ["sector"], _count: { sector: true }, orderBy: { _count: { sector: "desc" } }, take: 10 }),
    db().prospect.count({ where: { status: "ENVOYE", sentAt: { lt: new Date(Date.now() - 3 * 86400000) } } }),
    db().project.count({ where: { visible: true } }),
    db().lead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, fullName: true, status: true, createdAt: true, subject: true } }),
    db().prospect.count({ where: { followUpDate: { gte: todayStart, lt: tomorrowStart } } }),
    db().prospect.count({ where: { followUpDate: { lt: todayStart }, status: { notIn: ["REPONDU", "CONVERTI"] } } }),
    db().prospect.count({ where: { followUpDate: { gte: tomorrowStart, lt: weekFromNow } } }),
  ]);

  return { leadsByStatus, prospectsByStatus, prospectsBySector, followUpCandidates, totalProjects, recentLeads, followUpsDueToday, followUpsOverdue, followUpsUpcoming };
}

export async function getAnalyticsData() {
  const [
    prospectsByStatus,
    prospectsBySector,
    leadsByStatus,
    allProspects,
    allLeads,
  ] = await Promise.all([
    db().prospect.groupBy({ by: ["status"], _count: true }),
    db().prospect.groupBy({ by: ["sector"], _count: { sector: true }, orderBy: { _count: { sector: "desc" } } }),
    db().lead.groupBy({ by: ["status"], _count: true }),
    db().prospect.findMany({ select: { sector: true, status: true, sentAt: true, createdAt: true, hasWebsite: true, instagram: true, phone: true } }),
    db().lead.findMany({ select: { status: true, createdAt: true } }),
  ]);

  const sectorPerformance = prospectsBySector.map((s) => {
    const sectorProspects = allProspects.filter((p) => p.sector === s.sector);
    const total = sectorProspects.length;
    const sent = sectorProspects.filter((p) => p.status !== "A_ENVOYER").length;
    const replied = sectorProspects.filter((p) => p.status === "REPONDU" || p.status === "CONVERTI").length;
    const converted = sectorProspects.filter((p) => p.status === "CONVERTI").length;
    return {
      sector: s.sector,
      total,
      sent,
      replied,
      converted,
      sentRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      conversionRate: sent > 0 ? Math.round((converted / sent) * 100) : 0,
    };
  });

  return { prospectsByStatus, prospectsBySector, leadsByStatus, sectorPerformance };
}

export async function getClients() {
  const [convertedProspects, qualifiedLeads] = await Promise.all([
    db().prospect.findMany({
      where: { status: "CONVERTI" },
      orderBy: { updatedAt: "desc" },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db().lead.findMany({
      where: { status: { in: ["QUALIFIED", "CLOSED"] } },
      orderBy: { updatedAt: "desc" },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  return { convertedProspects, qualifiedLeads };
}
