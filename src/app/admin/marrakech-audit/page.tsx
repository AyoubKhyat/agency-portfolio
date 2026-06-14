"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ExternalLink } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

type AuditData = {
  config: { unlockThreshold: number };
  counts: {
    totalMarrakech: number;
    withMobile: number;
    withInstagram: number;
    withBothMobileAndInstagram: number;
    withLandlineOnly: number;
    withNoContact: number;
  };
  hotFunnel: {
    notContacted: number;
    contacted: number;
    replied: number;
    converted: number;
  };
  actionable: Array<{
    id: string;
    name: string;
    sector: string;
    mobile: string | null;
    instagram: string | null;
    lastActivity: string | null;
    source: string;
    score: number | null;
    qualityLabel: string | null;
    owner: { id: string; fullName: string } | null;
    neighborhood: string | null;
  }>;
  actionableRemaining: number;
  unlockExpansion: boolean;
  recommendation: string;
};

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function MarrakechAuditPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/marrakech-audit");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Marrakech Actionable Audit" />
        <div className="os-skeleton h-32 rounded-xl" />
      </div>
    );
  }

  const { counts, hotFunnel, actionable, actionableRemaining, unlockExpansion, recommendation, config } = data;

  return (
    <div>
      <PageHeader
        title="Marrakech Actionable Audit"
        actions={
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Headline */}
      <div className={cn(
        "rounded-xl border-2 p-4 mb-5",
        unlockExpansion ? "border-emerald-300 bg-emerald-50/60" : "border-amber-300 bg-amber-50/60"
      )}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={cn("text-4xl sm:text-5xl font-bold tabular-nums",
            unlockExpansion ? "text-emerald-700" : "text-amber-700"
          )}>
            {actionableRemaining}
          </span>
          <span className="text-[14px] text-[#475569] font-medium">
            actionable prospects remaining in Marrakech
          </span>
        </div>
        <div className={cn("text-[13px] mt-2", unlockExpansion ? "text-emerald-800" : "text-amber-800")}>
          {recommendation}
        </div>
        <div className="text-[11px] text-[#64748B] mt-1">
          Threshold: stay in Marrakech if ≥ {config.unlockThreshold} actionable remaining.
        </div>
      </div>

      {/* Contact info breakdown */}
      <h2 className="text-[13px] font-semibold text-[#0F172A] mb-2 uppercase tracking-wider text-[#475569]">Contact information breakdown</h2>
      <div className="rounded-xl border border-[var(--os-border)] bg-white overflow-hidden mb-5">
        <RawRow label="Total prospects in Marrakech" value={counts.totalMarrakech} />
        <RawRow label="With mobile number (06/07)" value={counts.withMobile} />
        <RawRow label="With Instagram handle" value={counts.withInstagram} />
        <RawRow label="With both mobile + Instagram" value={counts.withBothMobileAndInstagram} />
        <RawRow label="Landline only (05)" value={counts.withLandlineOnly} muted />
        <RawRow label="No contact information at all" value={counts.withNoContact} muted />
      </div>

      {/* HOT funnel raw */}
      <h2 className="text-[13px] font-semibold text-[#0F172A] mb-2 uppercase tracking-wider text-[#475569]">HOT funnel</h2>
      <div className="rounded-xl border border-[var(--os-border)] bg-white overflow-hidden mb-5">
        <RawRow label="HOT not contacted yet" value={hotFunnel.notContacted} />
        <RawRow label="HOT contacted" value={hotFunnel.contacted} />
        <RawRow label="HOT replied" value={hotFunnel.replied} />
        <RawRow label="HOT converted" value={hotFunnel.converted} highlight />
      </div>

      {/* Actionable table */}
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#475569] mb-2">
        Remaining Actionable Marrakech Prospects ({actionableRemaining})
      </h2>
      <p className="text-[11px] text-[#64748B] mb-3">
        Filter: Marrakech · (Mobile 06/07 OR Instagram) · Never contacted. Sorted by priority score desc.
      </p>
      {actionable.length === 0 ? (
        <div className="rounded-xl border border-[var(--os-border)] bg-white p-8 text-center text-[13px] text-[#64748B]">
          No actionable prospects left in Marrakech. Time to expand.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--os-border)] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50/60 text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Sector</th>
                  <th className="text-left px-3 py-2">Mobile</th>
                  <th className="text-left px-3 py-2">Instagram</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Last activity</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Source</th>
                  <th className="text-right px-3 py-2">Score</th>
                  <th className="text-right px-3 py-2">Open</th>
                </tr>
              </thead>
              <tbody>
                {actionable.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                    <td className="px-3 py-2">
                      <Link href={`/admin/prospecting/${p.id}`} className="text-[13px] font-medium text-[#0F172A] hover:text-[#7C3AED]">
                        {p.name}
                      </Link>
                      {p.neighborhood && <div className="text-[10px] text-[#94A3B8]">{p.neighborhood}</div>}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-[#475569] hidden md:table-cell">{p.sector}</td>
                    <td className="px-3 py-2 text-[12px] tabular-nums">
                      {p.mobile
                        ? <a href={`https://wa.me/${p.mobile.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                            <FaWhatsapp className="w-3 h-3" /> {p.mobile}
                          </a>
                        : <span className="text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-3 py-2 text-[12px]">
                      {p.instagram
                        ? <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#7C3AED] hover:underline">
                            <FaInstagram className="w-3 h-3" /> @{p.instagram}
                          </a>
                        : <span className="text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-[#475569] hidden lg:table-cell">{relativeDate(p.lastActivity)}</td>
                    <td className="px-3 py-2 text-[11px] text-[#64748B] hidden lg:table-cell">{p.source}</td>
                    <td className="px-3 py-2 text-right text-[13px] font-bold text-[#7C3AED] tabular-nums">{p.score ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/prospecting/${p.id}`} className="text-[#94A3B8] hover:text-[#7C3AED]" title="Open">
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {unlockExpansion && (
        <div className="mt-5 text-[13px]">
          <Link href="/admin/city-comparison" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md hover:shadow-lg">
            View city comparison →
          </Link>
        </div>
      )}
    </div>
  );
}

function RawRow({ label, value, muted, highlight }: { label: string; value: number; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-2.5 border-b border-[var(--os-border)] last:border-0",
      highlight && "bg-purple-50/40"
    )}>
      <span className={cn("text-[13px]", muted ? "text-[#94A3B8]" : "text-[#475569]")}>{label}</span>
      <span className={cn(
        "text-[18px] font-bold tabular-nums",
        muted ? "text-[#94A3B8]" : highlight ? "text-[#8B00FF]" : "text-[#0F172A]"
      )}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
