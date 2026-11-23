"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileSignature, DollarSign, AlertCircle, CalendarClock,
  Send, Check, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

type Contract = {
  id: string;
  title: string;
  status: string;
  amount: number;
  currency: string;
  signedDate: string | null;
  endDate: string | null;
  createdAt: string;
  client: { id: string; companyName: string } | null;
  prospect: { id: string; name: string } | null;
  proposal: { id: string; packageName: string | null } | null;
};

const STATUSES = ["ALL", "DRAFT", "PENDING_SIGNATURE", "SIGNED", "ACTIVE", "COMPLETED", "CANCELLED"];

const STATUS_STYLE: Record<string, string> = {
  DRAFT:             "bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] text-[#374151] os-dark:text-[var(--os-text)] border-[var(--os-border)]",
  PENDING_SIGNATURE: "bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 border-amber-100 os-dark:border-amber-500/30",
  SIGNED:            "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border-emerald-100 os-dark:border-emerald-500/30",
  ACTIVE:            "bg-blue-50 os-dark:bg-blue-500/10 text-blue-700 os-dark:text-blue-300 border-blue-100 os-dark:border-blue-500/30",
  COMPLETED:         "bg-purple-50 os-dark:bg-purple-500/10 text-purple-700 os-dark:text-purple-300 border-purple-100 os-dark:border-purple-500/30",
  CANCELLED:         "bg-red-50 os-dark:bg-red-500/10 text-red-700 os-dark:text-red-300 border-red-100 os-dark:border-red-500/30",
};

function formatMAD(value: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [signingId, setSigningId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/contracts")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => { if (Array.isArray(d)) setContracts(d); })
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return contracts;
    return contracts.filter((c) => c.status === filter);
  }, [contracts, filter]);

  const stats = useMemo(() => {
    const signedValue = contracts.filter((c) => ["SIGNED", "ACTIVE"].includes(c.status)).reduce((s, c) => s + c.amount, 0);
    const pendingCount = contracts.filter((c) => c.status === "PENDING_SIGNATURE").length;
    const expiringSoon = contracts.filter((c) => {
      if (!c.endDate || !["ACTIVE", "SIGNED"].includes(c.status)) return false;
      const days = Math.floor((new Date(c.endDate).getTime() - Date.now()) / 86_400_000);
      return days >= 0 && days <= 30;
    }).length;
    return { total: contracts.length, signedValue, pendingCount, expiringSoon };
  }, [contracts]);

  const tabs = STATUSES.map((s) => ({
    value: s,
    label: s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase().replace("_", " "),
    count: s === "ALL" ? contracts.length : contracts.filter((c) => c.status === s).length,
  }));

  async function handleSendForSignature(e: React.MouseEvent, contractId: string) {
    e.preventDefault();
    e.stopPropagation();
    setSigningId(contractId);
    setCopiedId(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contractId}/sign-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate signing link");
        return;
      }
      await navigator.clipboard.writeText(data.url);
      setCopiedId(contractId);
      // Update the contract status locally if it changed to PENDING_SIGNATURE
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contractId && c.status === "DRAFT"
            ? { ...c, status: "PENDING_SIGNATURE" }
            : c
        )
      );
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      alert("Failed to generate signing link");
    } finally {
      setSigningId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="Signed engagements, drafts and pending signatures"
        count={contracts.length}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={stats.total}        label="Total contracts" icon={<FileSignature className="w-5 h-5" />} index={0} />
        <StatCard value={stats.pendingCount} label="Pending signature" icon={<AlertCircle className="w-5 h-5" />} index={1} />
        <SignedValueStat value={stats.signedValue} />
        <StatCard value={stats.expiringSoon} label="Expiring 30d"     icon={<CalendarClock className="w-5 h-5" />} index={3} />
      </div>

      <div className="mb-4">
        <FilterTabs items={tabs} active={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="w-7 h-7" />}
          title={contracts.length === 0 ? "No contracts yet" : "No contracts match this filter"}
          description="Accept a proposal to auto-generate a draft, or add one from a client workspace."
        />
      ) : (
        <div className="bg-[var(--os-surface)] border border-[var(--os-border)] rounded-xl divide-y divide-[#F3F4F6] os-dark:divide-[var(--os-border)] overflow-hidden">
          {filtered.map((c) => {
            const href = c.client ? `/admin/clients/${c.client.id}` : c.prospect ? `/admin/prospecting/${c.prospect.id}` : "#";
            return (
              <Link key={c.id} href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--os-surface-2)]">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-600 os-dark:text-emerald-400 shrink-0">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-medium text-[#111827] os-dark:text-[var(--os-text)] truncate">{c.title}</p>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0", STATUS_STYLE[c.status] ?? STATUS_STYLE.DRAFT)}>
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)] mt-0.5">
                    {c.client?.companyName ?? c.prospect?.name ?? "—"} · {relativeDate(c.createdAt)}
                  </p>
                </div>
                {/* Send for Signature button — shown for DRAFT and PENDING_SIGNATURE */}
                {(c.status === "DRAFT" || c.status === "PENDING_SIGNATURE") && (
                  <button
                    onClick={(e) => handleSendForSignature(e, c.id)}
                    disabled={signingId === c.id}
                    title={copiedId === c.id ? "Link copied!" : "Generate signing link & copy"}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition",
                      copiedId === c.id
                        ? "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-600 os-dark:text-emerald-400 border border-emerald-200 os-dark:border-emerald-500/30"
                        : "bg-purple-50 os-dark:bg-purple-500/10 text-purple-600 os-dark:text-purple-400 border border-purple-200 os-dark:border-purple-500/30 hover:bg-purple-100 os-dark:hover:bg-purple-500/15"
                    )}
                  >
                    {signingId === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : copiedId === c.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Sign Link
                      </>
                    )}
                  </button>
                )}
                <p className="text-[14px] font-semibold text-[#111827] os-dark:text-[var(--os-text)] shrink-0">
                  {formatMAD(c.amount)} <span className="text-[10px] font-normal text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">{c.currency}</span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SignedValueStat({ value }: { value: number }) {
  return (
    <div className="rounded-2xl border border-purple-200 os-dark:border-purple-500/30 bg-gradient-to-br from-purple-50 os-dark:from-purple-500/10 to-violet-50 os-dark:to-violet-500/10 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[var(--os-brand)]">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--os-brand)]">
        {formatMAD(value)}<span className="text-[12px] sm:text-[13px] font-medium text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] ml-1.5">MAD</span>
      </div>
      <div className="text-[12px] sm:text-[13px] text-[var(--os-text-soft)] mt-1 font-medium">Signed + active value</div>
    </div>
  );
}
