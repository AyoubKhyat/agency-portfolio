import {
  contentCreateSchema,
  firstContentError,
  readinessProblems,
  type ContentCreateData,
  type ContentFormat,
  type ContentStatus,
} from "./content-posts";

/* ============================================================
 * 30-day Instagram calendar import — parsing and planning.
 *
 * Turns a CSV or JSON calendar into content_posts rows. Pure and
 * DB-free (tests/content-calendar-import.test.ts); the database
 * side is behind the two callbacks of applyCalendarImport, wired
 * up by scripts/import-content-calendar.ts.
 *
 * Columns (case-insensitive; only day, format and title required):
 *   day, time, format, title, pillar, hook, caption, hashtags, cta,
 *   media (separated by "|"), next_action, notes, status, key
 *
 * - Day N is planned on start date + (N − 1) at `time` (or the
 *   default time) in the given UTC offset.
 * - The import NEVER produces PUBLISHED. A row the source marks as
 *   published comes in as Ready (or lower) with a note and a next
 *   action asking for confirmation in the planner.
 * - A status the row's content does not support yet is lowered
 *   (Scheduled → Ready → Draft) with a warning, never refused.
 * - Each row gets a stable sourceKey (<prefix>:day-07-reel, or
 *   <prefix>:<key> when a key column is given); re-running the
 *   import skips keys that already exist and changes nothing.
 * ============================================================ */

export type CalendarImportOptions = {
  /** Day 1, as YYYY-MM-DD. */
  startDate: string;
  /** Default posting time, HH:MM. */
  defaultTime: string;
  /** UTC offset of the planned times, e.g. +01:00 (Morocco). */
  tzOffset: string;
  /** sourceKey prefix, e.g. ibda3-30d. */
  keyPrefix: string;
};

export type PlannedImport = {
  row: number;
  day: number;
  sourceKey: string;
  data: ContentCreateData;
  sourceSaysPublished: boolean;
  warnings: string[];
};

export type ImportPlan = { posts: PlannedImport[]; errors: string[] };

export const PUBLISHED_CONFIRMATION_NOTE =
  "[Import] The source calendar marks this post as published. Confirm it in the planner with the Instagram link.";
export const PUBLISHED_CONFIRMATION_ACTION = "Confirm publication (add the Instagram link)";

/* ---------- file reading ---------- */

/** RFC 4180-style CSV: quoted fields, doubled quotes, commas and newlines inside quotes, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

/** A calendar file → one record per row, keyed by normalised column name. */
export function readCalendar(text: string, kind: "csv" | "json"): Record<string, string>[] {
  if (kind === "json") {
    const parsed: unknown = JSON.parse(text.replace(/^﻿/, ""));
    if (!Array.isArray(parsed)) throw new Error("A JSON calendar must be an array of objects.");
    return parsed.map((item, i) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`JSON item ${i + 1} is not an object.`);
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(item)) {
        out[normHeader(k)] = Array.isArray(v) ? v.map(String).join(" | ") : v == null ? "" : String(v);
      }
      return out;
    });
  }
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const cols = header.map(normHeader);
  return rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? "").trim()])));
}

/* ---------- mapping ---------- */

const FORMAT_ALIASES: Record<string, ContentFormat> = {
  reel: "REEL", reels: "REEL", video: "REEL",
  carousel: "CAROUSEL", carrousel: "CAROUSEL",
  post: "POST", static: "POST", static_post: "POST", image: "POST", photo: "POST", publication: "POST",
  story: "STORY", stories: "STORY",
};

const STATUS_ALIASES: Record<string, ContentStatus | "PUBLISHED_IN_SOURCE"> = {
  "": "IDEA", idea: "IDEA", idee: "IDEA",
  draft: "DRAFT", brouillon: "DRAFT",
  ready: "READY", pret: "READY",
  scheduled: "SCHEDULED", programme: "SCHEDULED", planifie: "SCHEDULED",
  published: "PUBLISHED_IN_SOURCE", publie: "PUBLISHED_IN_SOURCE", posted: "PUBLISHED_IN_SOURCE",
  live: "PUBLISHED_IN_SOURCE", done: "PUBLISHED_IN_SOURCE",
};

/** Lower-case, accents stripped, spaces/dashes → underscores. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const DOWNGRADE: Partial<Record<ContentStatus, ContentStatus>> = { SCHEDULED: "READY", READY: "DRAFT" };

function addDays(start: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

/** Calendar records → rows to create. Any error means nothing may be imported. */
export function planCalendarImport(records: Record<string, string>[], opts: CalendarImportOptions): ImportPlan {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.startDate) || Number.isNaN(Date.parse(`${opts.startDate}T00:00:00Z`))) {
    errors.push(`Start date "${opts.startDate}" must be YYYY-MM-DD.`);
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(opts.defaultTime)) errors.push(`Default time "${opts.defaultTime}" must be HH:MM.`);
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(opts.tzOffset)) errors.push(`Time zone offset "${opts.tzOffset}" must look like +01:00.`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.keyPrefix)) errors.push(`Key prefix "${opts.keyPrefix}" must be lower-case letters, digits and dashes.`);
  if (errors.length) return { posts: [], errors };

  const posts: PlannedImport[] = [];
  const seen = new Map<string, number>();

  records.forEach((rec, i) => {
    const row = i + 2; // spreadsheet row number (header is row 1)
    const fail = (msg: string) => errors.push(`Row ${row}: ${msg}`);

    const day = Number(rec.day);
    if (!Number.isInteger(day) || day < 1 || day > 366) return fail(`day "${rec.day ?? ""}" must be a whole number from 1.`);

    const format = FORMAT_ALIASES[fold(rec.format ?? "")];
    if (!format) return fail(`format "${rec.format ?? ""}" is not one of Reel, Carousel, Post, Story.`);

    const time = (rec.time ?? "").trim() || opts.defaultTime;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail(`time "${time}" must be HH:MM.`);

    const sourceStatus = STATUS_ALIASES[fold(rec.status ?? "")];
    if (!sourceStatus) return fail(`status "${rec.status}" is not one of Idea, Draft, Ready, Scheduled, Published.`);
    const sourceSaysPublished = sourceStatus === "PUBLISHED_IN_SOURCE";

    const date = addDays(opts.startDate, day - 1)!;
    const media = (rec.media ?? rec.media_paths ?? "").split(/\s*\|\s*|\r?\n/).map((m) => m.trim()).filter(Boolean);
    let nextAction = rec.next_action ?? rec.nextaction ?? "";
    let notes = rec.notes ?? "";
    if (sourceSaysPublished) {
      notes = notes ? `${notes}\n\n${PUBLISHED_CONFIRMATION_NOTE}` : PUBLISHED_CONFIRMATION_NOTE;
      if (!nextAction.trim()) nextAction = PUBLISHED_CONFIRMATION_ACTION;
    }

    const input = {
      title: rec.title ?? "",
      format,
      plannedAt: `${date}T${time}:00${opts.tzOffset}`,
      pillar: rec.pillar ?? "",
      hook: rec.hook ?? "",
      caption: rec.caption ?? "",
      hashtags: rec.hashtags ?? "",
      cta: rec.cta ?? "",
      mediaPaths: media,
      nextAction,
      notes,
    };
    const parsed = contentCreateSchema.safeParse(input);
    if (!parsed.success) return fail(firstContentError(parsed.error));

    const warnings: string[] = [];
    let status: ContentStatus = sourceSaysPublished ? "READY" : sourceStatus;
    const data: ContentCreateData = {
      ...parsed.data,
      status,
      plannedAt: new Date(parsed.data.plannedAt!),
      pillar: parsed.data.pillar ?? "",
      hook: parsed.data.hook ?? "",
      caption: parsed.data.caption ?? "",
      hashtags: parsed.data.hashtags ?? "",
      cta: parsed.data.cta ?? "",
      mediaPaths: parsed.data.mediaPaths ?? [],
      nextAction: parsed.data.nextAction ?? "",
      notes: parsed.data.notes ?? "",
    };
    for (;;) {
      const problems = readinessProblems({ ...data, publishedUrl: "", publishedAt: null }, status);
      const lower = DOWNGRADE[status];
      if (!problems.length || !lower) break;
      warnings.push(`Imported as ${lower} instead of ${status}: ${problems.join(" ")}`);
      status = lower;
    }
    data.status = status;
    if (sourceSaysPublished) warnings.push("Source says published: imported as not published; confirm it in the planner.");

    const keyPart = (rec.key ?? "").trim()
      ? fold(rec.key).replace(/[^a-z0-9_]/g, "").replace(/_/g, "-")
      : `day-${String(day).padStart(2, "0")}-${format.toLowerCase()}`;
    if (!keyPart) return fail(`key "${rec.key}" has no usable characters.`);
    const sourceKey = `${opts.keyPrefix}:${keyPart}`;
    if (seen.has(sourceKey)) {
      return fail(`duplicate key ${sourceKey} (also row ${seen.get(sourceKey)}). Add a "key" column to tell these posts apart.`);
    }
    seen.set(sourceKey, row);

    posts.push({ row, day, sourceKey, data, sourceSaysPublished, warnings });
  });

  return { posts, errors };
}

/* ---------- applying ---------- */

export type ImportStore = {
  /** Which of these source keys already exist (archived rows included). */
  existingKeys(keys: string[]): Promise<string[]>;
  /** Insert rows, skipping any whose source key already exists. Returns how many were inserted. */
  createMany(rows: (ContentCreateData & { sourceKey: string; createdByName: string })[]): Promise<number>;
};

/** Create the planned rows that do not exist yet. Never updates or deletes anything. */
export async function applyCalendarImport(
  store: ImportStore,
  plan: ImportPlan,
  actorName: string,
): Promise<{ created: number; skipped: string[] }> {
  if (plan.errors.length) throw new Error("The calendar has errors; fix them before importing.");
  if (plan.posts.some((p) => (p.data.status as string) === "PUBLISHED")) {
    throw new Error("Refusing to import a post as Published."); // unreachable by construction; kept as a last line
  }
  const keys = plan.posts.map((p) => p.sourceKey);
  const existing = new Set(keys.length ? await store.existingKeys(keys) : []);
  const fresh = plan.posts.filter((p) => !existing.has(p.sourceKey));
  const created = fresh.length
    ? await store.createMany(fresh.map((p) => ({ ...p.data, sourceKey: p.sourceKey, createdByName: actorName })))
    : 0;
  return { created, skipped: keys.filter((k) => existing.has(k)) };
}
