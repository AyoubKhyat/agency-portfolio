import { PrismaClient } from "@prisma/client";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

neonConfig.useSecureWebSocket = true;

let _prisma: PrismaClient | null | undefined;

function getClient(): PrismaClient | null {
  if (_prisma !== undefined) return _prisma;

  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) {
    _prisma = null;
    return null;
  }
  try {
    const pool = new Pool({ connectionString: url });
    // @ts-expect-error PrismaNeon accepts Pool at runtime
    const adapter = new PrismaNeon(pool);
    _prisma = new PrismaClient({ adapter });
    return _prisma;
  } catch (e) {
    console.error("[prisma] Failed:", e);
    _prisma = null;
    return null;
  }
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    if (!client) return undefined;
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function hasPrisma(): boolean {
  return getClient() !== null;
}
