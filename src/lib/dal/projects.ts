import { prisma, hasPrisma } from "../prisma";
import { FALLBACK_PROJECTS, FALLBACK_SLUGS } from "../fallback-projects";
import { getTranslations } from "next-intl/server";
import { DEFAULT_PROJECT_KIND } from "../project-kind";
import { CANONICAL_LOCALE, type SavePlan, type TestimonialState } from "../testimonial-approval";
import { db } from "./db";

// ─── Projects ────────────────────────────────────────────────────

/** Testimonial columns of a translation: written only through the testimonial functions below. */
const TESTIMONIAL_TRANSLATION_OMIT = {
  testimonial: true, testimonialRole: true, testimonialApprovedAt: true, testimonialApprovedBy: true,
} as const;

/** The project-form content of a translation: everything except the testimonial columns. */
const TRANSLATION_CONTENT_FIELDS = [
  "title", "desc", "tags", "tagline", "metaDesc", "client", "industry", "challenge", "solution",
  "step1Title", "step1Desc", "step2Title", "step2Desc", "step3Title", "step3Desc", "features",
  "tech", "result1Value", "result1Label", "result2Value", "result2Label", "result3Value",
  "result3Label", "results",
] as const;

function translationContent(t: ProjectInput["translations"][number]) {
  const out: Record<string, string> = {};
  for (const f of TRANSLATION_CONTENT_FIELDS) {
    const v = (t as Record<string, unknown>)[f];
    if (typeof v === "string") out[f] = v;
  }
  return out as { title: string; desc: string; tags: string } & Partial<Record<(typeof TRANSLATION_CONTENT_FIELDS)[number], string>>;
}

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
    "asrar-lalla": "project14",
  };

  return FALLBACK_PROJECTS.map((p) => {
    const key = keyMap[p.slug] ?? p.slug;
    return {
      ...p,
      tag: safeT(t, `${key}_eyebrow`) ?? p.tag,
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

// Hidden in the database; the static fallback list predates the visibility flag.
const FALLBACK_HIDDEN = new Set(["luxury-copro"]);

export type HomepageProject = {
  slug: string;
  url: string;
  image: string;
  title: string;
  sector: string;
  kind: string;
};

/** Visible projects for the homepage, in admin sort order, with the localized sector. */
export async function getHomepageProjects(locale: string): Promise<HomepageProject[]> {
  const fallback = async () =>
    (await getFallbackProjects(locale))
      .filter((p) => !FALLBACK_HIDDEN.has(p.slug))
      .map((p) => ({
        slug: p.slug, url: p.url, image: p.image, title: p.title, sector: p.tag, kind: p.kind,
      }));
  if (!hasPrisma()) return fallback();
  try {
    const projects = await prisma.project.findMany({
      where: { visible: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true, url: true, image: true, tag: true, kind: true,
        translations: { where: { locale }, select: { title: true, industry: true } },
      },
    });
    if (projects.length === 0) return fallback();
    return projects.map((p) => ({
      slug: p.slug,
      url: p.url,
      image: p.image,
      title: p.translations[0]?.title ?? p.slug,
      sector: p.translations[0]?.industry || p.tag,
      kind: p.kind,
    }));
  } catch (e) {
    console.error("[dal] getHomepageProjects failed, using fallback:", e);
    return fallback();
  }
}

export type PublishedTestimonialRow = {
  slug: string;
  kind: string;
  visible: boolean;
  project: string;
  author: string | null;
  role: string | null;
  quote: string | null;
  approvedAt: Date | null;
};

/**
 * Published testimonials of visible Client projects, in admin order. The testimonial is shared by
 * every language: it is read from the canonical (French) row whatever `locale` is; `locale` only
 * picks the project name shown next to the role. The filter runs in the database, so unpublished
 * quotes, the legacy EN/AR testimonial columns and the private consent note never leave it for a
 * public page. No database (previews, fallback): none. lib/testimonials re-checks every row.
 */
export async function getPublishedTestimonials(locale: string): Promise<PublishedTestimonialRow[]> {
  if (!hasPrisma()) return [];
  try {
    const rows = await prisma.projectTranslation.findMany({
      where: { locale: CANONICAL_LOCALE, testimonialApprovedAt: { not: null }, project: { is: { visible: true, kind: "CLIENT" } } },
      orderBy: { project: { sortOrder: "asc" } },
      select: {
        title: true, testimonial: true, testimonialRole: true, testimonialApprovedAt: true,
        project: {
          select: {
            slug: true, kind: true, visible: true, testimonialAuthor: true,
            translations: { where: { locale }, select: { title: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      slug: r.project.slug,
      kind: r.project.kind,
      visible: r.project.visible,
      project: r.project.translations[0]?.title || r.title,
      author: r.project.testimonialAuthor,
      role: r.testimonialRole,
      quote: r.testimonial,
      approvedAt: r.testimonialApprovedAt,
    }));
  } catch (e) {
    console.error("[dal] getPublishedTestimonials failed, showing none:", e);
    return [];
  }
}

export type PortfolioCardProject = {
  slug: string;
  url: string;
  image: string;
  title: string;
  desc: string;
  tags: string[];
  sector: string;
  kind: string;
};

/** Visible projects for the Portfolio page, in admin sort order (read-only). */
export async function getPortfolioProjects(locale: string): Promise<PortfolioCardProject[]> {
  const split = (tags: string) => tags.split(",").map((s) => s.trim()).filter(Boolean);
  const fallback = async () =>
    (await getFallbackProjects(locale))
      .filter((p) => !FALLBACK_HIDDEN.has(p.slug))
      .map((p) => ({ slug: p.slug, url: p.url, image: p.image, title: p.title, desc: p.desc, tags: split(p.tags), sector: p.tag, kind: p.kind }));
  if (!hasPrisma()) return fallback();
  try {
    const projects = await prisma.project.findMany({
      where: { visible: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true, url: true, image: true, tag: true, kind: true,
        translations: { where: { locale }, select: { title: true, desc: true, tags: true, industry: true } },
      },
    });
    if (projects.length === 0) return fallback();
    return projects.map((p) => {
      const t = p.translations[0];
      return {
        slug: p.slug,
        url: p.url,
        image: p.image,
        title: t?.title ?? p.slug,
        desc: t?.desc ?? "",
        tags: split(t?.tags ?? ""),
        sector: t?.industry || p.tag,
        kind: p.kind,
      };
    });
  } catch (e) {
    console.error("[dal] getPortfolioProjects failed, using fallback:", e);
    return fallback();
  }
}

/** Id of the project that owns `slug`, or null. Used to reject duplicate slugs before writing. */
export async function getProjectIdBySlug(slug: string): Promise<string | null> {
  const project = await db().project.findUnique({ where: { slug }, select: { id: true } });
  return project?.id ?? null;
}

export async function getProjectBySlug(slug: string, locale: string) {
  if (!hasPrisma()) return getFallbackSlug(slug, locale);
  const project = await prisma.project.findUnique({
    where: { slug },
    // Public page: never load the testimonial (approved or not) or the private consent note.
    omit: { testimonialAuthor: true, testimonialConsent: true },
    include: {
      translations: { where: { locale }, omit: TESTIMONIAL_TRANSLATION_OMIT },
    },
  });

  // Explicitly hidden in the database: not found (never served from the static fallback).
  if (project && !project.visible) return null;
  if (!project) return getFallbackSlug(slug, locale);

  const t = project.translations[0];
  return { ...project, translation: t ?? null };
}

async function getFallbackSlug(slug: string, locale: string) {
  if (FALLBACK_HIDDEN.has(slug)) return null;
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
  status?: string;
  /** CLIENT | CONCEPT. On update, undefined keeps the saved value. */
  kind?: string;
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
    results?: string;
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
      status: data.status ?? "DRAFT",
      kind: data.kind ?? DEFAULT_PROJECT_KIND,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      // Content only: a testimonial is never created here, so it is never copied between locales.
      translations: {
        create: data.translations.map((t) => ({ locale: t.locale, ...translationContent(t) })),
      },
    },
    include: { translations: true },
  });
}

/**
 * Saves the project form. Translations are updated in place (content columns only) rather than
 * deleted and recreated, so the testimonial, its role and its approval survive every project save
 * untouched. Locales absent from a non-empty payload are removed, as before.
 */
export async function updateProject(id: string, data: ProjectInput) {
  const translations = data.translations.map((t) => ({ locale: t.locale, ...translationContent(t) }));
  const locales = translations.map((t) => t.locale);
  await db().$transaction([
    db().project.update({
      where: { id },
      data: {
        slug: data.slug,
        category: data.category,
        url: data.url,
        image: data.image,
        tag: data.tag,
        visible: data.visible,
        ...(data.status ? { status: data.status } : {}),
        ...(data.kind ? { kind: data.kind } : {}),
      },
    }),
    ...(locales.length > 0
      ? [db().projectTranslation.deleteMany({ where: { projectId: id, locale: { notIn: locales } } })]
      : []),
    ...translations.map((t) =>
      db().projectTranslation.upsert({
        where: { projectId_locale: { projectId: id, locale: t.locale } },
        update: t,
        create: { ...t, projectId: id },
      }),
    ),
  ]);
  return getProjectByIdForAdmin(id);
}

// ─── Project testimonial (admin) ─────────────────────────────────
// One testimonial per project (lib/testimonial-approval): author and consent on the project;
// quote, role and publication on the canonical (French) translation row. The EN/AR testimonial
// columns are legacy and are never read or written here.

/** The testimonial of a project as the admin API sees it, or null if the project does not exist. */
export async function getTestimonialState(projectId: string): Promise<TestimonialState | null> {
  const p = await db().project.findUnique({
    where: { id: projectId },
    select: {
      id: true, kind: true, testimonialAuthor: true, testimonialConsent: true,
      translations: {
        where: { locale: CANONICAL_LOCALE },
        select: { testimonial: true, testimonialRole: true, testimonialApprovedAt: true, testimonialApprovedBy: true },
      },
    },
  });
  if (!p) return null;
  const t = p.translations[0];
  // Stored values as they are (not trimmed): publishing compares them exactly.
  return {
    projectId: p.id,
    kind: p.kind,
    author: p.testimonialAuthor ?? "",
    consent: p.testimonialConsent ?? "",
    quote: t?.testimonial ?? "",
    role: t?.testimonialRole ?? "",
    approvedAt: t?.testimonialApprovedAt ?? null,
    approvedBy: t?.testimonialApprovedBy ?? null,
    hasCanonicalRow: !!t,
  };
}

/** Who made a testimonial change: recorded in the audit log written in the same transaction. */
export type TestimonialActor = { userId: string; userName: string; ipAddress?: string };

const auditRow = (actor: TestimonialActor, action: string, projectId: string, details: Record<string, unknown>) => ({
  data: {
    userId: actor.userId,
    userName: actor.userName,
    action,
    entity: "project",
    entityId: projectId,
    details: JSON.stringify(details),
    ipAddress: actor.ipAddress ?? null,
  },
});

const canonicalRow = (projectId: string) => ({ projectId_locale: { projectId, locale: CANONICAL_LOCALE } });

/**
 * Writes a save plan (lib/testimonial-approval): only the changed values, unpublishing when the
 * plan says so. The update and the unpublication it causes are audited in the same transaction,
 * so an unpublication can never happen unrecorded. Returns true if it was published before.
 */
export async function saveTestimonialDraft(projectId: string, plan: SavePlan, actor: TestimonialActor): Promise<boolean> {
  const orNull = (s: string) => (s === "" ? null : s);
  return db().$transaction(async (tx) => {
    // Publication as it is now (not as read before the request), so the audit is exact.
    const was = await tx.projectTranslation.findUnique({ where: canonicalRow(projectId), select: { testimonialApprovedAt: true } });
    const wasPublished = !!was?.testimonialApprovedAt;
    if (Object.keys(plan.project).length > 0) {
      await tx.project.update({
        where: { id: projectId },
        data: {
          ...(plan.project.author !== undefined ? { testimonialAuthor: orNull(plan.project.author) } : {}),
          ...(plan.project.consent !== undefined ? { testimonialConsent: orNull(plan.project.consent) } : {}),
        },
      });
    }
    if (plan.text || plan.unpublish) {
      await tx.projectTranslation.update({
        where: canonicalRow(projectId),
        data: {
          ...(plan.text ? { testimonial: orNull(plan.text.quote), testimonialRole: orNull(plan.text.role) } : {}),
          ...(plan.unpublish ? { testimonialApprovedAt: null, testimonialApprovedBy: null } : {}),
        },
      });
    }
    // The audit records what changed, never the text or the consent note.
    await tx.auditLog.create(auditRow(actor, "TESTIMONIAL_UPDATED", projectId, {
      quoteOrRoleChanged: !!plan.text,
      authorChanged: plan.project.author !== undefined,
      consentChanged: plan.project.consent !== undefined,
    }));
    const unpublished = wasPublished && plan.unpublish;
    if (unpublished) {
      const reason = plan.text ? "quote_or_role_edited" : plan.project.author !== undefined ? "author_edited" : "consent_removed";
      await tx.auditLog.create(auditRow(actor, "TESTIMONIAL_REVOKED", projectId, { reason, scope: "all_languages" }));
    }
    return unpublished;
  });
}

/**
 * Publishes the testimonial on every language, atomically and only if the saved values are still
 * exactly the ones the admin approved (and the project is still a Client project with a consent
 * reference), together with its audit entry. Returns false when anything changed in between:
 * nothing is written then.
 */
export async function approveTestimonial(
  projectId: string,
  expected: { author: string; role: string; quote: string },
  actor: TestimonialActor,
  fingerprint: string,
): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const { count } = await tx.projectTranslation.updateMany({
      where: {
        projectId,
        locale: CANONICAL_LOCALE,
        testimonial: expected.quote,
        testimonialRole: expected.role,
        project: {
          is: {
            kind: "CLIENT",
            testimonialAuthor: expected.author,
            AND: [{ testimonialConsent: { not: null } }, { NOT: { testimonialConsent: "" } }],
          },
        },
      },
      data: { testimonialApprovedAt: new Date(), testimonialApprovedBy: actor.userName },
    });
    if (count !== 1) return false;
    await tx.auditLog.create(auditRow(actor, "TESTIMONIAL_APPROVED", projectId, { fingerprint, scope: "all_languages" }));
    return true;
  });
}

/** Hides the testimonial on every language (the text is kept), audited. Returns false if it was not published. */
export async function revokeTestimonial(projectId: string, actor: TestimonialActor): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const { count } = await tx.projectTranslation.updateMany({
      where: { projectId, locale: CANONICAL_LOCALE, testimonialApprovedAt: { not: null } },
      data: { testimonialApprovedAt: null, testimonialApprovedBy: null },
    });
    if (count !== 1) return false;
    await tx.auditLog.create(auditRow(actor, "TESTIMONIAL_REVOKED", projectId, { reason: "manual", scope: "all_languages" }));
    return true;
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
