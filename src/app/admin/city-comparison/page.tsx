"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

type CityRow = {
  key: string; label: string;
  current: number; hot: number; mobile: number; instagram: number;
  uncontacted: number; actionable: number;
};

type Data = {
  cities: CityRow[];
  totals: { cityCount: number; totalProspects: number };
};

export default function CityComparisonPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/city-comparison");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="City Expansion Comparison" />
        <div className="os-skeleton h-32 rounded-xl" />
      </div>
    );
  }

  const cities = data.cities;
  const populated = cities.filter((c) => c.current > 0);
  const empty = cities.filter((c) => c.current === 0);
  const topActionable = populated[0];

  return (
    <div>
      <PageHeader
        title="City Expansion Comparison"
        subtitle="Real counts from the prospects table. No estimates."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] hover:bg-gray-50 os-dark:hover:bg-[var(--os-hover)]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {topActionable && (
        <div className="rounded-xl border-2 border-purple-200 os-dark:border-purple-500/30 bg-purple-50/40 os-dark:bg-purple-500/10 [.os-dark_&]:bg-none [.os-dark_&]:bg-[var(--os-surface)] p-3 mb-4 text-[13px] text-[var(--os-text-muted)]">
          <span className="font-semibold text-[var(--os-text)]">{topActionable.label}</span> has the most actionable prospects in the database
          {" "}({topActionable.actionable}). The cities below are sorted by that number.
        </div>
      )}

      <div className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)] text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
                <th className="text-left px-3 py-2">City</th>
                <th className="text-right px-3 py-2">Current prospects</th>
                <th className="text-right px-3 py-2">HOT</th>
                <th className="text-right px-3 py-2">Mobile</th>
                <th className="text-right px-3 py-2">Instagram</th>
                <th className="text-right px-3 py-2">Uncontacted</th>
                <th className="text-right px-3 py-2">Actionable</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {populated.map((c, i) => (
                <tr key={c.key} className={cn("border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]", i === 0 && "bg-purple-50/30 os-dark:bg-purple-500/10")}>
                  <td className="px-3 py-2">
                    <span className="text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{c.label}</span>
                    {i === 0 && <span className="ml-2 text-[11px] uppercase tracking-wider font-bold text-[#7C3AED] os-dark:text-[var(--os-purple)] bg-purple-100 os-dark:bg-purple-500/15 px-1.5 py-0.5 rounded">Top</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{c.current.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-rose-700 os-dark:text-rose-300 font-medium tabular-nums">{c.hot.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-emerald-700 os-dark:text-emerald-300 tabular-nums">{c.mobile.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-[#7C3AED] os-dark:text-[var(--os-purple)] tabular-nums">{c.instagram.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[13px] text-amber-700 os-dark:text-amber-300 tabular-nums">{c.uncontacted.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-[15px] font-bold text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{c.actionable.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/prospect-discovery?city=${c.key}`} className="text-[#94A3B8] os-dark:text-[var(--os-text-soft)] hover:text-[#7C3AED] os-dark:hover:text-[var(--os-purple)]" title="Open Discovery for this city">
                      <ChevronRight className="w-4 h-4 inline" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {empty.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] uppercase tracking-wider text-[#94A3B8] os-dark:text-[var(--os-text-soft)] font-bold mb-2">
            Cities with zero prospects in the database
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {empty.map((c) => (
              <Link
                key={c.key}
                href={`/admin/prospect-discovery?city=${c.key}`}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--os-border)] bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] hover:border-purple-300 os-dark:hover:border-purple-500/30 hover:bg-purple-50/40 os-dark:hover:bg-purple-500/10 transition-colors"
              >
                {c.label} <span className="text-[#CBD5E1] os-dark:text-[var(--os-text-faint)] ml-1">→ sweep</span>
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mt-3">
            These cities are catalogued in Discovery but have no prospects yet. Run a sweep when you&apos;re ready to expand.
          </p>
        </div>
      )}

      <div className="mt-5 text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">
        Total prospects across all cities: {data.totals.totalProspects.toLocaleString()} ·
        {" "}Cities with prospects: {data.totals.cityCount}
      </div>
    </div>
  );
}
