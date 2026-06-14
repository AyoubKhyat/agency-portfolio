import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const checkSchema = z.object({
  // Legacy: a single city + queries without per-query city.
  city: z.string().min(1).optional(),
  // New: explicit cities array. When set, queries may include per-query `city`.
  cities: z.array(z.string().min(1)).min(1).max(50).optional(),
  queries: z.array(z.object({
    city: z.string().optional(),
    sector: z.string(),
    neighborhood: z.string().nullable().optional(),
  })).min(1).max(1000),
  withinDays: z.number().int().min(1).max(90).default(7),
}).refine((d) => d.city || (d.cities && d.cities.length > 0) || d.queries.every((q) => !!q.city), {
  message: "Provide `city`, `cities`, or include `city` on every query",
});

// Returns which (city, sector, neighborhood) tuples in the proposed batch were
// already swept successfully within the last N days. Used to skip redundant work.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ matches: [], staleQueries: [] });

  const parsed = checkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - parsed.data.withinDays * 86_400_000);

  // Resolve the set of cities to scan in the DB
  const cityScope = new Set<string>();
  if (parsed.data.cities) parsed.data.cities.forEach((c) => cityScope.add(c));
  if (parsed.data.city) cityScope.add(parsed.data.city);
  parsed.data.queries.forEach((q) => { if (q.city) cityScope.add(q.city); });

  // One DB roundtrip for all matches in these cities since the cutoff
  const recent = await prisma.discoverySweep.findMany({
    where: {
      city: { in: Array.from(cityScope) },
      startedAt: { gte: cutoff },
      status: "COMPLETED",
    },
    select: {
      city: true,
      sector: true,
      neighborhood: true,
      startedAt: true,
      resultCount: true,
      importedCount: true,
    },
  });

  // Build a lookup: "city|sector|nb" → most recent sweep
  const lookup = new Map<string, { city: string; startedAt: Date; resultCount: number; importedCount: number }>();
  for (const r of recent) {
    const key = `${r.city}|${r.sector}|${r.neighborhood || ""}`;
    const cur = lookup.get(key);
    if (!cur || r.startedAt > cur.startedAt) {
      lookup.set(key, { city: r.city, startedAt: r.startedAt, resultCount: r.resultCount, importedCount: r.importedCount });
    }
  }

  const matches: Array<{ city: string; sector: string; neighborhood: string | null; lastSweptAt: string; daysAgo: number; resultCount: number; importedCount: number }> = [];
  const staleQueries: Array<{ city: string; sector: string; neighborhood: string | null }> = [];

  for (const q of parsed.data.queries) {
    const cityKey = q.city || parsed.data.city || (parsed.data.cities && parsed.data.cities[0]);
    if (!cityKey) continue;
    const key = `${cityKey}|${q.sector}|${q.neighborhood || ""}`;
    const hit = lookup.get(key);
    if (hit) {
      const daysAgo = Math.floor((Date.now() - hit.startedAt.getTime()) / 86_400_000);
      matches.push({
        city: cityKey,
        sector: q.sector,
        neighborhood: q.neighborhood ?? null,
        lastSweptAt: hit.startedAt.toISOString(),
        daysAgo,
        resultCount: hit.resultCount,
        importedCount: hit.importedCount,
      });
    } else {
      staleQueries.push({ city: cityKey, sector: q.sector, neighborhood: q.neighborhood ?? null });
    }
  }

  return NextResponse.json({
    withinDays: parsed.data.withinDays,
    matches,            // already swept recently — skip these by default
    staleQueries,       // not swept recently — needs running
    summary: {
      total: parsed.data.queries.length,
      recentlySwept: matches.length,
      toRun: staleQueries.length,
    },
  });
}
