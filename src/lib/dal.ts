import { prisma } from "./prisma";
import { FALLBACK_PROJECTS, FALLBACK_SLUGS } from "./fallback-projects";
import { getTranslations } from "next-intl/server";

function db() {
  if (!prisma) throw new Error("Database not available");
  return prisma;
}

// ─── Projects ────────────────────────────────────────────────────

async function getFallbackProjects(locale: string) {
  let t: Awaited<ReturnType<typeof getTranslations>>;
  let cs: Awaited<ReturnType<typeof getTranslations>>;
  try {
    t = await getTranslations({ locale, namespace: "Portfolio" });
    cs = await getTranslations({ locale, namespace: "CaseStudy" });
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
  if (!prisma) return getFallbackProjects(locale);
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
  if (!prisma) return getFallbackSlug(slug, locale);
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
  if (!prisma) return FALLBACK_SLUGS;
  const projects = await prisma.project.findMany({
    where: { visible: true },
    select: { slug: true },
    orderBy: { sortOrder: "asc" },
  });
  return projects.length > 0 ? projects.map((p) => p.slug) : FALLBACK_SLUGS;
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
