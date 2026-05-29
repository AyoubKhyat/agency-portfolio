import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null; initialized: boolean };

function createClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) return null;
  try {
    // Dynamic import to avoid bundling issues - Neon serverless adapter
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter });
  } catch (e) {
    console.error("[prisma] Failed to create client:", e);
    return null;
  }
}

if (!globalForPrisma.initialized) {
  globalForPrisma.prisma = createClient();
  globalForPrisma.initialized = true;
}

export const prisma = globalForPrisma.prisma;
