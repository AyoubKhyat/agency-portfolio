import { PrismaClient } from "@prisma/client";
import { Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null; initialized: boolean };

function createClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) return null;
  try {
    const pool = new Pool({ connectionString: url });
    // @ts-expect-error PrismaNeon types expect string but Pool works at runtime
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
