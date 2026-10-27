import bcrypt from "bcryptjs";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma, hasPrisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/roles";

export { normalizeRole };

const COOKIE_NAME = "admin_token";
const ISSUER = "ibda3digital";

/**
 * Every token this app issues is bound to one purpose. Each purpose has its own `typ` header,
 * its own audience and its own key (derived from JWT_SECRET), so a token minted for one purpose
 * — e.g. a public contract-signing link — can never verify as another, such as an admin session.
 */
const PURPOSES = {
  session: { typ: "admin-session+jwt", audience: "ibda3-admin" },
  contractSign: { typ: "contract-sign+jwt", audience: "ibda3-contract-sign" },
} as const;
type Purpose = keyof typeof PURPOSES;

const MIN_SECRET_LENGTH = 32;

/** Key for one purpose, or null when JWT_SECRET is missing or too short (no fallback secret). */
function keyFor(purpose: Purpose): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    console.error("[auth] JWT_SECRET is missing or shorter than 32 characters; tokens are disabled.");
    return null;
  }
  return new Uint8Array(createHmac("sha256", secret).update(`ibda3:jwt:${purpose}:v1`).digest());
}

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

async function signFor(purpose: Purpose, subject: string, claims: Record<string, unknown>, expiresIn: string) {
  const key = keyFor(purpose);
  if (!key) throw new Error("JWT_SECRET is not configured");
  const { typ, audience } = PURPOSES[purpose];
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ })
    .setSubject(subject)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

/** Verified claims for one purpose, or null on any failure (signature, typ, audience, issuer, expiry). */
async function verifyFor(purpose: Purpose, token: string) {
  const key = keyFor(purpose);
  if (!key) return null;
  const { typ, audience } = PURPOSES[purpose];
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], typ, audience, issuer: ISSUER });
    return payload;
  } catch {
    return null;
  }
}

const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * Sessions are bound to the login password: the token carries a keyed fingerprint of the current
 * password hash, so setting a new password ends every existing session of that user. The
 * fingerprint reveals nothing about the hash without JWT_SECRET.
 */
function passwordStamp(passwordHash: string): string | null {
  const key = keyFor("session");
  return key ? createHmac("sha256", key).update(`pwd:${passwordHash}`).digest("base64url").slice(0, 22) : null;
}

export async function signToken(user: SessionUser, passwordHash: string) {
  const { userId, email, fullName, role, avatarInitials } = user;
  if (!isText(userId)) throw new Error("A session needs a userId");
  const pwd = isText(passwordHash) ? passwordStamp(passwordHash) : null;
  if (!pwd) throw new Error("A session needs the current password hash");
  return signFor("session", userId, { userId, email, fullName, role, avatarInitials, pwd }, "7d");
}

async function readSessionToken(token: string): Promise<{ user: SessionUser; pwd: string } | null> {
  const p = await verifyFor("session", token);
  if (!p) return null;
  const { userId, email, fullName, role, avatarInitials, pwd } = p;
  if (!isText(userId) || p.sub !== userId || !isText(email) || !isText(role) || !isText(pwd)) return null;
  if (typeof fullName !== "string" || typeof avatarInitials !== "string") return null;
  return { user: { userId, email, fullName, role, avatarInitials }, pwd };
}

/** A session token's user, or null unless every claim is present and well-formed. */
export async function verifyToken(token: string): Promise<SessionUser | null> {
  return (await readSessionToken(token))?.user ?? null;
}

/** Public contract-signing link token. It is only accepted by /api/sign/[token]. */
export async function signContractToken(contractId: string) {
  if (!isText(contractId)) throw new Error("A signing token needs a contractId");
  return signFor("contractSign", contractId, { contractId }, "7d");
}

export async function verifyContractToken(token: string): Promise<{ contractId: string } | null> {
  const p = await verifyFor("contractSign", token);
  if (!p || !isText(p.contractId) || p.sub !== p.contractId) return null;
  return { contractId: p.contractId };
}

/**
 * Decode the cookie and return the session. Fails closed: the token must be a valid admin-session
 * token, its `userId` must point at an active `User` row with the same email, and that email's
 * login password must be the one the session was issued for. No database, a database error or
 * any mismatch all mean "no session".
 *
 * Role, name and initials come from the database on every request, never from the token, so a
 * role change applies immediately.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const read = await readSessionToken(token);
    if (!read || !hasPrisma()) return null;
    const { user: payload, pwd } = read;

    const [user, login] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, isActive: true, role: true, fullName: true, avatarInitials: true },
      }),
      prisma.adminUser.findUnique({ where: { email: payload.email }, select: { passwordHash: true } }),
    ]);
    if (!user?.isActive || user.email !== payload.email || !login) return null;
    if (passwordStamp(login.passwordHash) !== pwd) return null;
    return { ...payload, role: normalizeRole(user.role), fullName: user.fullName, avatarInitials: user.avatarInitials };
  } catch (e) {
    console.error("[auth] session check failed; denying access:", e instanceof Error ? e.name : "error");
    return null;
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
