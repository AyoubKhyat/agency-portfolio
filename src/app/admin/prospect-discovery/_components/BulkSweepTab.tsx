"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Play, Pause, CheckCircle2, AlertCircle, Compass, ExternalLink,
  Zap, FastForward, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api-error";
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
  HOT: "bg-rose-50 os-dark:bg-rose-500/10 text-rose-700 os-dark:text-rose-300 border-rose-200 os-dark:border-rose-500/30",
  WARM: "bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 border-amber-200 os-dark:border-amber-500/30",
  COLD: "bg-gray-100 os-dark:bg-[var(--os-surface-2)] text-gray-600 os-dark:text-[var(--os-text)] border-gray-200 os-dark:border-[var(--os-border)]",
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
  matches: Array<{ city: string; sector: string; neighborhood: string | null; lastSweptAt: string; daysAgo: number; resultCount: number; importedCount: number }>;
  staleQueries: Array<{ city: string; sector: string; neighborhood: string | null }>;
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
  cities,
  sectors,
  neighborhoodsByCity,
  prefillSectors,
  providerName,
}: {
  cities: Array<{ key: string; label: string }>;
  sectors: Sector[];
  neighborhoodsByCity: Record<string, string[]>;
  prefillSectors?: string[];
  providerName: "GOOGLE" | "OSM";
}) {
  const [selectedCities, setSelectedCities] = useState<Set<string>>(() => {
    if (cities.length === 0) return new Set();
    const marrakech = cities.find((c) => c.key === "MARRAKECH");
    return new Set([marrakech ? marrakech.key : cities[0].key]);
  });
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set(prefillSectors || []));
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(new Set());
  const [includeCityWide, setIncludeCityWide] = useState(true); // also search whole city (no neighborhood filter)

  // Neighborhoods only apply when a single city is selected (and only Marrakech has data today)
  const singleCityKey = selectedCities.size === 1 ? Array.from(selectedCities)[0] : null;
  const neighborhoods: Neighborhood[] = singleCityKey ? (neighborhoodsByCity[singleCityKey] || []) : [];
  const multiCity = selectedCities.size > 1;

  function toggleCity(k: string) {
    setSelectedCities((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
    // Clear neighborhoods when switching cities, since lists differ
    setSelectedNeighborhoods(new Set());
  }
  function selectAllCities() {
    setSelectedCities(new Set(cities.map((c) => c.key)));
    setSelectedNeighborhoods(new Set());
  }
  function clearCities() {
    setSelectedCities(new Set());
    setSelectedNeighborhoods(new Set());
  }

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SweepProgress | null>(null);
  const [results, setResults] = useState<Aggregated[]>([]);
  const [errors, setErrors] = useState<Array<{ city: string; sector: string; neighborhood: string | null; message: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
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
  function presetAllSectors() {
    setSelectedSectors(new Set(sectors.map((s) => s.key)));
    setSelectedNeighborhoods(new Set());
    setIncludeCityWide(true);
  }
  function presetAllMorocco() {
    // Sweep priority sectors city-wide across every supported Moroccan city.
    setSelectedCities(new Set(cities.map((c) => c.key)));
    const valid = new Set(sectors.map((s) => s.key));
    setSelectedSectors(new Set(PRIORITY_SECTORS.filter((k) => valid.has(k))));
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

  // Build the query list (city × sector × neighborhood, optionally + city-wide).
  // Neighborhoods only apply when a single city is selected.
  const queryList = useMemo(() => {
    const cityKeys = Array.from(selectedCities);
    const sectorKeys = Array.from(selectedSectors);
    const nbList = singleCityKey ? Array.from(selectedNeighborhoods) : [];
    const queries: { city: string; sector: string; neighborhood: string | null }[] = [];
    for (const c of cityKeys) {
      for (const sec of sectorKeys) {
        if (includeCityWide || nbList.length === 0) queries.push({ city: c, sector: sec, neighborhood: null });
        for (const nb of nbList) queries.push({ city: c, sector: sec, neighborhood: nb });
      }
    }
    return queries;
  }, [selectedCities, selectedSectors, selectedNeighborhoods, includeCityWide, singleCityKey]);

  // Pre-check sweep history (debounced) when selection changes
  useEffect(() => {
    if (queryList.length === 0) { setSweepCheck(null); return; }
    setCheckingSweeps(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/prospect-discovery/sweeps/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cities: Array.from(selectedCities),
            queries: queryList,
            withinDays: 7,
          }),
        });
        if (res.ok) setSweepCheck(await res.json());
      } finally {
        setCheckingSweeps(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [queryList, selectedCities]);

  // Effective queries = full list, filtered by skipRecent if pre-check has matches
  const effectiveQueries = useMemo(() => {
    if (!skipRecent || !sweepCheck || sweepCheck.matches.length === 0) return queryList;
    const skipSet = new Set(sweepCheck.matches.map((m) => `${m.city}|${m.sector}|${m.neighborhood || ""}`));
    return queryList.filter((q) => !skipSet.has(`${q.city}|${q.sector}|${q.neighborhood || ""}`));
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
    setImportError(null);
    setSweepDone(false);
    setProgress({ total: effectiveQueries.length, completed: 0, currentLabel: "", errors: 0 });

    const accumulated = new Map<string, Aggregated>();
    let errorCount = 0;
    const localErrors: typeof errors = [];
    // A denied search (owner or admin only) fails every query the same way: stop at the first one.
    let denied = false;

    for (let i = 0; i < effectiveQueries.length; i++) {
      if (cancelRef.current) break;
      const q = effectiveQueries[i];
      const sectorLabel = sectors.find((s) => s.key === q.sector)?.label || q.sector;
      const cityLabel = cities.find((c) => c.key === q.city)?.label || q.city;
      const areaPart = q.neighborhood ? q.neighborhood : "all areas";
      const place = `${cityLabel} · ${sectorLabel} · ${areaPart}`;
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
          body: JSON.stringify({ city: q.city, sector: q.sector, neighborhood: q.neighborhood, keyword: null }),
        });
        const data = await res.json();
        if (!res.ok) {
          errorCount++;
          queryStatus = "FAILED";
          queryError = data.message || data.error || `HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) denied = true;
          localErrors.push({ city: q.city, sector: q.sector, neighborhood: q.neighborhood, message: queryError || "error" });
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
        localErrors.push({ city: q.city, sector: q.sector, neighborhood: q.neighborhood, message: queryError });
      }

      // Log this query's outcome to sweep history (fire-and-forget)
      fetch("/api/admin/prospect-discovery/sweeps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerName,
          city: q.city,
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
      if (denied) break;

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
    setImportError(null);
    // Chunk by 100 to stay within import endpoint limits
    let imported = 0;
    let skipped = 0;
    // Only businesses in a batch the server accepted are marked EXISTS. A failed batch (denied, invalid, network)
    // stops the import and marks nothing, so those businesses stay importable.
    const accepted = new Set<string>();
    let failure: string | null = null;
    try {
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
        if (!res.ok) {
          failure = await apiErrorMessage(res, "Import failed");
          break;
        }
        const data = await res.json();
        imported += data.imported || 0;
        skipped += data.skipped || 0;
        for (const b of batch) accepted.add(b.name);
      }
    } catch {
      failure = "Import failed: network error";
    } finally {
      if (accepted.size > 0) setImportResult({ imported, skipped });
      if (failure) setImportError(failure);
      // Mark items of accepted batches as EXISTS in current results
      setResults((prev) => prev.map((r) => accepted.has(r.name) ? { ...r, duplicateStatus: "EXISTS" as const } : r));
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Provider hint */}
      {providerName === "OSM" && (
        <div className="rounded-2xl border border-blue-200 os-dark:border-blue-500/30 bg-blue-50/40 os-dark:bg-blue-500/10 p-3 text-[12px] text-blue-900 os-dark:text-blue-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 os-dark:text-blue-400" />
          <span>
            Running on <span className="font-semibold">OpenStreetMap</span>. Coverage in Morocco is uneven — niche sectors (osteopaths, tax consultants, wedding planners) return 0-3 results.
            Add <code className="px-1 py-0.5 bg-[var(--os-surface)] rounded text-[11px] font-mono">GOOGLE_PLACES_API_KEY</code> for 5-10× more results per sector.
          </span>
        </div>
      )}

      {/* Presets */}
      <div className="rounded-2xl border border-purple-200 os-dark:border-purple-500/30 bg-purple-50/30 os-dark:bg-purple-500/10 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#8B00FF] os-dark:text-[var(--os-purple)]" />
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Quick presets</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={presetAllMorocco}
            disabled={running || cities.length === 0}
            title={`Select all ${cities.length} Moroccan cities + priority sectors (city-wide)`}
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:shadow disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            🇲🇦 All Morocco ({cities.length} cities × priority sectors)
          </button>
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
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium border border-purple-200 os-dark:border-purple-500/30 bg-[var(--os-surface)] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:bg-purple-50 os-dark:hover:bg-purple-500/10 disabled:opacity-50"
          >
            Secondary sectors
          </button>
          <button
            onClick={presetAllSectors}
            disabled={running}
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium border border-purple-200 os-dark:border-purple-500/30 bg-[var(--os-surface)] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:bg-purple-50 os-dark:hover:bg-purple-500/10 disabled:opacity-50"
          >
            All sectors ({sectors.length})
          </button>
          <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] ml-auto self-center">
            Each preset selects sectors city-wide. Pick cities below to scope.
          </div>
        </div>
      </div>

      {/* Cities multi-select */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] flex items-center gap-1.5">
            Cities
            {multiCity && (
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-700 os-dark:text-amber-300 bg-amber-50 os-dark:bg-amber-500/10 border border-amber-200 os-dark:border-amber-500/30 px-1.5 py-0.5 rounded-full">
                multi-city
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={selectAllCities} disabled={running} className="text-[11px] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:underline disabled:opacity-50">All</button>
            <button onClick={clearCities} disabled={running} className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] hover:text-[#0F172A] os-dark:hover:text-[var(--os-text)] disabled:opacity-50">Clear</button>
            <span className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">{selectedCities.size} of {cities.length} selected</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cities.map((c) => (
            <button
              key={c.key}
              onClick={() => toggleCity(c.key)}
              disabled={running}
              className={cn(
                "text-[11.5px] px-2.5 py-1 rounded-full border transition-all",
                selectedCities.has(c.key)
                  ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white border-transparent"
                  : "bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] border-[var(--os-border)] hover:border-purple-300 os-dark:hover:border-purple-500/30",
                running && "opacity-50 cursor-not-allowed"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        {multiCity && (
          <div className="mt-2 text-[11px] text-amber-700 os-dark:text-amber-300 bg-amber-50/40 os-dark:bg-amber-500/10 border border-amber-200 os-dark:border-amber-500/30 rounded-lg px-2.5 py-1.5">
            Multi-city mode: neighborhood drill-down disabled (only Marrakech has neighborhood data). All sweeps run city-wide.
          </div>
        )}
      </div>

      {/* Selectors */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Sectors</h2>
          <div className="flex items-center gap-2">
            <button onClick={selectAllSectors} className="text-[11px] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:underline">All</button>
            <button onClick={clearSectors} className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] hover:text-[#0F172A] os-dark:hover:text-[var(--os-text)]">Clear</button>
            <span className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">{selectedSectors.size} selected</span>
          </div>
        </div>
        <div className="space-y-3">
          {sectorsByCategory.map(([cat, items]) => {
            const allInCatSelected = items.every((s) => selectedSectors.has(s.key));
            return (
              <div key={cat}>
                <button
                  onClick={() => selectCategorySectors(cat)}
                  className="text-[11px] uppercase tracking-wider font-bold text-[#64748B] os-dark:text-[var(--os-text-soft)] hover:text-[#7C3AED] os-dark:hover:text-[var(--os-purple)] mb-1.5 flex items-center gap-1.5"
                >
                  <input type="checkbox" checked={allInCatSelected} readOnly className="rounded border-gray-300 os-dark:border-[var(--os-border-hover)] text-purple-600 os-dark:text-purple-400 pointer-events-none" />
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
                          : "bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] border-[var(--os-border)] hover:border-purple-300 os-dark:hover:border-purple-500/30",
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

      {!multiCity && neighborhoods.length > 0 && (
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Neighborhoods{singleCityKey ? ` · ${cities.find((c) => c.key === singleCityKey)?.label ?? singleCityKey}` : ""}</h2>
          <div className="flex items-center gap-2">
            <button onClick={selectAllNeighborhoods} className="text-[11px] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:underline">All</button>
            <button onClick={clearNeighborhoods} className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] hover:text-[#0F172A] os-dark:hover:text-[var(--os-text)]">Clear</button>
            <span className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">{selectedNeighborhoods.size} selected</span>
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
                  : "bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] border-[var(--os-border)] hover:border-purple-300 os-dark:hover:border-purple-500/30",
                running && "opacity-50 cursor-not-allowed"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-3 text-[12px] text-[#475569] os-dark:text-[var(--os-text)]">
          <input
            type="checkbox"
            checked={includeCityWide}
            onChange={(e) => setIncludeCityWide(e.target.checked)}
            disabled={running}
            className="rounded border-gray-300 os-dark:border-[var(--os-border-hover)] text-purple-600 os-dark:text-purple-400"
          />
          Also search city-wide for each sector (recommended for sparse data)
        </label>
      </div>
      )}

      {/* Plan + start */}
      <div className="rounded-2xl border-2 border-purple-200 os-dark:border-purple-500/30 bg-purple-50/30 os-dark:bg-purple-500/10 p-4 sm:p-5">
        {/* Sweep history pre-check banner */}
        {sweepCheck && sweepCheck.matches.length > 0 && (
          <div className="rounded-lg border border-amber-200 os-dark:border-amber-500/30 bg-amber-50/40 os-dark:bg-amber-500/10 p-3 mb-3">
            <div className="flex items-start gap-2">
              <FastForward className="w-4 h-4 text-amber-700 os-dark:text-amber-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-amber-900 os-dark:text-amber-300">
                  {sweepCheck.matches.length} of {queryList.length} {queryList.length === 1 ? "query" : "queries"} already swept in last {sweepCheck.withinDays} days
                </div>
                <label className="flex items-center gap-2 mt-1.5 text-[12px] text-amber-800 os-dark:text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipRecent}
                    onChange={(e) => setSkipRecent(e.target.checked)}
                    disabled={running}
                    className="rounded border-amber-300 os-dark:border-amber-500/30 text-purple-600 os-dark:text-purple-400 focus:ring-purple-300 os-dark:focus:ring-purple-500/40"
                  />
                  Skip recently swept queries (saves {sweepCheck.matches.length} API calls)
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[12.5px] text-[#475569] os-dark:text-[var(--os-text)]">
            Plan: <span className="font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">{effectiveQueries.length} queries</span>
            {effectiveQueries.length > 0 && (
              <> · <span className="font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">~{estimatedSeconds}s</span> at {pacingMs}ms pacing</>
            )}
            {checkingSweeps && <span className="text-[#94A3B8] os-dark:text-[var(--os-text-soft)] ml-2">· checking history...</span>}
            {tooMany && <span className="text-red-600 os-dark:text-red-400 font-medium ml-2">· Exceeds limit ({MAX_QUERIES} max per sweep)</span>}
            {sweepCheck && sweepCheck.matches.length > 0 && skipRecent && (
              <span className="text-emerald-700 os-dark:text-emerald-300 ml-2 text-[11px]">· {sweepCheck.matches.length} skipped from history</span>
            )}
          </div>
          {running ? (
            <button
              onClick={cancelSweep}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-[var(--os-surface)] border border-red-200 os-dark:border-red-500/30 text-red-700 os-dark:text-red-300 hover:bg-red-50 os-dark:hover:bg-red-500/10"
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
            <div className="flex items-center justify-between text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mb-1">
              <span>{progress.completed} / {progress.total} · {progress.currentLabel}</span>
              <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-purple-100 os-dark:bg-purple-500/15 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3] transition-all" style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
            </div>
            {progress.errors > 0 && <div className="text-[11px] text-amber-700 os-dark:text-amber-300 mt-1">{progress.errors} queries errored (typically rate-limit or no-data)</div>}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)]">
          {/* Filter row */}
          <div className="px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/40 os-dark:bg-[var(--os-surface-2)] space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-bold">Filter</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactableOnly}
                  onChange={(e) => setContactableOnly(e.target.checked)}
                  className="rounded border-gray-300 os-dark:border-[var(--os-border-hover)] text-purple-600 os-dark:text-purple-400"
                />
                <span className="text-[#475569] os-dark:text-[var(--os-text)] font-medium">Contactable only</span>
              </label>
              <span className="text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">·</span>
              {(["whatsapp","instagram","website","email","phone"] as ChannelFilter[]).map((c) => (
                <label key={c} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiredChannels.has(c)}
                    onChange={() => toggleChannelFilter(c)}
                    className="rounded border-gray-300 os-dark:border-[var(--os-border-hover)] text-purple-600 os-dark:text-purple-400"
                  />
                  <span className="text-[#475569] os-dark:text-[var(--os-text)] capitalize">{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)]">
            <div className="flex items-center gap-3 flex-wrap text-[12px]">
              <span className="font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{filteredResults.length} shown</span>
              {filteredResults.length !== results.length && <span className="text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">of {results.length}</span>}
              <span className="text-[#64748B] os-dark:text-[var(--os-text-soft)]">·</span>
              <span className="text-rose-700 os-dark:text-rose-300"><Flame className="w-3 h-3 inline -mt-0.5" /> {hotNewCount} HOT</span>
              <span className="text-amber-700 os-dark:text-amber-300">{warmNewCount} WARM</span>
              <span className="text-[#64748B] os-dark:text-[var(--os-text-soft)]">{coldNewCount} COLD</span>
              <span className="text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">· {existsCount} exists</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={importTier}
                onChange={(e) => setImportTier(e.target.value as ImportTier)}
                className="text-[12px] px-2 py-1 rounded-lg border border-[var(--os-border)] bg-[var(--os-control-bg)] text-[#0F172A] os-dark:text-[var(--os-text)] focus:outline-none focus:ring-2 focus:ring-purple-300 os-dark:focus:ring-purple-500/40"
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

          {importError && (
            <div role="alert" className="px-4 py-2 text-[12px] bg-red-50 os-dark:bg-red-500/10 text-red-700 os-dark:text-red-300 border-b border-red-100 os-dark:border-red-500/30 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {importError}
            </div>
          )}

          {importResult && (
            <div className="px-4 py-2 text-[12px] bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-800 os-dark:text-emerald-300 border-b border-emerald-100 os-dark:border-emerald-500/30">
              Imported {importResult.imported} prospect{importResult.imported !== 1 ? "s" : ""}
              {importResult.skipped > 0 ? ` · skipped ${importResult.skipped} (final-check duplicates)` : ""}
            </div>
          )}

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--os-surface)]">
                <tr className="border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
                  <th className="px-3 py-2 text-left">Quality</th>
                  <th className="px-3 py-2 text-left">Business</th>
                  {multiCity && <th className="px-3 py-2 text-left">City</th>}
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
                    <tr key={r.sourceId} className={cn("border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]", r.duplicateStatus === "EXISTS" && "opacity-60")}>
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", QUALITY_BADGE[r.qualityLabel])}>
                          {r.qualityLabel === "HOT" && <Flame className="w-3 h-3" />}
                          {r.qualityLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{r.name}</div>
                        <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
                          {sectors.find((s) => s.key === r.sweepSectorKey)?.label || r.sweepSectorKey}
                          {r.sweepNeighborhood && ` · ${r.sweepNeighborhood}`}
                          {r.rating !== null && r.rating !== undefined && ` · ★${r.rating} (${r.reviewCount ?? 0})`}
                        </div>
                      </td>
                      {multiCity && (
                        <td className="px-3 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)]">
                          {cities.find((c) => c.key === r.city)?.label || r.city}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.whatsapp} title={r.phone ? `WhatsApp: ${r.phone}` : "No WhatsApp"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.instagram} title={r.instagram || "No Instagram"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.website} title={r.website || "No website"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.email} title={r.email || "No email"} /></td>
                      <td className="px-3 py-2 text-center"><ChannelMark on={flags.phone} title={r.phone || "No phone"} /></td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[11px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border",
                          r.duplicateStatus === "NEW" ? "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border-emerald-200 os-dark:border-emerald-500/30" :
                          r.duplicateStatus === "POSSIBLE" ? "bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 border-amber-200 os-dark:border-amber-500/30" :
                          "bg-gray-100 os-dark:bg-[var(--os-surface-2)] text-gray-600 os-dark:text-[var(--os-text)] border-gray-200 os-dark:border-[var(--os-border)]"
                        )} title={r.duplicateReason || undefined}>
                          {r.duplicateStatus.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.mapsUrl && (
                          <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#64748B] os-dark:text-[var(--os-text-soft)] hover:text-[#8B00FF] os-dark:hover:text-[var(--os-purple)]">
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
              <div className="px-4 py-2 text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] text-center">Showing top 300 by opportunity score · {filteredResults.length - 300} more match the filter</div>
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
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-8 text-center">
          <Compass className="w-8 h-8 text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mx-auto mb-2" />
          <div className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Sweep complete · no businesses found</div>
          <div className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mt-1">
            {providerName === "OSM"
              ? "OpenStreetMap doesn't have these sectors mapped in Marrakech. Add a Google Places API key for full coverage."
              : "Try different sectors or neighborhoods."}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <details className="rounded-xl border border-amber-200 os-dark:border-amber-500/30 bg-amber-50/40 os-dark:bg-amber-500/10 p-3 text-[12px]">
          <summary className="cursor-pointer font-medium text-amber-800 os-dark:text-amber-300">{errors.length} query errors (click to expand)</summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {errors.map((e, i) => (
              <div key={i} className="text-[11px] text-amber-700 os-dark:text-amber-300">
                {cities.find((c) => c.key === e.city)?.label || e.city} · {sectors.find((s) => s.key === e.sector)?.label || e.sector}{e.neighborhood ? ` · ${e.neighborhood}` : ""}: {e.message}
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
        on ? "bg-emerald-100 os-dark:bg-emerald-500/15 text-emerald-700 os-dark:text-emerald-300" : "bg-gray-100 os-dark:bg-[var(--os-surface-2)] text-[#CBD5E1] os-dark:text-[var(--os-text-faint)]"
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
  errors: Array<{ city: string; sector: string; neighborhood: string | null; message: string }>;
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
    <div className="rounded-2xl border-2 border-emerald-200 os-dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/40 to-teal-50/40 os-dark:from-emerald-500/10 os-dark:to-teal-500/5 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 os-dark:text-emerald-400" />
        <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Sweep complete · {progress?.total ?? "?"} queries run</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryStat label="Raw results" value={rawTotal} />
        <SummaryStat label="Unique" value={unique} subtle={`${existing} already in DB`} />
        <SummaryStat label="New (importable)" value={newCount} highlight />
        <SummaryStat label="Failed queries" value={queriesWithZero} subtle={queriesWithZero > 0 ? "see errors below" : "all clean"} warn={queriesWithZero > 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--os-surface)] border border-emerald-100 os-dark:border-emerald-500/30 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-2">Sectors covered ({sectorsCovered.size})</div>
          {sectorBreakdown.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {sectorBreakdown.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border border-emerald-200 os-dark:border-emerald-500/30">
                  {s.label} <span className="font-bold tabular-nums">{s.count}</span>
                </span>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">None</p>}
        </div>
        <div className="rounded-xl bg-[var(--os-surface)] border border-emerald-100 os-dark:border-emerald-500/30 p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-2">Neighborhoods covered ({neighborhoodsCovered.size})</div>
          {neighborhoodsCovered.size > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(neighborhoodsCovered).map((n) => (
                <span key={n} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border border-emerald-200 os-dark:border-emerald-500/30">{n}</span>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">City-wide queries only — no neighborhood drill-down.</p>}
        </div>
      </div>

      {importResult && (
        <div className="mt-3 p-2.5 rounded-lg bg-purple-50 os-dark:bg-purple-500/10 border border-purple-200 os-dark:border-purple-500/30 text-[12.5px] text-[#7C3AED] os-dark:text-[var(--os-purple)]">
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
      "rounded-xl border bg-[var(--os-surface)] p-3",
      highlight ? "border-purple-200 os-dark:border-purple-500/30" : warn ? "border-amber-200 os-dark:border-amber-500/30" : "border-emerald-100 os-dark:border-emerald-500/30"
    )}>
      <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-0.5">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", highlight ? "text-[#8B00FF] os-dark:text-[var(--os-purple)]" : warn ? "text-amber-700 os-dark:text-amber-300" : "text-[#0F172A] os-dark:text-[var(--os-text)]")}>
        {value}
      </div>
      {subtle && <div className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mt-0.5">{subtle}</div>}
    </div>
  );
}
