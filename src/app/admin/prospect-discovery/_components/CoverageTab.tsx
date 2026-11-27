"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles, TrendingDown, Users, Calendar, History } from "lucide-react";
import { cn } from "@/lib/utils";

type CoverageRow = { sector?: string; sectorKey?: string | null; neighborhood?: string; discovered: number; contacted: number; remaining: number };
type LowCoverage = { key: string; label: string; category: string; discovered: number; catalogued: boolean };
type CoverageData = {
  totals: { discovered: number; contacted: number; remaining: number; contactRate: number };
  bySector: CoverageRow[];
  byNeighborhood: CoverageRow[];
  lowCoverageSectors: LowCoverage[];
  catalog: { totalSectors: number; totalCities: number };
  sweep?: {
    sectorCoveragePct: number;
    sectorsSwept: number;
    neverSweptSectors: Array<{ key: string; label: string; category: string }>;
    sectorSweepStats: Array<{ key: string; label: string; category: string; sweepsRun: number; lastSweptAt: string | null; daysSinceSwept: number | null }>;
    recentSweeps: Array<{ sector: string; neighborhood: string | null; startedAt: string; resultCount: number; importedCount: number; provider: string }>;
    totalSweeps: number;
  };
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

      {/* Sweep coverage progress */}
      {data.sweep && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#8B00FF] os-dark:text-[var(--os-purple)]" />
              <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Sweep coverage</h2>
            </div>
            <div className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">{data.sweep.totalSweeps} sweeps logged total</div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="rounded-xl bg-purple-50/60 os-dark:bg-purple-500/10 border border-purple-200 os-dark:border-purple-500/30 p-3 text-center">
              <div className="text-2xl font-bold text-[#8B00FF] os-dark:text-[var(--os-purple)] tabular-nums">{data.sweep.sectorCoveragePct}%</div>
              <div className="text-[11px] uppercase tracking-wider text-[#7C3AED] os-dark:text-[var(--os-purple)] font-medium mt-0.5">Sector coverage</div>
            </div>
            <div className="rounded-xl bg-emerald-50/60 os-dark:bg-emerald-500/10 border border-emerald-200 os-dark:border-emerald-500/30 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700 os-dark:text-emerald-300 tabular-nums">{data.sweep.sectorsSwept}</div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-700 os-dark:text-emerald-300 font-medium mt-0.5">Sectors swept</div>
            </div>
            <div className="rounded-xl bg-amber-50/60 os-dark:bg-amber-500/10 border border-amber-200 os-dark:border-amber-500/30 p-3 text-center">
              <div className="text-2xl font-bold text-amber-700 os-dark:text-amber-300 tabular-nums">{data.sweep.neverSweptSectors.length}</div>
              <div className="text-[11px] uppercase tracking-wider text-amber-700 os-dark:text-amber-300 font-medium mt-0.5">Never swept</div>
            </div>
          </div>

          {data.sweep.neverSweptSectors.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1.5">Sectors never swept</div>
              <div className="flex flex-wrap gap-1.5">
                {data.sweep.neverSweptSectors.slice(0, 30).map((s) => (
                  <span key={s.key} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 border border-amber-200 os-dark:border-amber-500/30">
                    {s.label}
                  </span>
                ))}
                {data.sweep.neverSweptSectors.length > 30 && (
                  <span className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">+ {data.sweep.neverSweptSectors.length - 30} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Find More */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] shadow-sm p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--os-hover)] border border-[var(--os-border)] flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-[var(--os-brand)] os-dark:text-[var(--os-purple)]" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[var(--os-text)]">Find more prospects in low-coverage sectors</div>
            <div className="text-[12px] text-[var(--os-text-muted)]">
              {data.lowCoverageSectors.length === 0
                ? "All catalogued sectors have ≥5 prospects already."
                : `Pre-fills a sweep with the ${Math.min(12, data.lowCoverageSectors.length)} sectors most lacking prospects.`}
            </div>
          </div>
        </div>
        <button
          onClick={() => onFindMore(findMoreSectors)}
          disabled={data.lowCoverageSectors.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium os-btn-primary"
        >
          <Sparkles className="w-4 h-4" />
          Find more →
        </button>
      </div>

      {/* Per-sector */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)]">
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Coverage by sector</h2>
          <button onClick={load} className="text-[11px] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--os-surface)] border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
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
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">No prospects yet.</td></tr>
              ) : data.bySector.map((row) => (
                <tr key={row.sector} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]">
                  <td className="px-4 py-2 text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{row.sector}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{row.discovered}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-emerald-700 os-dark:text-emerald-300 tabular-nums">{row.contacted}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#7C3AED] os-dark:text-[var(--os-purple)] tabular-nums font-medium">{row.remaining}</td>
                  <td className="px-4 py-2">
                    <div className="h-1.5 rounded-full bg-gray-100 os-dark:bg-[var(--os-surface-2)] overflow-hidden">
                      <div className="h-full bg-[var(--os-purple)]" style={{ width: `${(row.discovered / maxSectorDiscovered) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-neighborhood */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)]">
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Coverage by neighborhood</h2>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--os-surface)] border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
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
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">No prospects yet.</td></tr>
              ) : data.byNeighborhood.map((row) => (
                <tr key={row.neighborhood} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]">
                  <td className="px-4 py-2 text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{row.neighborhood}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{row.discovered}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-emerald-700 os-dark:text-emerald-300 tabular-nums">{row.contacted}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#7C3AED] os-dark:text-[var(--os-purple)] tabular-nums font-medium">{row.remaining}</td>
                  <td className="px-4 py-2">
                    <div className="h-1.5 rounded-full bg-gray-100 os-dark:bg-[var(--os-surface-2)] overflow-hidden">
                      <div className="h-full bg-[var(--os-purple)]" style={{ width: `${(row.discovered / maxNbDiscovered) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent sweep activity */}
      {data.sweep && data.sweep.recentSweeps.length > 0 && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)]">
            <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8B00FF] os-dark:text-[var(--os-purple)]" />
              Recent sweep activity
            </h2>
            <span className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">last {data.sweep.recentSweeps.length}</span>
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--os-surface)] border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Sector</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Area</th>
                  <th className="px-3 py-2 text-right">Found</th>
                  <th className="px-3 py-2 text-right">Imported</th>
                  <th className="px-3 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.sweep.recentSweeps.map((s, i) => {
                  const when = new Date(s.startedAt);
                  const hoursAgo = Math.floor((Date.now() - when.getTime()) / (60 * 60 * 1000));
                  const label = hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;
                  return (
                    <tr key={i} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]">
                      <td className="px-4 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)]">{label}</td>
                      <td className="px-3 py-2 text-[12px] text-[#0F172A] os-dark:text-[var(--os-text)]">{s.sector}</td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)] hidden md:table-cell">{s.neighborhood || "city-wide"}</td>
                      <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#0F172A] os-dark:text-[var(--os-text)]">{s.resultCount}</td>
                      <td className="px-3 py-2 text-right text-[12px] tabular-nums text-[#7C3AED] os-dark:text-[var(--os-purple)] font-medium">{s.importedCount}</td>
                      <td className="px-3 py-2 text-[11px]">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded font-medium",
                          s.provider === "GOOGLE" ? "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300" : "bg-gray-100 os-dark:bg-[var(--os-surface-2)] text-[#475569] os-dark:text-[var(--os-text)]"
                        )}>
                          {s.provider}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low coverage callouts */}
      {data.lowCoverageSectors.length > 0 && (
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
          <h2 className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8B00FF] os-dark:text-[var(--os-purple)]" />
            Sectors with &lt; 5 prospects ({data.lowCoverageSectors.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {data.lowCoverageSectors.map((s) => (
              <span
                key={s.key}
                className={cn(
                  "text-[11.5px] px-2.5 py-1 rounded-full border",
                  s.discovered === 0 ? "bg-red-50 os-dark:bg-red-500/10 text-red-700 os-dark:text-red-300 border-red-200 os-dark:border-red-500/30" : "bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 border-amber-200 os-dark:border-amber-500/30"
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
      highlight ? "border-[var(--os-border-hover)] bg-[var(--os-surface)] shadow-sm" : "border-[var(--os-border)] bg-[var(--os-surface)]"
    )}>
      <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1.5">{label}</div>
      <div className={cn("text-2xl sm:text-3xl font-bold tabular-nums", highlight ? "text-[#8B00FF] os-dark:text-[var(--os-purple)]" : "text-[#0F172A] os-dark:text-[var(--os-text)]")}>
        {value.toLocaleString()}
      </div>
      {subtle && <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mt-0.5">{subtle}</div>}
    </div>
  );
}
