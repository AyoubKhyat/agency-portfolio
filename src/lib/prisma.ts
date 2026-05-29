import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

function createClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[prisma] DATABASE_URL not set");
    return null;
  }
  try {
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  } catch (e) {
    console.error("[prisma] Failed to create client:", e);
    return null;
  }
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production" && prisma) globalForPrisma.prisma = prisma;
