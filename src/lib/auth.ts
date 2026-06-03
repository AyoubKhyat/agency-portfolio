import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma, hasPrisma } from "@/lib/prisma";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === "production") {
  console.error("[auth] CRITICAL: JWT_SECRET not set in production!");
}
const SECRET = new TextEncoder().encode(jwtSecret || "fallback-dev-secret-do-not-use-in-prod");

const COOKIE_NAME = "admin_token";

export type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  avatarInitials: string;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function signToken(payload: SessionUser) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Decode the cookie and return the session.
 *
 * Crucially: every call also validates that `userId` still points at a real
 * `User` row. Tokens issued before the login-userId fix carry `adminUser.id`,
 * which is NOT a valid User foreign-key target — any subsequent attempt to
 * write `ProspectActivity.userId` (which has a hard FK to User) would crash
 * with `prospect_activities_user_id_fkey`. When the fast path fails, we fall
 * back to looking up the User by email and return the session with the
 * corrected userId. If neither lookup matches an active user, the session is
 * rejected so the caller forces a re-login instead of attempting bad writes.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // If the DB isn't reachable, fall back to the raw token rather than break auth
  // entirely. The activity-writing paths will surface their own error.
  if (!hasPrisma()) return payload;

  try {
    // Fast path: token already points at a valid User row.
    const byId = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, fullName: true, avatarInitials: true, isActive: true },
    });
    if (byId?.isActive) return payload;

    // Slow path (stale token): repair by email lookup.
    const byEmail = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, fullName: true, avatarInitials: true, isActive: true },
    });
    if (byEmail?.isActive) {
      return {
        ...payload,
        userId: byEmail.id,
        fullName: byEmail.fullName,
        avatarInitials: byEmail.avatarInitials,
      };
    }

    // No matching User → refuse the session.
    return null;
  } catch {
    // Don't lock everyone out on a transient DB hiccup.
    return payload;
  }
}

export function createSessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function deleteSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
