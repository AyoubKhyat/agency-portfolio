"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, AlertTriangle, AlertCircle, RefreshCw, Loader2, CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

type SlimProspect = {
  id: string; name: string; phone: string | null; whatsapp: string | null;
  instagram: string | null; qualityLabel: string | null; status: string;
};
type MismatchProspect = { id: string; name: string; stored: string | null; recomputed: string };

type AuditData = {
  totals: { total: number; HOT: number; WARM: number; COLD: number; nullLabel: number };
  issues: {
    hotNoContact: { count: number; sample: SlimProspect[] };
    phoneNoWhatsapp: { count: number; sample: SlimProspect[] };
    igMalformed: { count: number; sample: SlimProspect[] };
    qualityMismatch: { count: number; sample: MismatchProspect[] };
    missingName: { count: number; sample: SlimProspect[] };
    noContact: { count: number; sample: SlimProspect[] };
  };
  breakdown: { hotIgOnly: number; hotPhoneOnly: number; hotBoth: number };
  sample: Array<{
    id: string; name: string; phone: string | null; whatsapp: string | null;
    instagram: string | null; website: string | null;
    qualityLabel: string | null; score: number | null;
  }>;
};

export default function DataAuditPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<{ action: string; updated: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/data-audit");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runFix(action: string) {
    if (fixing) return;
    setFixing(action);
    setFixResult(null);
    try {
      const res = await fetch("/api/admin/data-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setFixResult({ action: data.action, updated: data.updated });
        await load();
      }
    } finally {
      setFixing(null);
    }
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Data audit" subtitle="Diagnose prospect contact-data integrity" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const totalIssues = data.issues.hotNoContact.count
    + data.issues.phoneNoWhatsapp.count
    + data.issues.igMalformed.count
    + data.issues.qualityMismatch.count
    + data.issues.missingName.count;

  return (
    <div>
      <PageHeader
        title="Data audit"
        subtitle="If a prospect is HOT, the table must show at least one contact action."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Headline status */}
      <div className={cn(
        "rounded-2xl border-2 p-4 mb-5 flex items-center gap-3",
        totalIssues === 0
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-teal-50/40"
          : "border-amber-200 bg-gradient-to-br from-amber-50/40 to-orange-50/40"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0",
          totalIssues === 0 ? "bg-emerald-500 shadow-emerald-500/30" : "bg-amber-500 shadow-amber-500/30"
        )}>
          {totalIssues === 0
            ? <ShieldCheck className="w-5 h-5 text-white" />
            : <AlertTriangle className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#0F172A]">
            {totalIssues === 0 ? "All checks passed" : `${totalIssues} integrity issue${totalIssues !== 1 ? "s" : ""} found`}
          </div>
          <div className="text-[12px] text-[#475569]">
            {totalIssues === 0
              ? "Every HOT prospect has at least one contact channel and rendering should be consistent."
              : "Use the fix actions below to resolve. Most are automatic."}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total prospects" value={data.totals.total} />
        <Stat label="HOT" value={data.totals.HOT} color="rose" />
        <Stat label="WARM" value={data.totals.WARM} color="amber" />
        <Stat label="COLD" value={data.totals.COLD} color="gray" />
      </div>

      {/* HOT breakdown */}
      <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5 mb-5">
        <div className="text-[14px] font-semibold text-[#0F172A] mb-3">HOT composition</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">{data.breakdown.hotPhoneOnly}</div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-medium">Phone only</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">Shows: WA + Call</div>
          </div>
          <div className="rounded-xl bg-purple-50/60 border border-purple-200 p-3 text-center">
            <div className="text-2xl font-bold text-[#8B00FF] tabular-nums">{data.breakdown.hotIgOnly}</div>
            <div className="text-[10px] uppercase tracking-wider text-[#7C3AED] font-medium">Instagram only</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">Shows: IG</div>
          </div>
          <div className="rounded-xl bg-rose-50/60 border border-rose-200 p-3 text-center">
            <div className="text-2xl font-bold text-rose-700 tabular-nums">{data.breakdown.hotBoth}</div>
            <div className="text-[10px] uppercase tracking-wider text-rose-700 font-medium">Phone + IG</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">Shows: WA + IG + Call</div>
          </div>
        </div>
      </div>

      {/* Fix result toast */}
      {fixResult && (
        <div className="mb-5 p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <div className="text-[12.5px] text-emerald-800">
            Ran <span className="font-mono">{fixResult.action}</span> — updated {fixResult.updated} prospects.
          </div>
        </div>
      )}

      {/* Issues */}
      <div className="space-y-4">
        <IssueCard
          title="HOT prospects without any contact"
          severity="error"
          description="Marked HOT but no phone, WhatsApp, or Instagram. Either qualityLabel is stale or the data is broken."
          count={data.issues.hotNoContact.count}
          sample={data.issues.hotNoContact.sample}
          fixLabel={data.issues.qualityMismatch.count > 0 ? "Refresh quality labels" : null}
          fixAction={data.issues.qualityMismatch.count > 0 ? "REFRESH_QUALITY_LABELS" : null}
          running={fixing}
          onFix={runFix}
        />

        <IssueCard
          title="Phone present, whatsappLink missing"
          severity="warn"
          description="Phone is stored but the wa.me link wasn't built. The render now auto-falls back to phone, but stored data should be consistent."
          count={data.issues.phoneNoWhatsapp.count}
          sample={data.issues.phoneNoWhatsapp.sample}
          fixLabel="Backfill wa.me links"
          fixAction="FIX_WHATSAPP_LINKS"
          running={fixing}
          onFix={runFix}
        />

        <IssueCard
          title="QualityLabel mismatch"
          severity="warn"
          description="Stored label differs from what computeQualityLabel returns for the current data. Usually means contact data was updated after backfill."
          count={data.issues.qualityMismatch.count}
          mismatchSample={data.issues.qualityMismatch.sample}
          fixLabel="Recompute labels"
          fixAction="REFRESH_QUALITY_LABELS"
          running={fixing}
          onFix={runFix}
        />

        <IssueCard
          title="Instagram handle malformed"
          severity="warn"
          description="Stored Instagram doesn't parse as a usable handle. The Instagram button may still render but the link could break."
          count={data.issues.igMalformed.count}
          sample={data.issues.igMalformed.sample}
          fixLabel={null}
          fixAction={null}
          running={fixing}
          onFix={runFix}
        />

        <IssueCard
          title="Truly uncontactable prospects"
          severity="info"
          description="No phone, no WhatsApp, no Instagram. Should be classified COLD."
          count={data.issues.noContact.count}
          sample={data.issues.noContact.sample}
          fixLabel={null}
          fixAction={null}
          running={fixing}
          onFix={runFix}
        />

        <IssueCard
          title="Missing business name"
          severity="error"
          description="Empty name string — likely a broken import. Manual cleanup needed."
          count={data.issues.missingName.count}
          sample={data.issues.missingName.sample}
          fixLabel={null}
          fixAction={null}
          running={fixing}
          onFix={runFix}
        />
      </div>

      {/* 20 random HOT sample */}
      <div className="mt-6 rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">20 random HOT prospects (verification)</h2>
          <div className="text-[11px] text-[#64748B] mt-0.5">Each row should render at least one of: WA, IG, Call.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Instagram</th>
                <th className="px-3 py-2 text-center">Predicted actions</th>
                <th className="px-3 py-2 text-center">Score</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.sample.map((p) => {
                const hasPhone = !!(p.phone && p.phone.trim());
                const hasIG = !!(p.instagram && p.instagram.trim());
                return (
                  <tr key={p.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                    <td className="px-3 py-2 text-[13px] font-medium text-[#0F172A]">{p.name}</td>
                    <td className="px-3 py-2 text-[12px] text-[#475569] tabular-nums">{p.phone || <span className="text-[#94A3B8]">—</span>}</td>
                    <td className="px-3 py-2 text-[12px] text-[#475569]">{p.instagram || <span className="text-[#94A3B8]">—</span>}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        {hasPhone && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">WA</span>}
                        {hasIG && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-[#7C3AED]">IG</span>}
                        {hasPhone && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Call</span>}
                        {!hasPhone && !hasIG && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">none</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-[12px] tabular-nums">{p.score ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/prospecting/${p.id}`} className="text-[#64748B] hover:text-[#8B00FF]">
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
function Stat({ label, value, color = "default" }: { label: string; value: number; color?: "default" | "rose" | "amber" | "gray" }) {
  const colors: Record<string, string> = {
    default: "text-[#0F172A]",
    rose: "text-rose-700",
    amber: "text-amber-700",
    gray: "text-[#64748B]",
  };
  return (
    <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">{label}</div>
      <div className={cn("text-2xl sm:text-3xl font-bold tabular-nums", colors[color])}>{value.toLocaleString()}</div>
    </div>
  );
}

function IssueCard({
  title, description, severity, count, sample, mismatchSample, fixLabel, fixAction, running, onFix,
}: {
  title: string; description: string; severity: "error" | "warn" | "info";
  count: number;
  sample?: SlimProspect[];
  mismatchSample?: MismatchProspect[];
  fixLabel: string | null; fixAction: string | null;
  running: string | null;
  onFix: (action: string) => void;
}) {
  const tone = severity === "error" ? "rose" : severity === "warn" ? "amber" : "gray";
  const ok = count === 0;
  return (
    <div className={cn(
      "rounded-2xl border p-4 sm:p-5 bg-white",
      ok ? "border-emerald-200" : tone === "rose" ? "border-rose-200" : tone === "amber" ? "border-amber-200" : "border-[var(--os-border)]"
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            ok ? "bg-emerald-50 text-emerald-600" : tone === "rose" ? "bg-rose-50 text-rose-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-[#64748B]"
          )}>
            {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#0F172A]">{title}</div>
            <div className="text-[12px] text-[#475569] mt-0.5">{description}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn("text-3xl font-bold tabular-nums", ok ? "text-emerald-700" : "text-[#0F172A]")}>{count}</div>
        </div>
      </div>

      {!ok && fixAction && fixLabel && (
        <button
          onClick={() => onFix(fixAction)}
          disabled={!!running}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm disabled:opacity-50"
        >
          {running === fixAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {fixLabel}
        </button>
      )}

      {!ok && sample && sample.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--os-border)] bg-gray-50/40 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-[11.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-[#64748B] font-medium bg-white border-b border-[var(--os-border)] sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Phone</th>
                  <th className="px-2 py-1 text-left">IG</th>
                  <th className="px-2 py-1 text-left">Label</th>
                </tr>
              </thead>
              <tbody>
                {sample.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--os-border)] last:border-0">
                    <td className="px-2 py-1 text-[#0F172A] font-medium">
                      <Link href={`/admin/prospecting/${p.id}`} className="hover:text-[#7C3AED]">{p.name}</Link>
                    </td>
                    <td className="px-2 py-1 text-[#475569]">{p.phone || "—"}</td>
                    <td className="px-2 py-1 text-[#475569]">{p.instagram || "—"}</td>
                    <td className="px-2 py-1">{p.qualityLabel || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!ok && mismatchSample && mismatchSample.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--os-border)] bg-gray-50/40 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-[11.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-[#64748B] font-medium bg-white border-b border-[var(--os-border)] sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Stored</th>
                  <th className="px-2 py-1 text-left">Should be</th>
                </tr>
              </thead>
              <tbody>
                {mismatchSample.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--os-border)] last:border-0">
                    <td className="px-2 py-1 text-[#0F172A] font-medium">
                      <Link href={`/admin/prospecting/${p.id}`} className="hover:text-[#7C3AED]">{p.name}</Link>
                    </td>
                    <td className="px-2 py-1 text-[#475569]">{p.stored || "null"}</td>
                    <td className="px-2 py-1 text-emerald-700 font-semibold">{p.recomputed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
