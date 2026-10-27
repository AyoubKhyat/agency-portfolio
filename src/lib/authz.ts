import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";

/**
 * Central authorization for API routes. Three tiers:
 *   team  — any active team member with a valid session (getSession re-checks the database)
 *   admin — a team member whose CURRENT database role is "admin"
 *   owner — the User row named by OWNER_USER_ID, verified in the database (see isOwner)
 * Usage in a route handler:
 *   const auth = await requireOwner();
 *   if (auth.response) return auth.response;
 *   const { session } = auth;
 */
export type Guard = { session: SessionUser; response?: undefined } | { session?: undefined; response: NextResponse };

const deny = (status: 401 | 403, error: string): Guard => ({ response: NextResponse.json({ error }, { status }) });

/** True when the session's role (already the normalised database role) is admin. */
export function isAdmin(session: Pick<SessionUser, "role"> | null | undefined): boolean {
  return !!session && normalizeRole(session.role) === "admin";
}

export async function requireTeam(): Promise<Guard> {
  const session = await getSession();
  return session ? { session } : deny(401, "Unauthorized");
}

export async function requireAdmin(): Promise<Guard> {
  const session = await getSession();
  if (!session) return deny(401, "Unauthorized");
  return isAdmin(session) ? { session } : deny(403, "Admin only");
}

export async function requireOwner(): Promise<Guard> {
  const session = await getSession();
  if (!session) return deny(401, "Unauthorized");
  const { isOwner } = await import("@/lib/account-security"); // loaded only where owner checks run
  return (await isOwner(session)) ? { session } : deny(403, "Only the account owner can do this");
}
