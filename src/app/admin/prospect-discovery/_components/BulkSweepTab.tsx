"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Pause, X, CheckCircle2, AlertCircle, Compass, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // sweep-time fields
  sweepSectorKey: string;
  sweepNeighborhood: string | null;
  opportunityScore: number;
};

type SweepProgress = {
  total: number;
  completed: number;
  currentLabel: string;
  errors: number;
};

const PACING_MS = 800; // delay between Overpass queries — under the ~2/sec public rate limit
const MAX_QUERIES = 200;

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

  const cancelRef = useRef(false);

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

  const estimatedSeconds = Math.round((queryList.length * PACING_MS) / 1000);
  const tooMany = queryList.length > MAX_QUERIES;

  async function startSweep() {
    if (running || queryList.length === 0 || tooMany) return;
    cancelRef.current = false;
    setRunning(true);
    setResults([]);
    setErrors([]);
    setImportResult(null);
    setProgress({ total: queryList.length, completed: 0, currentLabel: "", errors: 0 });

    const accumulated = new Map<string, Aggregated>();
    let errorCount = 0;
    const localErrors: typeof errors = [];

    for (let i = 0; i < queryList.length; i++) {
      if (cancelRef.current) break;
      const q = queryList[i];
      const label = sectors.find((s) => s.key === q.sector)?.label || q.sector;
      const place = q.neighborhood ? `${label} · ${q.neighborhood}` : `${label} · all areas`;
      setProgress({ total: queryList.length, completed: i, currentLabel: place, errors: errorCount });

      try {
        const res = await fetch("/api/admin/prospect-discovery/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city, sector: q.sector, neighborhood: q.neighborhood, keyword: null }),
        });
        const data = await res.json();
        if (!res.ok) {
          errorCount++;
          localErrors.push({ sector: q.sector, neighborhood: q.neighborhood, message: data.message || data.error || `HTTP ${res.status}` });
        } else {
          for (const it of (data.items as SearchItem[])) {
            if (accumulated.has(it.sourceId)) continue; // dedup across the sweep batch
            accumulated.set(it.sourceId, {
              ...it,
              sweepSectorKey: q.sector,
              sweepNeighborhood: q.neighborhood,
              opportunityScore: computeOpportunityScore(it),
            });
          }
        }
      } catch (err) {
        errorCount++;
        localErrors.push({ sector: q.sector, neighborhood: q.neighborhood, message: err instanceof Error ? err.message : "Network error" });
      }

      // Update results live so user sees them accumulate
      setResults(Array.from(accumulated.values()).sort((a, b) => b.opportunityScore - a.opportunityScore));
      setErrors(localErrors.slice());

      // Pace between requests (skip pacing on last)
      if (i < queryList.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, PACING_MS));
      }
    }

    setProgress((p) => p ? { ...p, completed: p.total, currentLabel: cancelRef.current ? "Cancelled" : "Done", errors: errorCount } : null);
    setRunning(false);
  }

  function cancelSweep() { cancelRef.current = true; }

  const newCount = results.filter((r) => r.duplicateStatus === "NEW").length;
  const possibleCount = results.filter((r) => r.duplicateStatus === "POSSIBLE").length;
  const existsCount = results.filter((r) => r.duplicateStatus === "EXISTS").length;

  async function importAllNew() {
    if (importing) return;
    const toImport = results.filter((r) => r.duplicateStatus === "NEW");
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
              instagram: b.instagram, facebook: b.facebook, mapsUrl: b.mapsUrl,
              rating: b.rating, reviewCount: b.reviewCount,
            })),
            allowPossibleDuplicates: false,
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[12.5px] text-[#475569]">
            Plan: <span className="font-semibold text-[#0F172A]">{queryList.length} queries</span>
            {queryList.length > 0 && (
              <> · <span className="font-medium text-[#0F172A]">~{estimatedSeconds}s</span> at {PACING_MS}ms pacing</>
            )}
            {tooMany && <span className="text-red-600 font-medium ml-2">· Exceeds limit ({MAX_QUERIES} max per sweep)</span>}
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
              disabled={queryList.length === 0 || tooMany}
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60">
            <div className="flex items-center gap-3 flex-wrap text-[12px]">
              <span className="font-medium text-[#0F172A]">{results.length} unique</span>
              <span className="text-[#64748B]">·</span>
              <span className="text-emerald-700">{newCount} new</span>
              <span className="text-amber-700">{possibleCount} possible</span>
              <span className="text-[#64748B]">{existsCount} exists</span>
              <span className="text-[#64748B]">· sorted by opportunity score</span>
            </div>
            <button
              onClick={importAllNew}
              disabled={importing || newCount === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm disabled:opacity-40"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {importing ? "Importing..." : `Import ${newCount} new`}
            </button>
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
                  <th className="px-3 py-2 text-left">Score</th>
                  <th className="px-3 py-2 text-left">Business</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Signals</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 300).map((r) => (
                  <tr key={r.sourceId} className={cn("border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60", r.duplicateStatus === "EXISTS" && "opacity-60")}>
                    <td className="px-3 py-2">
                      <div className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-lg text-[11px] font-bold tabular-nums",
                        r.opportunityScore >= 75 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        r.opportunityScore >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-gray-50 text-[#64748B] border border-gray-200"
                      )}>
                        {r.opportunityScore}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[13px] font-medium text-[#0F172A]">{r.name}</div>
                      <div className="text-[11px] text-[#64748B]">
                        {sectors.find((s) => s.key === r.sweepSectorKey)?.label || r.sweepSectorKey}
                        {r.sweepNeighborhood && ` · ${r.sweepNeighborhood}`}
                        {r.rating !== null && r.rating !== undefined && ` · ★${r.rating} (${r.reviewCount ?? 0})`}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="flex items-center gap-1 flex-wrap">
                        {!r.website && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">no site</span>}
                        {!r.instagram && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">no IG</span>}
                        {!r.phone && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">no phone</span>}
                        {r.phone && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-[#475569]">{r.phone}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border",
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
                ))}
              </tbody>
            </table>
            {results.length > 300 && (
              <div className="px-4 py-2 text-[11px] text-[#64748B] text-center">Showing top 300 by opportunity score · {results.length - 300} more in queue</div>
            )}
          </div>
        </div>
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
