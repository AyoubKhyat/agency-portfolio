import { db } from "./db";

// ─── Users ──────────────────────────────────────────────────────

export async function getUsers() {
  return db().user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarInitials: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getUserById(id: string) {
  return db().user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarInitials: true,
      isActive: true,
      createdAt: true,
    },
  });
}
