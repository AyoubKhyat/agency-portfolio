import { z } from "zod";

/* ============================================================
 * Instagram Content Planner — shared contract between the API,
 * the admin UI and the calendar import.
 *
 * Workflow: IDEA → DRAFT → READY → SCHEDULED → PUBLISHED
 *
 * Publishing happens by hand on Instagram, so PUBLISHED is a claim
 * about the outside world and is guarded:
 * - it is never accepted on create, and the calendar import can
 *   never produce it;
 * - reaching it needs an explicit confirmation, the live
 *   instagram.com link and a publication date that is not in the
 *   future;
 * - leaving it needs a confirmation too (link and metrics are kept);
 * - metrics can only be recorded on a published post.
 *
 * Pure and DB-free so every rule is regression-tested directly
 * (tests/content-posts.test.ts). The UI imports the same constants
 * so its dropdowns can never drift from what the API accepts.
 * ============================================================ */

export const CONTENT_FORMATS = ["REEL", "CAROUSEL", "POST", "STORY"] as const;
export const CONTENT_STATUSES = ["IDEA", "DRAFT", "READY", "SCHEDULED", "PUBLISHED"] as const;
/** Statuses a post can be created with (and the import can produce). */
export const PRE_PUBLISH_STATUSES = ["IDEA", "DRAFT", "READY", "SCHEDULED"] as const;
export const CONTENT_METRICS = ["views", "reach", "likes", "comments", "saves", "shares", "follows"] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ContentMetric = (typeof CONTENT_METRICS)[number];

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  REEL: "Reel",
  CAROUSEL: "Carousel",
  POST: "Post",
  STORY: "Story",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  IDEA: "Idea",
  DRAFT: "Draft",
  READY: "Ready",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};

export const CONTENT_METRIC_LABELS: Record<ContentMetric, string> = {
  views: "Views",
  reach: "Reach",
  likes: "Likes",
  comments: "Comments",
  saves: "Saves",
  shares: "Shares",
  follows: "Follows",
};

/** Instagram's caption limit. */
export const CAPTION_MAX = 2200;
/** Instagram carousels hold up to 20 items. */
export const MAX_MEDIA = 20;
/** Clock skew tolerated on a publication date before it counts as "in the future". */
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;

const RANK: Record<ContentStatus, number> = { IDEA: 0, DRAFT: 1, READY: 2, SCHEDULED: 3, PUBLISHED: 4 };

/* ---------- row shapes ---------- */

/** The fields the workflow rules look at. */
export type ContentFields = {
  title: string;
  format: string;
  status: string;
  plannedAt: Date | null;
  caption: string;
  mediaPaths: string[];
  publishedUrl: string;
  publishedAt: Date | null;
};

/** A stored row as the update rules need it (Prisma's ContentPost satisfies this). */
export type ContentRow = ContentFields & { archivedAt: Date | null };

/** What the API returns (dates serialised as ISO strings). */
export type ContentPostDTO = {
  id: string;
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  plannedAt: string | null;
  pillar: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  mediaPaths: string[];
  nextAction: string;
  notes: string;
  publishedAt: string | null;
  publishedUrl: string;
  metricsUpdatedAt: string | null;
  sourceKey: string | null;
  archivedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
} & Record<ContentMetric, number | null>;

/* ---------- rules ---------- */

/** A link to one post, Reel or Story on instagram.com (https only). */
export function isInstagramPostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "instagram.com" || u.hostname === "www.instagram.com") &&
      /^\/(p|reel|reels|tv|stories)\/[^/]+/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * What is still missing before `post` may carry `status` (defaults to its own).
 * Empty array = allowed. Messages are written for the person filling the form.
 */
export function readinessProblems(post: ContentFields, status: string = post.status): string[] {
  const problems: string[] = [];
  const rank = RANK[status as ContentStatus] ?? 0;

  if (!post.title.trim()) problems.push("Add a title.");
  if (rank < RANK.READY) return problems;

  const media = post.mediaPaths.filter((m) => m.trim() !== "");
  if (media.length === 0) problems.push("Add at least one media file.");
  else if (post.format === "CAROUSEL" && media.length < 2) problems.push("A carousel needs at least 2 slides.");
  if (post.format !== "STORY" && !post.caption.trim()) problems.push("Write the caption.");

  if (status === "SCHEDULED" && !post.plannedAt) problems.push("Set the planned date.");

  if (status === "PUBLISHED") {
    if (!isInstagramPostUrl(post.publishedUrl)) problems.push("Add the instagram.com link of the live post.");
    if (!post.publishedAt) problems.push("Add the publication date.");
  }
  return problems;
}

/* ---------- validation ---------- */

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "must be a valid date");
const text = (max: number) => z.string().trim().max(max);
const metricValue = z.number().int().min(0).max(1_000_000_000).nullable();

/** Editable content fields, without defaults (shared by create and update). */
const fieldShape = {
  title: z.string().trim().min(1, "Title is required").max(200),
  format: z.enum(CONTENT_FORMATS),
  plannedAt: isoDate.nullable(),
  pillar: text(100),
  hook: text(500),
  caption: z.string().max(CAPTION_MAX, `Instagram captions are limited to ${CAPTION_MAX} characters`),
  hashtags: text(1000),
  cta: text(300),
  mediaPaths: z.array(z.string().trim().min(1).max(500)).max(MAX_MEDIA, `At most ${MAX_MEDIA} media files`),
  nextAction: text(300),
  notes: text(5000),
};

export const contentCreateSchema = z.strictObject({
  title: fieldShape.title,
  format: fieldShape.format,
  status: z.enum(PRE_PUBLISH_STATUSES).optional(),
  plannedAt: fieldShape.plannedAt.optional(),
  pillar: fieldShape.pillar.optional(),
  hook: fieldShape.hook.optional(),
  caption: fieldShape.caption.optional(),
  hashtags: fieldShape.hashtags.optional(),
  cta: fieldShape.cta.optional(),
  mediaPaths: fieldShape.mediaPaths.optional(),
  nextAction: fieldShape.nextAction.optional(),
  notes: fieldShape.notes.optional(),
});

export const contentUpdateSchema = z.strictObject({
  title: fieldShape.title.optional(),
  format: fieldShape.format.optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  plannedAt: fieldShape.plannedAt.optional(),
  pillar: fieldShape.pillar.optional(),
  hook: fieldShape.hook.optional(),
  caption: fieldShape.caption.optional(),
  hashtags: fieldShape.hashtags.optional(),
  cta: fieldShape.cta.optional(),
  mediaPaths: fieldShape.mediaPaths.optional(),
  nextAction: fieldShape.nextAction.optional(),
  notes: fieldShape.notes.optional(),
  publishedUrl: z.string().trim().max(500).optional(),
  publishedAt: isoDate.optional(),
  views: metricValue.optional(),
  reach: metricValue.optional(),
  likes: metricValue.optional(),
  comments: metricValue.optional(),
  saves: metricValue.optional(),
  shares: metricValue.optional(),
  follows: metricValue.optional(),
  /** Required to move a post INTO Published. */
  confirmPublished: z.literal(true).optional(),
  /** Required to move a post OUT of Published. */
  confirmUnpublish: z.literal(true).optional(),
  archived: z.boolean().optional(),
});

export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;

export function firstContentError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid data";
  const field = issue.path.filter((p) => typeof p === "string").join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

/* ---------- write plans ---------- */

export type ContentCreateData = {
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  plannedAt: Date | null;
  pillar: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  mediaPaths: string[];
  nextAction: string;
  notes: string;
};

type Refusal = { ok: false; status: 400 | 409; error: string };

function statusRefusal(status: string, problems: string[]): Refusal {
  const label = CONTENT_STATUS_LABELS[status as ContentStatus] ?? status;
  return { ok: false, status: 400, error: `Cannot set "${label}" yet: ${problems.join(" ")}` };
}

/** Validated create input → the row to insert. Never produces PUBLISHED. */
export function planContentCreate(input: ContentCreateInput): { ok: true; data: ContentCreateData } | Refusal {
  const data: ContentCreateData = {
    title: input.title,
    format: input.format,
    status: input.status ?? "IDEA",
    plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
    pillar: input.pillar ?? "",
    hook: input.hook ?? "",
    caption: input.caption ?? "",
    hashtags: input.hashtags ?? "",
    cta: input.cta ?? "",
    mediaPaths: input.mediaPaths ?? [],
    nextAction: input.nextAction ?? "",
    notes: input.notes ?? "",
  };
  const problems = readinessProblems({ ...data, publishedUrl: "", publishedAt: null });
  if (problems.length) return statusRefusal(data.status, problems);
  return { ok: true, data };
}

export type ContentUpdatePlan = {
  ok: true;
  data: Record<string, unknown>;
  /** Set when the change publishes or unpublishes the post (audited by the route). */
  event: "PUBLISHED" | "UNPUBLISHED" | null;
};

const TEXT_FIELDS = ["title", "format", "pillar", "hook", "caption", "hashtags", "cta", "nextAction", "notes"] as const;

/** Validated update input + the stored row → the columns to write, or why not. */
export function planContentUpdate(
  before: ContentRow,
  input: ContentUpdateInput,
  now: Date = new Date(),
): ContentUpdatePlan | Refusal {
  const data: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) if (input[f] !== undefined) data[f] = input[f];
  if (input.plannedAt !== undefined) data.plannedAt = input.plannedAt ? new Date(input.plannedAt) : null;
  if (input.mediaPaths !== undefined) data.mediaPaths = input.mediaPaths;

  const target = input.status ?? before.status;
  const wasPublished = before.status === "PUBLISHED";
  const publishing = target === "PUBLISHED" && !wasPublished;
  const unpublishing = wasPublished && target !== "PUBLISHED";

  if (publishing && input.confirmPublished !== true) {
    return { ok: false, status: 400, error: "Confirm that the post is live on Instagram before marking it as published." };
  }
  if (unpublishing && input.confirmUnpublish !== true) {
    return { ok: false, status: 400, error: "Confirm moving this post out of Published." };
  }

  if ((input.publishedUrl !== undefined || input.publishedAt !== undefined) && target !== "PUBLISHED") {
    return { ok: false, status: 400, error: "The Instagram link and publication date are recorded when the post is marked as published." };
  }
  if (input.publishedUrl !== undefined) data.publishedUrl = input.publishedUrl;
  if (input.publishedAt !== undefined) {
    const at = new Date(input.publishedAt);
    if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      return { ok: false, status: 400, error: "The publication date cannot be in the future. Use Scheduled for upcoming posts." };
    }
    data.publishedAt = at;
  }

  const metrics = CONTENT_METRICS.filter((m) => input[m] !== undefined);
  if (metrics.length) {
    if (target !== "PUBLISHED") {
      return { ok: false, status: 400, error: "Metrics can only be recorded for a published post." };
    }
    for (const m of metrics) data[m] = input[m];
    data.metricsUpdatedAt = now;
  }

  if (input.status !== undefined && input.status !== before.status) data.status = input.status;

  const merged: ContentFields = {
    title: (data.title as string | undefined) ?? before.title,
    format: (data.format as string | undefined) ?? before.format,
    status: target,
    plannedAt: data.plannedAt !== undefined ? (data.plannedAt as Date | null) : before.plannedAt,
    caption: (data.caption as string | undefined) ?? before.caption,
    mediaPaths: (data.mediaPaths as string[] | undefined) ?? before.mediaPaths,
    publishedUrl: (data.publishedUrl as string | undefined) ?? before.publishedUrl,
    publishedAt: data.publishedAt !== undefined ? (data.publishedAt as Date) : before.publishedAt,
  };
  const problems = readinessProblems(merged, target);
  if (problems.length) return statusRefusal(target, problems);

  if (input.archived !== undefined) data.archivedAt = input.archived ? (before.archivedAt ?? now) : null;

  return { ok: true, data, event: publishing ? "PUBLISHED" : unpublishing ? "UNPUBLISHED" : null };
}

/* ---------- planner views ---------- */

/** Local calendar day of a date as YYYY-MM-DD. */
export function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `count` consecutive local days starting at `start` (YYYY-MM-DD), as YYYY-MM-DD keys. */
export function calendarDays(start: string, count = 30): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!m) return [];
  const base = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Array.from({ length: count }, (_, i) =>
    localDayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)),
  );
}

/**
 * Daily follow-up: unpublished, unarchived posts that carry a next action,
 * soonest planned first (unplanned last). `overdue` = planned before today
 * and still not scheduled.
 */
export function followUps<T extends Pick<ContentPostDTO, "status" | "nextAction" | "plannedAt" | "archivedAt">>(
  posts: T[],
  now: Date = new Date(),
): (T & { overdue: boolean })[] {
  const today = localDayKey(now);
  return posts
    .filter((p) => !p.archivedAt && p.status !== "PUBLISHED" && p.nextAction.trim() !== "")
    .map((p) => ({
      ...p,
      overdue: !!p.plannedAt && localDayKey(new Date(p.plannedAt)) < today && p.status !== "SCHEDULED",
    }))
    .sort((a, b) => {
      if (!a.plannedAt) return b.plannedAt ? 1 : 0;
      if (!b.plannedAt) return -1;
      return Date.parse(a.plannedAt) - Date.parse(b.plannedAt);
    });
}
