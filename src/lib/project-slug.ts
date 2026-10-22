/**
 * Project slugs are unique in the database. These helpers turn a clash into a
 * 409 the admin form can show, instead of an unhandled Prisma error (a bare
 * 500 the form can only report as "Something went wrong").
 */
export type SlugConflict = { status: 409; error: string };

export function slugConflict(slug: string): SlugConflict {
  return {
    status: 409,
    error: `A project with the slug "${slug}" already exists. Edit that project or choose a different slug.`,
  };
}

/**
 * Pre-check before a write. `lookup` returns the id of the project that owns
 * `slug`, or null. On update, pass the project's own id as `excludeId` so
 * saving without changing the slug is not a conflict.
 */
export async function findSlugConflict(
  slug: string,
  excludeId: string | null,
  lookup: (slug: string) => Promise<string | null>,
): Promise<SlugConflict | null> {
  const ownerId = await lookup(slug);
  return ownerId && ownerId !== excludeId ? slugConflict(slug) : null;
}

/**
 * Prisma P2002 raised by the slug's unique index: the race the pre-check
 * cannot close (two saves at once). Translations have their own unique key
 * (projectId, locale), so a P2002 on those columns is not a slug clash.
 *
 * With the Neon driver adapter `meta.target` is usually missing; the columns
 * are on `meta.driverAdapterError.cause.constraint.fields` instead (parsed
 * from Postgres' "Key (slug)=(...)" detail). Only when neither says which
 * columns clashed do we fall back to the model name.
 */
export function isUniqueSlugViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, meta } = err as {
    code?: unknown;
    meta?: {
      target?: unknown;
      modelName?: unknown;
      driverAdapterError?: { cause?: { constraint?: { fields?: unknown; index?: unknown } } };
    };
  };
  if (code !== "P2002") return false;

  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const columns = meta?.target ?? constraint?.fields ?? constraint?.index;
  if (Array.isArray(columns)) return columns.includes("slug");
  if (typeof columns === "string") return /(^|_)slug(_|$)/.test(columns);
  return meta?.modelName === "Project";
}
