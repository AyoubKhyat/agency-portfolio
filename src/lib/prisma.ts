import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null; initialized: boolean };

function createClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch (e) {
    console.error("[prisma] Failed:", e);
    return null;
  }
}

if (!globalForPrisma.initialized) {
  globalForPrisma.prisma = createClient();
  globalForPrisma.initialized = true;
}

export const prisma = globalForPrisma.prisma;
