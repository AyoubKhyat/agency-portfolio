/** Roles are compared in one canonical form: trimmed, lower-case. Unknown roles grant nothing. */
export function normalizeRole(role: unknown): string {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}
