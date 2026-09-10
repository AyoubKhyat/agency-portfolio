import { z } from "zod";

/* ============================================================
 * ClientProject delivery statuses — single source of truth.
 *
 * Scope: the CLIENT DELIVERY pipeline (`ClientProject`, surfaced
 * at /admin/pipeline). This is NOT the public portfolio model —
 * that one is `Project`, and its statuses live in
 * `src/components/admin/project-status-badge.tsx`. Keep the two
 * apart; they share neither values nor meaning.
 *
 * These are the statuses the pipeline already uses. Before this
 * module existed the list was duplicated in the pipeline board
 * and contradicted by a second, different list on the client
 * detail page, so the same project rendered under two different
 * names. Everything now reads from here.
 * ============================================================ */

export const CLIENT_PROJECT_STATUSES = [
  "NEW",
  "DISCOVERY",
  "DESIGN",
  "DEVELOPMENT",
  "REVIEW",
  "CLIENT_FEEDBACK",
  "READY_TO_LAUNCH",
  "LIVE",
  "COMPLETED",
  "ON_HOLD",
] as const;

export type ClientProjectStatus = (typeof CLIENT_PROJECT_STATUSES)[number];

/**
 * Statuses that take a project off the active board.
 *
 * NOTE: the dashboards (command-center, executive, system-status) still
 * inline these two values, including inside raw SQL. They were left alone
 * deliberately so this change carries no behavioural risk. Anyone adding a
 * new terminal status (CANCELLED, say) must update those call sites too —
 * `rg '"COMPLETED", "ON_HOLD"'` finds them.
 */
export const INACTIVE_CLIENT_PROJECT_STATUSES: readonly ClientProjectStatus[] = [
  "COMPLETED",
  "ON_HOLD",
];

export const CLIENT_PROJECT_STATUS_LABELS: Record<ClientProjectStatus, string> = {
  NEW: "New",
  DISCOVERY: "Discovery",
  DESIGN: "Design",
  DEVELOPMENT: "Development",
  REVIEW: "Review",
  CLIENT_FEEDBACK: "Feedback",
  READY_TO_LAUNCH: "Launch Ready",
  LIVE: "Live",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

/** Kanban column styling for the pipeline board. */
export const CLIENT_PROJECT_STATUS_COLUMN: Record<
  ClientProjectStatus,
  { border: string; bg: string; dot: string }
> = {
  NEW: { border: "border-blue-200", bg: "bg-blue-50/40", dot: "bg-blue-500" },
  DISCOVERY: { border: "border-violet-200", bg: "bg-violet-50/40", dot: "bg-violet-500" },
  DESIGN: { border: "border-pink-200", bg: "bg-pink-50/40", dot: "bg-pink-500" },
  DEVELOPMENT: { border: "border-amber-200", bg: "bg-amber-50/40", dot: "bg-amber-500" },
  REVIEW: { border: "border-cyan-200", bg: "bg-cyan-50/40", dot: "bg-cyan-500" },
  CLIENT_FEEDBACK: { border: "border-orange-200", bg: "bg-orange-50/40", dot: "bg-orange-500" },
  READY_TO_LAUNCH: { border: "border-emerald-200", bg: "bg-emerald-50/40", dot: "bg-emerald-500" },
  LIVE: { border: "border-green-200", bg: "bg-green-50/40", dot: "bg-green-600" },
  COMPLETED: { border: "border-emerald-200", bg: "bg-emerald-50/30", dot: "bg-emerald-600" },
  ON_HOLD: { border: "border-red-200", bg: "bg-red-50/40", dot: "bg-red-400" },
};

/** Inline pill styling, for lists that show a status next to other metadata. */
export const CLIENT_PROJECT_STATUS_PILL: Record<ClientProjectStatus, string> = {
  NEW: "text-blue-700 bg-blue-50 border-blue-100",
  DISCOVERY: "text-violet-700 bg-violet-50 border-violet-100",
  DESIGN: "text-pink-700 bg-pink-50 border-pink-100",
  DEVELOPMENT: "text-amber-700 bg-amber-50 border-amber-100",
  REVIEW: "text-cyan-700 bg-cyan-50 border-cyan-100",
  CLIENT_FEEDBACK: "text-orange-700 bg-orange-50 border-orange-100",
  READY_TO_LAUNCH: "text-emerald-700 bg-emerald-50 border-emerald-100",
  LIVE: "text-green-700 bg-green-50 border-green-100",
  COMPLETED: "text-emerald-700 bg-emerald-50 border-emerald-100",
  ON_HOLD: "text-[#6B7280] bg-[#F3F4F6] border-[#E5E7EB]",
};

/* ---------- lookups ---------- */

export function isClientProjectStatus(value: unknown): value is ClientProjectStatus {
  return (
    typeof value === "string" &&
    (CLIENT_PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Human label for a status. Rows written before this validation existed may
 * hold a value outside the list (the old schema accepted any string), so an
 * unknown value is humanised rather than dropped — showing "Maintenance"
 * beats showing nothing.
 */
export function clientProjectStatusLabel(value: string | null | undefined): string {
  if (!value) return CLIENT_PROJECT_STATUS_LABELS.NEW;
  if (isClientProjectStatus(value)) return CLIENT_PROJECT_STATUS_LABELS[value];
  return value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export function clientProjectStatusColumn(value: string | null | undefined) {
  return isClientProjectStatus(value)
    ? CLIENT_PROJECT_STATUS_COLUMN[value]
    : CLIENT_PROJECT_STATUS_COLUMN.NEW;
}

export function clientProjectStatusPill(value: string | null | undefined): string {
  return isClientProjectStatus(value)
    ? CLIENT_PROJECT_STATUS_PILL[value]
    : CLIENT_PROJECT_STATUS_PILL.NEW;
}

export function isActiveClientProjectStatus(value: string | null | undefined): boolean {
  return !INACTIVE_CLIENT_PROJECT_STATUSES.includes(value as ClientProjectStatus);
}

/* ---------- validation ---------- */

/**
 * The schema every write path must use. `status` was previously `z.string()`
 * on all three routes, so a typo ("DEVELOPEMENT") persisted silently and then
 * vanished from the board, since the column only renders known statuses.
 */
export const clientProjectStatusSchema = z.enum(
  CLIENT_PROJECT_STATUSES,
  `Status must be one of: ${CLIENT_PROJECT_STATUSES.join(", ")}`,
);
