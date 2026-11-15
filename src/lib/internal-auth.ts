import { createHash, timingSafeEqual } from "node:crypto";

const digest = (v: string) => createHash("sha256").update(v).digest();

/** True when the request carries the shared server-to-server key (INTERNAL_API_KEY, 32+ characters). */
export function hasInternalKey(req: Request): boolean {
  const key = process.env.INTERNAL_API_KEY;
  if (!key || key.length < 32) return false;
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  return timingSafeEqual(digest(given), digest(key));
}
