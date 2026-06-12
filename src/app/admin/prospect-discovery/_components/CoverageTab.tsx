"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type CoverageRow = { sector?: string; sectorKey?: string | null; neighborhood?: string; discovered: number; contacted: number; remaining: number };
type LowCoverage = { key: string; label: string; category: string; discovered: number; catalogued: boolean };
type CoverageData = {
  totals: { discovered: number; contacted: number; remaining: number; contactRate: number };
  bySector: CoverageRow[];
  byNeighborhood: CoverageRow[];
  lowCoverageSectors: LowCoverage[];
  catalog: { totalSectors: number; totalCities: number };
};

export function CoverageTab({ onFindMore }: { onFindMore: (sectorKeys: string[]) => void }) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/prospect-discovery/coverage");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-32 rounded-2xl" />)}
      </div>
    );
  }

  const maxSectorDiscovered = Math.max(...data.bySector.map((s) => s.discovered), 1);
  const maxNbDiscovered = Math.max(...data.byNeighborhood.map((s) => s.discovered), 1);

  // Find More: sectors with 0 prospects first, then 1-4
  const findMoreSectors = data.lowCoverageSectors.slice(0, 12).map((s) => s.key);

  return (
    <div className="space-y-5">
      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Discovered" value={data.totals.discovered} subtle={`${data.catalog.totalSectors} sectors catalogued`} />
        <Stat label="Contacted" value={data.totals.contacted} subtle={`${data.totals.contactRate}% of discovered`} />
        <Stat label="Remaining" value={data.totals.remaining} subtle="uncontacted" highlight />
        <Stat label="Low coverage" value={data.lowCoverageSectors.length} subtle="sectors needing more prospects" />
      </div>

      {/* Find More */}
      <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/40 to-violet-50/40 p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shadow-md shadow-purple-500/30">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[#0F172A]">Find more prospects in low-coverage sectors</div>
            <div className="text-[12px] text-[#475569]">
              {data.lowCoverageSectors.length === 0
                ? "All catalogued sectors have ≥5 prospects already."
                : `Pre-fills a sweep with the ${Math.min(12, data.lowCoverageSectors.length)} sectors most lacking prospects.`}
            </div>
          </div>
        </div>
        <button
          onClick={() => onFindMore(findMoreSectors)}
          disabled={data.lowCoverageSectors.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md hover:shadow-lg disabled:opacity-40 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Find more →
        </button>
      </div>

      {/* Per-sector */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Coverage by sector</h2>
          <button onClick={load} className="text-[11px] text-[#7C3AED] hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
              <tr>
                <th className="px-4 py-2 text-left">Sector</th>
                <th className="px-3 py-2 text-right">Discovered</th>
                <th className="px-3 py-2 text-right">Contacted</th>
                <th className="px-3 py-2 text-right">Remaining</th>
                <th className="px-4 py-2 text-left w-1/3">Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.bySector.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#94A3B8]">No prospects yet.</td></tr>
              ) : data.bySector.map((row) => (
                <tr key={row.sector} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2 text-[13px] font-medium text-[#0F172A]">{row.sector}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#0F172A] tabular-nums">{row.discovered}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-emerald-700 tabular-nums">{row.contacted}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#7C3AED] tabular-nums font-medium">{row.remaining}</td>
                  <td className="px-4 py-2">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3]" style={{ width: `${(row.discovered / maxSectorDiscovered) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-neighborhood */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Coverage by neighborhood</h2>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
              <tr>
                <th className="px-4 py-2 text-left">Neighborhood</th>
                <th className="px-3 py-2 text-right">Discovered</th>
                <th className="px-3 py-2 text-right">Contacted</th>
                <th className="px-3 py-2 text-right">Remaining</th>
                <th className="px-4 py-2 text-left w-1/3">Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.byNeighborhood.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#94A3B8]">No prospects yet.</td></tr>
              ) : data.byNeighborhood.map((row) => (
                <tr key={row.neighborhood} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2 text-[13px] font-medium text-[#0F172A]">{row.neighborhood}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#0F172A] tabular-nums">{row.discovered}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-emerald-700 tabular-nums">{row.contacted}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#7C3AED] tabular-nums font-medium">{row.remaining}</td>
                  <td className="px-4 py-2">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3]" style={{ width: `${(row.discovered / maxNbDiscovered) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low coverage callouts */}
      {data.lowCoverageSectors.length > 0 && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8B00FF]" />
            Sectors with &lt; 5 prospects ({data.lowCoverageSectors.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {data.lowCoverageSectors.map((s) => (
              <span
                key={s.key}
                className={cn(
                  "text-[11.5px] px-2.5 py-1 rounded-full border",
                  s.discovered === 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                )}
                title={`${s.discovered} prospects · ${s.category}`}
              >
                {s.label} ({s.discovered})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, subtle, highlight }: { label: string; value: number; subtle?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 sm:p-5",
      highlight ? "border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50" : "border-[var(--os-border)] bg-white"
    )}>
      <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-1.5">{label}</div>
      <div className={cn("text-2xl sm:text-3xl font-bold tabular-nums", highlight ? "text-[#8B00FF]" : "text-[#0F172A]")}>
        {value.toLocaleString()}
      </div>
      {subtle && <div className="text-[11px] text-[#64748B] mt-0.5">{subtle}</div>}
    </div>
  );
}
