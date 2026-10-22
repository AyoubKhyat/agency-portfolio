/**
 * Public classification of a portfolio project, stored on Project.kind.
 * CLIENT: real client work. CONCEPT: experimental / demonstration work.
 * Anything unknown is treated as a concept, so nothing is ever mislabelled as
 * client work. Safe to import from client components.
 */
export const PROJECT_KINDS = ["CLIENT", "CONCEPT"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const DEFAULT_PROJECT_KIND: ProjectKind = "CONCEPT";

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  CLIENT: "Client",
  CONCEPT: "Concept",
};

export function isProjectKind(value: unknown): value is ProjectKind {
  return typeof value === "string" && (PROJECT_KINDS as readonly string[]).includes(value);
}

export function isClientProject(project: { kind?: string | null }): boolean {
  return project.kind === "CLIENT";
}
