import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

/** Neon needs its serverless driver; any other Postgres (the VPS) uses the standard pg driver. */
export function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

let _prisma: PrismaClient | null | undefined;

function getClient(): PrismaClient | null {
  if (_prisma !== undefined) return _prisma;

  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) {
    _prisma = null;
    return null;
  }
  try {
    const adapter = isNeonUrl(url)
      ? new PrismaNeon({ connectionString: url })
      : new PrismaPg({ connectionString: url });
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
