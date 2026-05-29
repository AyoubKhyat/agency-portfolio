import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

let _prisma: PrismaClient | null | undefined;

function getClient(): PrismaClient | null {
  if (_prisma !== undefined) return _prisma;

  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) {
    _prisma = null;
    return null;
  }
  try {
    const adapter = new PrismaNeon({ connectionString: url });
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
