"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileSignature, DollarSign, ShieldCheck, AlertCircle, CalendarClock,
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
  DRAFT:             "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  PENDING_SIGNATURE: "bg-amber-50 text-amber-700 border-amber-100",
  SIGNED:            "bg-emerald-50 text-emerald-700 border-emerald-100",
  ACTIVE:            "bg-blue-50 text-blue-700 border-blue-100",
  COMPLETED:         "bg-purple-50 text-purple-700 border-purple-100",
  CANCELLED:         "bg-red-50 text-red-700 border-red-100",
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
        <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6] overflow-hidden">
          {filtered.map((c) => {
            const href = c.client ? `/admin/clients/${c.client.id}` : c.prospect ? `/admin/prospecting/${c.prospect.id}` : "#";
            return (
              <Link key={c.id} href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAFAFE]">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-medium text-[#111827] truncate">{c.title}</p>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0", STATUS_STYLE[c.status] ?? STATUS_STYLE.DRAFT)}>
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    {c.client?.companyName ?? c.prospect?.name ?? "—"} · {relativeDate(c.createdAt)}
                  </p>
                </div>
                <p className="text-[14px] font-semibold text-[#111827] shrink-0">
                  {formatMAD(c.amount)} <span className="text-[10px] font-normal text-[#9CA3AF]">{c.currency}</span>
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
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#8B00FF]">
        {formatMAD(value)}<span className="text-[12px] sm:text-[13px] font-medium text-[#9CA3AF] ml-1.5">MAD</span>
      </div>
      <div className="text-[12px] sm:text-[13px] text-[#64748B] mt-1 font-medium">Signed + active value</div>
    </div>
  );
}
