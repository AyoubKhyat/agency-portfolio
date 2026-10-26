import { prisma, hasPrisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, type SessionUser } from "@/lib/auth";

export const MIN_PASSWORD_LENGTH = 12;

/**
 * The owner is the `User` row whose primary key equals OWNER_USER_ID (server configuration, never
 * taken from the request). Row ids are immutable and no API can change them, unlike emails or the
 * role cached in the session token. The row must still exist, be active and keep the same email as
 * the session. Unset or unknown OWNER_USER_ID → nobody is owner (owner-only actions fail closed).
 */
export async function isOwner(session: SessionUser | null): Promise<boolean> {
  const ownerId = process.env.OWNER_USER_ID?.trim();
  if (!session || !ownerId || session.userId !== ownerId || !hasPrisma()) return false;
  try {
    const row = await prisma.user.findUnique({ where: { id: ownerId }, select: { email: true, isActive: true } });
    return !!row?.isActive && row.email === session.email;
  } catch {
    return false;
  }
}

/** True when `plain` is the account's current LOGIN password (admin_users, which the login checks). */
export async function checkLoginPassword(email: string, plain: string): Promise<boolean> {
  const login = await prisma.adminUser.findUnique({ where: { email }, select: { passwordHash: true } });
  return !!login && (await verifyPassword(plain, login.passwordHash));
}

/**
 * Set a team member's password where the login actually reads it (admin_users) and keep the copy
 * on users in step, in one transaction. A new hash also ends every session of that user, because
 * sessions are bound to the password hash (see getSession). Returns the new hash, or null when the
 * user has no login account.
 */
export async function setLoginPassword(userId: string, newPassword: string): Promise<string | null> {
  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return null;
    const login = await tx.adminUser.updateMany({ where: { email: user.email }, data: { passwordHash } });
    if (login.count !== 1) return null;
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    return passwordHash;
  });
}

const PUBLIC_USER = { id: true, fullName: true, email: true, role: true, avatarInitials: true, isActive: true, createdAt: true } as const;

/** Profile, email, role and active-flag changes. An email change moves the login row with it. */
export async function updateTeamUser(id: string, data: {
  fullName?: string;
  email?: string;
  role?: string;
  avatarInitials?: string;
  isActive?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id }, select: { email: true } });
    if (!before) return null;
    if (data.email !== undefined && data.email !== before.email) {
      await tx.adminUser.updateMany({ where: { email: before.email }, data: { email: data.email } });
    }
    return tx.user.update({ where: { id }, data, select: PUBLIC_USER });
  });
}
