import { prisma } from "./prisma";

function db() {
  if (!prisma) throw new Error("Database not available");
  return prisma;
}

// ─── Projects ────────────────────────────────────────────────────

export async function getVisibleProjects(locale: string) {
  if (!prisma) return [];
  const projects = await prisma.project.findMany({
    where: { visible: true },
    orderBy: { sortOrder: "asc" },
    include: {
      translations: { where: { locale } },
    },
  });

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
  if (!prisma) return null;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      translations: { where: { locale } },
    },
  });

  if (!project || !project.visible) return null;

  const t = project.translations[0];
  return { ...project, translation: t ?? null };
}

export async function getAllProjectSlugs() {
  if (!prisma) return [];
  const projects = await prisma.project.findMany({
    where: { visible: true },
    select: { slug: true },
    orderBy: { sortOrder: "asc" },
  });
  return projects.map((p) => p.slug);
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

// ─── Stats ───────────────────────────────────────────────────────

export async function getAdminStats() {
  const [totalProjects, visibleProjects, totalLeads, newLeads] =
    await Promise.all([
      db().project.count(),
      db().project.count({ where: { visible: true } }),
      db().lead.count(),
      db().lead.count({ where: { status: "NEW" } }),
    ]);

  return { totalProjects, visibleProjects, totalLeads, newLeads };
}
