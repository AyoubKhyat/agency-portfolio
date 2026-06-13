"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Play, Pause, CheckCircle2, AlertCircle, Compass, ExternalLink,
  Zap, FastForward, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeQualityLabel, channelFlags, type QualityLabel } from "@/lib/prospect-quality";

type Sector = { key: string; label: string; category: string };
type Neighborhood = string;

type SearchItem = {
  sourceId: string;
  source: "GOOGLE" | "OSM";
  name: string;
  sector: string;
  city: string;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  duplicateStatus: "EXISTS" | "POSSIBLE" | "NEW";
  duplicateOf: string | null;
  duplicateReason: string | null;
};

type Aggregated = SearchItem & {
  email?: string | null;
  sweepSectorKey: string;
  sweepNeighborhood: string | null;
  opportunityScore: number;
  qualityLabel: QualityLabel;
};

type ChannelFilter = "whatsapp" | "instagram" | "website" | "email" | "phone";
type ImportTier = "HOT_ONLY" | "HOT_WARM" | "ALL";

const QUALITY_BADGE: Record<QualityLabel, string> = {
  HOT: "bg-rose-50 text-rose-700 border-rose-200",
  WARM: "bg-amber-50 text-amber-700 border-amber-200",
  COLD: "bg-gray-100 text-gray-600 border-gray-200",
};

type SweepProgress = {
  total: number;
  completed: number;
  currentLabel: string;
  errors: number;
};

// Pacing varies by provider — Google Places allows much higher QPS.
const PACING_OSM_MS = 1000;
const PACING_GOOGLE_MS = 250;
const MAX_QUERIES = 500;

// Priority sectors from the spec (in order of importance).
const PRIORITY_SECTORS = [
  "RESTAURANTS", "CAFES", "RIADS", "HOTELS", "CLINICS", "DENTISTS",
  "BEAUTY", "SPAS", "REAL_ESTATE", "CAR_RENTAL", "PRIVATE_SCHOOLS", "GYMS",
];

type SweepCheckResult = {
  withinDays: number;
  matches: Array<{ sector: string; neighborhood: string | null; lastSweptAt: string; daysAgo: number; resultCount: number; importedCount: number }>;
  staleQueries: Array<{ sector: string; neighborhood: string | null }>;
  summary: { total: number; recentlySwept: number; toRun: number };
};

function computeOpportunityScore(item: SearchItem): number {
  let s = 50;
  if (!item.website) s += 30;
  if (!item.instagram) s += 15;
  if (!item.phone) s += 10;
  if (item.rating === null || item.rating === undefined) s += 5;
  // Already-successful businesses are slightly less likely to bite
  if (item.rating && item.rating > 4.5 && (item.reviewCount ?? 0) > 50) s -= 10;
  return Math.max(0, Math.min(100, s));
}

export function BulkSweepTab({
  city,
  sectors,
  neighborhoods,
  prefillSectors,
  providerName,
}: {
  city: string;
  sectors: Sector[];
  neighborhoods: Neighborhood[];
  prefillSectors?: string[];
  providerName: "GOOGLE" | "OSM";
}) {
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set(prefillSectors || []));
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(new Set());
  const [includeCityWide, setIncludeCityWide] = useState(true); // also search whole city (no neighborhood filter)

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SweepProgress | null>(null);
  const [results, setResults] = useState<Aggregated[]>([]);
  const [errors, setErrors] = useState<Array<{ sector: string; neighborhood: string | null; message: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [sweepCheck, setSweepCheck] = useState<SweepCheckResult | null>(null);
  const [checkingSweeps, setCheckingSweeps] = useState(false);
  const [skipRecent, setSkipRecent] = useState(true);
  const [sweepDone, setSweepDone] = useState(false);

  const cancelRef = useRef(false);
  const pacingMs = providerName === "GOOGLE" ? PACING_GOOGLE_MS : PACING_OSM_MS;

  // Quality filters (apply to displayed + imported results)
  const [contactableOnly, setContactableOnly] = useState(true);
  const [requiredChannels, setRequiredChannels] = useState<Set<ChannelFilter>>(new Set());
  const [importTier, setImportTier] = useState<ImportTier>("HOT_ONLY");

  function toggleChannelFilter(c: ChannelFilter) {
    setRequiredChannels((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }

  // Sync prefill when parent passes new sectors
  useEffect(() => {
    if (prefillSectors && prefillSectors.length > 0) setSelectedSectors(new Set(prefillSectors));
  }, [prefillSectors]);

  // Group sectors by category for the selector UI
  const sectorsByCategory = useMemo(() => {
    const map = new Map<string, Sector[]>();
    for (const s of sectors) {
      (map.get(s.category) || map.set(s.category, []).get(s.category)!).push(s);
    }
    return Array.from(map.entries());
  }, [sectors]);

  function toggleSector(k: string) {
    setSelectedSectors((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  function toggleNeighborhood(n: string) {
    setSelectedNeighborhoods((p) => { const next = new Set(p); next.has(n) ? next.delete(n) : next.add(n); return next; });
  }
  function selectAllSectors() { setSelectedSectors(new Set(sectors.map((s) => s.key))); }
  function clearSectors() { setSelectedSectors(new Set()); }
  function selectAllNeighborhoods() { setSelectedNeighborhoods(new Set(neighborhoods)); }
  function clearNeighborhoods() { setSelectedNeighborhoods(new Set()); }

  // Presets
  function presetPriority() {
    const valid = new Set(sectors.map((s) => s.key));
    setSelectedSectors(new Set(PRIORITY_SECTORS.filter((k) => valid.has(k))));
    setSelectedNeighborhoods(new Set());
    setIncludeCityWide(true);
  }
  function presetSecondary() {
    const priority = new Set(PRIORITY_SECTORS);
    setSelectedSectors(new Set(sectors.filter((s) => !priority.has(s.key)).map((s) => s.key)));
    setSelectedNeighborhoods(new Set());
    setIncludeCityWide(true);
  }
  function presetFullMarrakech() {
    setSelectedSectors(new Set(sectors.map((s) => s.key)));
    setSelectedNeighborhoods(new Set());
    setIncludeCityWide(true);
  }
  function selectCategorySectors(cat: string) {
    setSelectedSectors((p) => {
      const n = new Set(p);
      const inCat = sectors.filter((s) => s.category === cat);
      const allOn = inCat.every((s) => n.has(s.key));
      for (const s of inCat) allOn ? n.delete(s.key) : n.add(s.key);
      return n;
    });
  }

  // Build the query list (sector × neighborhood, optionally + city-wide)
  const queryList = useMemo(() => {
    const sectorKeys = Array.from(selectedSectors);
    const nbList = Array.from(selectedNeighborhoods);
    const queries: { sector: string; neighborhood: string | null }[] = [];
    for (const sec of sectorKeys) {
      if (includeCityWide || nbList.length === 0) queries.push({ sector: sec, neighborhood: null });
      for (const nb of nbList) queries.push({ sector: sec, neighborhood: nb });
    }
    return queries;
  }, [selectedSectors, selectedNeighborhoods, includeCityWide]);

  // Pre-check sweep history (debounced) when selection changes
  useEffect(() => {
    if (queryList.length === 0) { setSweepCheck(null); return; }
    setCheckingSweeps(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/prospect-discovery/sweeps/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city, queries: queryList, withinDays: 7 }),
        });
        if (res.ok) setSweepCheck(await res.json());
      } finally {
        setCheckingSweeps(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [queryList, city]);

  // Effective queries = full list, filtered by skipRecent if pre-check has matches
  const effectiveQueries = useMemo(() => {
    if (!skipRecent || !sweepCheck || sweepCheck.matches.length === 0) return queryList;
    const skipSet = new Set(sweepCheck.matches.map((m) => `${m.sector}|${m.neighborhood || ""}`));
    return queryList.filter((q) => !skipSet.has(`${q.sector}|${q.neighborhood || ""}`));
  }, [queryList, sweepCheck, skipRecent]);

  const estimatedSeconds = Math.round((effectiveQueries.length * pacingMs) / 1000);
  const tooMany = effectiveQueries.length > MAX_QUERIES;

  async function startSweep() {
    if (running || effectiveQueries.length === 0 || tooMany) return;
    cancelRef.current = false;
    setRunning(true);
    setResults([]);
    setErrors([]);
    setImportResult(null);
    setSweepDone(false);
    setProgress({ total: effectiveQueries.length, completed: 0, currentLabel: "", errors: 0 });

    const accumulated = new Map<string, Aggregated>();
    let errorCount = 0;
    const localErrors: typeof errors = [];

    for (let i = 0; i < effectiveQueries.length; i++) {
      if (cancelRef.current) break;
      const q = effectiveQueries[i];
      const label = sectors.find((s) => s.key === q.sector)?.label || q.sector;
      const place = q.neighborhood ? `${label} · ${q.neighborhood}` : `${label} · all areas`;
      setProgress({ total: effectiveQueries.length, completed: i, currentLabel: place, errors: errorCount });

      const queryStartedAt = new Date();
      let queryStatus: "COMPLETED" | "FAILED" = "COMPLETED";
      let queryError: string | null = null;
      let queryResultCount = 0;
      let queryUniqueCount = 0;
      let queryDuplicateCount = 0;

      try {
        const res = await fetch("/api/admin/prospect-discovery/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city, sector: q.sector, neighborhood: q.neighborhood, keyword: null }),
        });
        const data = await res.json();
        if (!res.ok) {
          errorCount++;
          queryStatus = "FAILED";
          queryError = data.message || data.error || `HTTP ${res.status}`;
          localErrors.push({ sector: q.sector, neighborhood: q.neighborhood, message: queryError || "error" });
        } else {
          queryResultCount = (data.items as SearchItem[]).length;
          for (const it of (data.items as SearchItem[])) {
            if (it.duplicateStatus === "EXISTS") queryDuplicateCount++;
            else queryUniqueCount++;
            if (accumulated.has(it.sourceId)) continue; // dedup across the sweep batch
            const signals = { phone: it.phone, whatsapp: it.whatsapp, instagram: it.instagram, website: it.website, email: null };
            accumulated.set(it.sourceId, {
              ...it,
              email: null,
              sweepSectorKey: q.sector,
              sweepNeighborhood: q.neighborhood,
              opportunityScore: computeOpportunityScore(it),
              qualityLabel: computeQualityLabel(signals),
            });
          }
        }
      } catch (err) {
        errorCount++;
        queryStatus = "FAILED";
        queryError = err instanceof Error ? err.message : "Network error";
        localErrors.push({ sector: q.sector, neighborhood: q.neighborhood, message: queryError });
      }

      // Log this query's outcome to sweep history (fire-and-forget)
      fetch("/api/admin/prospect-discovery/sweeps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerName,
          city,
          sector: q.sector,
          neighborhood: q.neighborhood,
          resultCount: queryResultCount,
          uniqueCount: queryUniqueCount,
          duplicateCount: queryDuplicateCount,
          status: queryStatus,
          error: queryError,
          startedAt: queryStartedAt.toISOString(),
        }),
      }).catch(() => {});

      // Update results live so user sees them accumulate
      setResults(Array.from(accumulated.values()).sort((a, b) => b.opportunityScore - a.opportunityScore));
      setErrors(localErrors.slice());

      // Pace between requests (skip pacing on last)
      if (i < effectiveQueries.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, pacingMs));
      }
    }

    setProgress((p) => p ? { ...p, completed: p.total, currentLabel: cancelRef.current ? "Cancelled" : "Done", errors: errorCount } : null);
    setRunning(false);
    setSweepDone(true);
  }

  function cancelSweep() { cancelRef.current = true; }

  // Apply quality filters
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const flags = channelFlags({ phone: r.phone, whatsapp: r.whatsapp, instagram: r.instagram, website: r.website, email: r.email ?? null });
      if (contactableOnly) {
        // Must have at least one outreach channel (not website-only)
        if (!flags.whatsapp && !flags.instagram && !flags.email && !flags.phone) return false;
      }
      for (const c of requiredChannels) {
        if (!flags[c]) return false;
      }
      return true;
    });
  }, [results, contactableOnly, requiredChannels]);

  const newCount = filteredResults.filter((r) => r.duplicateStatus === "NEW").length;
  const possibleCount = filteredResults.filter((r) => r.duplicateStatus === "POSSIBLE").length;
  const existsCount = filteredResults.filter((r) => r.duplicateStatus === "EXISTS").length;

  const hotNewCount = filteredResults.filter((r) => r.duplicateStatus === "NEW" && r.qualityLabel === "HOT").length;
  const warmNewCount = filteredResults.filter((r) => r.duplicateStatus === "NEW" && r.qualityLabel === "WARM").length;
  const coldNewCount = filteredResults.filter((r) => r.duplicateStatus === "NEW" && r.qualityLabel === "COLD").length;
  const tierEligibleCount = importTier === "HOT_ONLY" ? hotNewCount : importTier === "HOT_WARM" ? hotNewCount + warmNewCount : newCount;

  async function importAllNew() {
    if (importing) return;
    // Pre-filter by tier on the client too (server enforces, but skip wasted bytes)
    const toImport = filteredResults.filter((r) => {
      if (r.duplicateStatus !== "NEW") return false;
      if (importTier === "HOT_ONLY") return r.qualityLabel === "HOT";
      if (importTier === "HOT_WARM") return r.qualityLabel === "HOT" || r.qualityLabel === "WARM";
      return true;
    });
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      // Chunk by 100 to stay within import endpoint limits
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < toImport.length; i += 100) {
        const batch = toImport.slice(i, i + 100);
        const res = await fetch("/api/admin/prospect-discovery/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidates: batch.map((b) => ({
              sourceId: b.sourceId, source: b.source, name: b.name, sector: b.sweepSectorKey,
              city: b.city, neighborhood: b.sweepNeighborhood || b.neighborhood,
              phone: b.phone, whatsapp: b.whatsapp, website: b.website,
              instagram: b.instagram, email: b.email ?? null, facebook: b.facebook, mapsUrl: b.mapsUrl,
              rating: b.rating, reviewCount: b.reviewCount,
            })),
            allowPossibleDuplicates: false,
            tier: importTier,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          imported += data.imported || 0;
          skipped += data.skipped || 0;
        }
      }
      setImportResult({ imported, skipped });
      // Mark imported items as EXISTS in current results
      const importedNames = new Set(toImport.map((t) => t.name));
      setResults((prev) => prev.map((r) => importedNames.has(r.name) ? { ...r, duplicateStatus: "EXISTS" as const } : r));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Provider hint */}
      {providerName === "OSM" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3 text-[12px] text-blue-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          <span>
            Running on <span className="font-semibold">OpenStreetMap</span>. Coverage in Morocco is uneven — niche sectors (osteopaths, tax consultants, wedding planners) return 0-3 results.
            Add <code className="px-1 py-0.5 bg-white rounded text-[11px] font-mono">GOOGLE_PLACES_API_KEY</code> for 5-10× more results per sector.
          </span>
        </div>
      )}

      {/* Presets */}
      <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#8B00FF]" />
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Quick presets</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={presetPriority}
            disabled={running}
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm hover:shadow disabled:opacity-50"
          >
            Priority sectors (12)
          </button>
          <button
            onClick={presetSecondary}
            disabled={running}
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium border border-purple-200 bg-white text-[#7C3AED] hover:bg-purple-50 disabled:opacity-50"
          >
            Secondary sectors
          </button>
          <button
            onClick={presetFullMarrakech}
            disabled={running}
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium border border-purple-200 bg-white text-[#7C3AED] hover:bg-purple-50 disabled:opacity-50"
          >
            Full Marrakech ({sectors.length} sectors)
          </button>
          <div className="text-[11px] text-[#64748B] ml-auto self-center">
            Each preset selects sectors city-wide (no neighborhood drill-down). Add neighborhoods below for deeper coverage.
          </div>
        </div>
      </div>

      {/* Selectors */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Sectors</h2>
          <div className="flex items-center gap-2">
            <button onClick={selectAllSectors} className="text-[11px] text-[#7C3AED] hover:underline">All</button>
            <button onClick={clearSectors} className="text-[11px] text-[#64748B] hover:text-[#0F172A]">Clear</button>
            <span className="text-[11px] text-[#94A3B8]">{selectedSectors.size} selected</span>
          </div>
        </div>
        <div className="space-y-3">
          {sectorsByCategory.map(([cat, items]) => {
            const allInCatSelected = items.every((s) => selectedSectors.has(s.key));
            return (
              <div key={cat}>
                <button
                  onClick={() => selectCategorySectors(cat)}
                  className="text-[10px] uppercase tracking-wider font-bold text-[#64748B] hover:text-[#7C3AED] mb-1.5 flex items-center gap-1.5"
                >
                  <input type="checkbox" checked={allInCatSelected} readOnly className="rounded border-gray-300 text-purple-600 pointer-events-none" />
                  {cat}
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggleSector(s.key)}
                      disabled={running}
                      className={cn(
                        "text-[11.5px] px-2.5 py-1 rounded-full border transition-all",
                        selectedSectors.has(s.key)
                          ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white border-transparent"
                          : "bg-white text-[#475569] border-[var(--os-border)] hover:border-purple-300",
                        running && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Neighborhoods</h2>
          <div className="flex items-center gap-2">
            <button onClick={selectAllNeighborhoods} className="text-[11px] text-[#7C3AED] hover:underline">All</button>
            <button onClick={clearNeighborhoods} className="text-[11px] text-[#64748B] hover:text-[#0F172A]">Clear</button>
            <span className="text-[11px] text-[#94A3B8]">{selectedNeighborhoods.size} selected</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {neighborhoods.map((n) => (
            <button
              key={n}
              onClick={() => toggleNeighborhood(n)}
              disabled={running}
              className={cn(
                "text-[11.5px] px-2.5 py-1 rounded-full border transition-all",
                selectedNeighborhoods.has(n)
                  ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white border-transparent"
                  : "bg-white text-[#475569] border-[var(--os-border)] hover:border-purple-300",
                running && "opacity-50 cursor-not-allowed"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-3 text-[12px] text-[#475569]">
          <input
            type="checkbox"
            checked={includeCityWide}
            onChange={(e) => setIncludeCityWide(e.target.checked)}
            disabled={running}
            className="rounded border-gray-300 text-purple-600"
          />
          Also search city-wide for each sector (recommended for sparse data)
        </label>
      </div>

      {/* Plan + start */}
      <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/30 p-4 sm:p-5">
        {/* Sweep history pre-check banner */}
        {sweepCheck && sweepCheck.matches.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 mb-3">
            <div className="flex items-start gap-2">
              <FastForward className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-amber-900">
                  {sweepCheck.matches.length} of {queryList.length} {queryList.length === 1 ? "query" : "queries"} already swept in last {sweepCheck.withinDays} days
                </div>
                <label className="flex items-center gap-2 mt-1.5 text-[12px] text-amber-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipRecent}
                    onChange={(e) => setSkipRecent(e.target.checked)}
                    disabled={running}
                    className="rounded border-amber-300 text-purple-600 focus:ring-purple-300"
                  />
                  Skip recently swept queries (saves {sweepCheck.matches.length} API calls)
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[12.5px] text-[#475569]">
            Plan: <span className="font-semibold text-[#0F172A]">{effectiveQueries.length} queries</span>
            {effectiveQueries.length > 0 && (
              <> · <span className="font-medium text-[#0F172A]">~{estimatedSeconds}s</span> at {pacingMs}ms pacing</>
            )}
            {checkingSweeps && <span className="text-[#94A3B8] ml-2">· checking history...</span>}
            {tooMany && <span className="text-red-600 font-medium ml-2">· Exceeds limit ({MAX_QUERIES} max per sweep)</span>}
            {sweepCheck && sweepCheck.matches.length > 0 && skipRecent && (
              <span className="text-emerald-700 ml-2 text-[11px]">· {sweepCheck.matches.length} skipped from history</span>
            )}
          </div>
          {running ? (
            <button
              onClick={cancelSweep}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-white border border-red-200 text-red-700 hover:bg-red-50"
            >
              <Pause className="w-4 h-4" />
              Cancel
            </button>
          ) : (
            <button
              onClick={startSweep}
              disabled={effectiveQueries.length === 0 || tooMany}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Play className="w-4 h-4" />
              Start sweep
            </button>
          )}
        </div>

        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1">
              <span>{progress.completed} / {progress.total} · {progress.currentLabel}</span>
              <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3] transition-all" style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
            </div>
            {progress.errors > 0 && <div className="text-[11px] text-amber-700 mt-1">{progress.errors} queries errored (typically rate-limit or no-data)</div>}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-white">
          {/* Filter row */}
          <div className="px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/40 space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
              <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold">Filter</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactableOnly}
                  onChange={(e) => setContactableOnly(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span className="text-[#475569] font-medium">Contactable only</span>
              </label>
              <span className="text-[#94A3B8]">·</span>
              {(["whatsapp","instagram","website","email","phone"] as ChannelFilter[]).map((c) => (
                <label key={c} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiredChannels.has(c)}
                    onChange={() => toggleChannelFilter(c)}
                    className="rounded border-gray-300 text-purple-600"
                  />
                  <span className="text-[#475569] capitalize">{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60">
            <div className="flex items-center gap-3 flex-wrap text-[12px]">
              <span className="font-medium text-[#0F172A]">{filteredResults.length} shown</span>
              {filteredResults.length !== results.length && <span className="text-[#94A3B8]">of {results.length}</span>}
              <span className="text-[#64748B]">·</span>
              <span className="text-rose-700"><Flame className="w-3 h-3 inline -mt-0.5" /> {hotNewCount} HOT</span>
              <span className="text-amber-700">{warmNewCount} WARM</span>
              <span className="text-[#64748B]">{coldNewCount} COLD</span>
              <span className="text-[#94A3B8]">· {existsCount} exists</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={importTier}
                onChange={(e) => setImportTier(e.target.value as ImportTier)}
                className="text-[12px] px-2 py-1 rounded-lg border border-[var(--os-border)] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="HOT_ONLY">Import HOT only</option>
                <option value="HOT_WARM">Import HOT + WARM</option>
                <option value="ALL">Import all</option>
              </select>
              <button
                onClick={importAllNew}
                disabled={importing || tierEligibleCount === 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm disabled:opacity-40"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {importing ? "Importing..." : `Import ${tierEligibleCount}`}
              </button>
            </div>
          </div>

          {importResult && (
            <div className="px-4 py-2 text-[12px] bg-emerald-50 text-emerald-800 border-b border-emerald-100">
              Imported {importResult.imported} prospect{importResult.imported !== 1 ? "s" : ""}
              {importResult.skipped > 0 ? ` · skipped ${importResult.skipped} (final-check duplicates)` : ""}
            </div>
          )}

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                  <th className="px-3 py-2 text-left">Quality</th>
                  <th className="px-3 py-2 text-left">Business</th>
                  <th className="px-3 py-2 text-center" title="WhatsApp">WA</th>
                  <th className="px-3 py-2 text-center" title="Instagram">IG</th>
                  <th className="px-3 py-2 text-center" title="Website">Site</th>
                  <th className="px-3 py-2 text-center" title="Email">Email</th>
                  <th className="px-3 py-2 text-center" title="Phone">Phone</th>
                  <th className="px-3 py-2 text-left">Dup</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.slice(0, 300).map((r) => {
                  const flags = channelFlags({ phone: r.phone, whatsapp: r.whatsapp, instagram: r.instagram, website: r.website, email: r.email ?? null });
                  return (
                    <tr key={r.sourceId} className={cn("border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60", r.duplicateStatus === "EXISTS" && "opacity-60")}>
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", QUALITY_BADGE[r.qualityLabel])}>
                          {r.qualityLabel === "HOT" && <Flame className="w-3 h-3" />}
                          {r.qualityLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-[13px] font-medium text-[#0F172A]">{r.name}</div>
                        <div className="text-[11px] text-[#64748B]">
                          {sectors.find((s) => s.key === r.sweepSectorKey)?.label || r.sweepSectorKey}
                          {r.sweepNeighborhood && ` · ${r.sweepNeighborhood}`}
                          {r.rating !== null && r.rating !== undefined && ` · ★${r.rating} (${r.reviewCount ?? 0})`}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.whatsapp} title={r.phone ? `WhatsApp: ${r.phone}` : "No WhatsApp"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.instagram} title={r.instagram || "No Instagram"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.website} title={r.website || "No website"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.email} title={r.email || "No email"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.phone} title={r.phone || "No phone"} /></td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border",
                          r.duplicateStatus === "NEW" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          r.duplicateStatus === "POSSIBLE" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-gray-100 text-gray-600 border-gray-200"
                        )} title={r.duplicateReason || undefined}>
                          {r.duplicateStatus.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.mapsUrl && (
                          <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#64748B] hover:text-[#8B00FF]">
                            <ExternalLink className="w-3.5 h-3.5 inline" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredResults.length > 300 && (
              <div className="px-4 py-2 text-[11px] text-[#64748B] text-center">Showing top 300 by opportunity score · {filteredResults.length - 300} more match the filter</div>
            )}
          </div>
        </div>
      )}

      {/* Post-sweep summary */}
      {sweepDone && results.length > 0 && (
        <PostSweepReport
          results={results}
          errors={errors}
          progress={progress}
          sectors={sectors}
          importResult={importResult}
        />
      )}

      {progress && progress.completed === progress.total && results.length === 0 && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-white p-8 text-center">
          <Compass className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
          <div className="text-[14px] font-semibold text-[#0F172A]">Sweep complete · no businesses found</div>
          <div className="text-[12px] text-[#64748B] mt-1">
            {providerName === "OSM"
              ? "OpenStreetMap doesn't have these sectors mapped in Marrakech. Add a Google Places API key for full coverage."
              : "Try different sectors or neighborhoods."}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <details className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-[12px]">
          <summary className="cursor-pointer font-medium text-amber-800">{errors.length} query errors (click to expand)</summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {errors.map((e, i) => (
              <div key={i} className="text-[11px] text-amber-700">
                {sectors.find((s) => s.key === e.sector)?.label || e.sector}{e.neighborhood ? ` · ${e.neighborhood}` : ""}: {e.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ---------- Channel ✓/✗ mark ---------- */
function ChannelMark({ on, title }: { on: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold",
        on ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-[#CBD5E1]"
      )}
    >
      {on ? "✓" : "✗"}
    </span>
  );
}

/* ---------- Post-sweep summary report ---------- */
function PostSweepReport({
  results,
  errors,
  progress,
  sectors,
  importResult,
}: {
  results: Aggregated[];
  errors: Array<{ sector: string; neighborhood: string | null; message: string }>;
  progress: SweepProgress | null;
  sectors: Sector[];
  importResult: { imported: number; skipped: number } | null;
}) {
  const rawTotal = results.length;
  const unique = results.filter((r) => r.duplicateStatus !== "EXISTS").length;
  const existing = results.filter((r) => r.duplicateStatus === "EXISTS").length;
  const newCount = results.filter((r) => r.duplicateStatus === "NEW").length;
  const sectorsCovered = new Set(results.map((r) => r.sweepSectorKey));
  const neighborhoodsCovered = new Set(results.map((r) => r.sweepNeighborhood).filter(Boolean) as string[]);
  const queriesWithZero = errors.length;

  const sectorBreakdown = Array.from(sectorsCovered).map((k) => ({
    key: k,
    label: sectors.find((s) => s.key === k)?.label || k,
    count: results.filter((r) => r.sweepSectorKey === k).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-teal-50/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <h2 className="text-[14px] font-semibold text-[#0F172A]">Sweep complete · {progress?.total ?? "?"} queries run</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryStat label="Raw results" value={rawTotal} />
        <SummaryStat label="Unique" value={unique} subtle={`${existing} already in DB`} />
        <SummaryStat label="New (importable)" value={newCount} highlight />
        <SummaryStat label="Failed queries" value={queriesWithZero} subtle={queriesWithZero > 0 ? "see errors below" : "all clean"} warn={queriesWithZero > 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white border border-emerald-100 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-2">Sectors covered ({sectorsCovered.size})</div>
          {sectorBreakdown.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {sectorBreakdown.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {s.label} <span className="font-bold tabular-nums">{s.count}</span>
                </span>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#94A3B8]">None</p>}
        </div>
        <div className="rounded-xl bg-white border border-emerald-100 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-2">Neighborhoods covered ({neighborhoodsCovered.size})</div>
          {neighborhoodsCovered.size > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(neighborhoodsCovered).map((n) => (
                <span key={n} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{n}</span>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#94A3B8]">City-wide queries only — no neighborhood drill-down.</p>}
        </div>
      </div>

      {importResult && (
        <div className="mt-3 p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[12.5px] text-[#7C3AED]">
          ✓ Imported <span className="font-bold">{importResult.imported}</span> prospect{importResult.imported !== 1 ? "s" : ""}
          {importResult.skipped > 0 && ` · skipped ${importResult.skipped} final-check duplicates`}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, subtle, highlight, warn }: { label: string; value: number; subtle?: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border bg-white p-3",
      highlight ? "border-purple-200" : warn ? "border-amber-200" : "border-emerald-100"
    )}>
      <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-0.5">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", highlight ? "text-[#8B00FF]" : warn ? "text-amber-700" : "text-[#0F172A]")}>
        {value}
      </div>
      {subtle && <div className="text-[10px] text-[#94A3B8] mt-0.5">{subtle}</div>}
    </div>
  );
}
