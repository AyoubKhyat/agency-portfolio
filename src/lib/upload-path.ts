import path from "path";

const ALLOWED = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Absolute file path for a public upload URL segment list, or null when it is not a plain
 * `projects/<name>.webp` inside `uploadDir` (no traversal, no hidden files, webp only).
 */
export function resolveUploadPath(uploadDir: string, segments: string[]): string | null {
  if (segments.length !== 2 || segments[0] !== "projects") return null;
  const name = segments[1];
  if (!ALLOWED.test(name) || !name.endsWith(".webp") || name.includes("..")) return null;
  const root = path.resolve(uploadDir);
  const file = path.resolve(root, "projects", name);
  return file.startsWith(root + path.sep) ? file : null;
}
