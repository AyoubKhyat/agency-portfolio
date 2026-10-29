import { prisma, hasPrisma } from "../prisma";

export function db() {
  if (!hasPrisma()) throw new Error("Database not available");
  return prisma;
}
