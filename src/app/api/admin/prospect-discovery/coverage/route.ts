import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { SECTORS, CITIES } from "@/lib/discovery-providers";

/**
 * Coverage stats for the discovery dashboard + Find More button.
 * "Discovered" = prospects in the DB. "Contacted" = sentAt != null. "Remaining" = uncontacted.
 *
 * Identifies low-coverage sectors so the Find More button can pre-fill a sweep
 * with sectors that need the most work.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // Build a lookup from human sector label (what's stored) to canonical key
  const labelToKey = new Map(SECTORS.map((s) => [s.label.toLowerCase(), s.key] as const));

  const prospects = await prisma.prospect.findMany({
    select: { sector: true, neighborhood: true, sentAt: true, status: true },
  });

  const totalDiscovered = prospects.length;
  const totalContacted = prospects.filter((p) => p.sentAt).length;
  const totalRemaining = totalDiscovered - totalContacted;

  // Per-sector
  const bySectorMap = new Map<string, { sector: string; sectorKey: string | null; discovered: number; contacted: number; remaining: number }>();
  for (const p of prospects) {
    const key = p.sector || "Unknown";
    const sectorKey = labelToKey.get(key.toLowerCase()) || null;
    const cur = bySectorMap.get(key) || { sector: key, sectorKey, discovered: 0, contacted: 0, remaining: 0 };
    cur.discovered++;
    if (p.sentAt) cur.contacted++;
    else cur.remaining++;
    bySectorMap.set(key, cur);
  }
  const bySector = Array.from(bySectorMap.values()).sort((a, b) => b.discovered - a.discovered);

  // Per-neighborhood
  const byNbMap = new Map<string, { neighborhood: string; discovered: number; contacted: number; remaining: number }>();
  for (const p of prospects) {
    const key = p.neighborhood || "—";
    const cur = byNbMap.get(key) || { neighborhood: key, discovered: 0, contacted: 0, remaining: 0 };
    cur.discovered++;
    if (p.sentAt) cur.contacted++;
    else cur.remaining++;
    byNbMap.set(key, cur);
  }
  const byNeighborhood = Array.from(byNbMap.values()).sort((a, b) => b.discovered - a.discovered);

  // Low-coverage = sectors in the catalog with < 5 prospects in DB (or 0)
  const seenSectorKeys = new Set(bySector.map((s) => s.sectorKey).filter(Boolean) as string[]);
  const lowCoverageSectors = SECTORS.filter((s) => {
    const stats = bySector.find((b) => b.sectorKey === s.key);
    return !stats || stats.discovered < 5;
  }).map((s) => ({
    key: s.key,
    label: s.label,
    category: s.category,
    discovered: bySector.find((b) => b.sectorKey === s.key)?.discovered ?? 0,
    catalogued: seenSectorKeys.has(s.key),
  })).sort((a, b) => a.discovered - b.discovered);

  // ---------- Sweep history ----------
  const sweeps = await prisma.discoverySweep.findMany({
    where: { status: "COMPLETED" },
    select: { sector: true, neighborhood: true, startedAt: true, resultCount: true, importedCount: true, provider: true },
    orderBy: { startedAt: "desc" },
  });

  // Last-swept date per sector + per (sector, neighborhood)
  const lastSweptBySector = new Map<string, Date>();
  const sweepsBySector = new Map<string, number>();
  for (const s of sweeps) {
    const cur = lastSweptBySector.get(s.sector);
    if (!cur || s.startedAt > cur) lastSweptBySector.set(s.sector, s.startedAt);
    sweepsBySector.set(s.sector, (sweepsBySector.get(s.sector) || 0) + 1);
  }

  // Sectors not yet swept (in catalog but no DiscoverySweep row)
  const sweptSectorKeys = new Set(lastSweptBySector.keys());
  const neverSweptSectors = SECTORS.filter((s) => !sweptSectorKeys.has(s.key)).map((s) => ({
    key: s.key, label: s.label, category: s.category,
  }));

  // Last-swept date per sector list
  const sectorSweepStats = SECTORS.map((s) => ({
    key: s.key,
    label: s.label,
    category: s.category,
    sweepsRun: sweepsBySector.get(s.key) || 0,
    lastSweptAt: lastSweptBySector.get(s.key)?.toISOString() || null,
    daysSinceSwept: lastSweptBySector.has(s.key)
      ? Math.floor((Date.now() - lastSweptBySector.get(s.key)!.getTime()) / 86_400_000)
      : null,
  }));

  // Marrakech coverage % — fraction of catalog sectors that have at least one sweep recorded
  const marrakechSweeps = sweeps.filter((s) => s.sector); // all sweeps for now (DiscoverySweep doesn't track city in this slice)
  const marrakechSectorsSwept = new Set(marrakechSweeps.map((s) => s.sector)).size;
  const sectorCoveragePct = SECTORS.length > 0
    ? Math.round((marrakechSectorsSwept / SECTORS.length) * 1000) / 10
    : 0;

  // Recent sweeps for the activity timeline (last 30)
  const recentSweeps = sweeps.slice(0, 30).map((s) => ({
    sector: s.sector,
    neighborhood: s.neighborhood,
    startedAt: s.startedAt.toISOString(),
    resultCount: s.resultCount,
    importedCount: s.importedCount,
    provider: s.provider,
  }));

  return NextResponse.json({
    totals: {
      discovered: totalDiscovered,
      contacted: totalContacted,
      remaining: totalRemaining,
      contactRate: totalDiscovered > 0 ? Math.round((totalContacted / totalDiscovered) * 1000) / 10 : 0,
    },
    bySector,
    byNeighborhood,
    lowCoverageSectors,
    catalog: {
      totalSectors: SECTORS.length,
      totalCities: CITIES.length,
    },
    sweep: {
      sectorCoveragePct,
      sectorsSwept: marrakechSectorsSwept,
      neverSweptSectors,
      sectorSweepStats: sectorSweepStats.sort((a, b) => {
        if (a.lastSweptAt && !b.lastSweptAt) return -1;
        if (!a.lastSweptAt && b.lastSweptAt) return 1;
        if (a.lastSweptAt && b.lastSweptAt) return b.lastSweptAt.localeCompare(a.lastSweptAt);
        return a.label.localeCompare(b.label);
      }),
      recentSweeps,
      totalSweeps: sweeps.length,
    },
  });
}
