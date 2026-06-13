import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const checkSchema = z.object({
  city: z.string().min(1),
  queries: z.array(z.object({
    sector: z.string(),
    neighborhood: z.string().nullable().optional(),
  })).min(1).max(1000),
  withinDays: z.number().int().min(1).max(90).default(7),
});

// Returns which (sector, neighborhood) tuples in the proposed batch were
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

  // One DB roundtrip for all matches in this city since the cutoff
  const recent = await prisma.discoverySweep.findMany({
    where: {
      city: parsed.data.city,
      startedAt: { gte: cutoff },
      status: "COMPLETED",
    },
    select: {
      sector: true,
      neighborhood: true,
      startedAt: true,
      resultCount: true,
      importedCount: true,
    },
  });

  // Build a lookup: "sector|nb" → most recent sweep
  const lookup = new Map<string, { startedAt: Date; resultCount: number; importedCount: number }>();
  for (const r of recent) {
    const key = `${r.sector}|${r.neighborhood || ""}`;
    const cur = lookup.get(key);
    if (!cur || r.startedAt > cur.startedAt) {
      lookup.set(key, { startedAt: r.startedAt, resultCount: r.resultCount, importedCount: r.importedCount });
    }
  }

  const matches: Array<{ sector: string; neighborhood: string | null; lastSweptAt: string; daysAgo: number; resultCount: number; importedCount: number }> = [];
  const staleQueries: Array<{ sector: string; neighborhood: string | null }> = [];

  for (const q of parsed.data.queries) {
    const key = `${q.sector}|${q.neighborhood || ""}`;
    const hit = lookup.get(key);
    if (hit) {
      const daysAgo = Math.floor((Date.now() - hit.startedAt.getTime()) / 86_400_000);
      matches.push({
        sector: q.sector,
        neighborhood: q.neighborhood ?? null,
        lastSweptAt: hit.startedAt.toISOString(),
        daysAgo,
        resultCount: hit.resultCount,
        importedCount: hit.importedCount,
      });
    } else {
      staleQueries.push({ sector: q.sector, neighborhood: q.neighborhood ?? null });
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
