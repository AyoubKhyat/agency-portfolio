"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus, Search, Building2, Phone, Mail, Globe, ExternalLink, MessageCircle,
  Briefcase, FileText, StickyNote, Users, DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  PAUSED:   "bg-amber-50 text-amber-700 border-amber-100",
  ARCHIVED: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
};

const STATUS_DOTS: Record<string, string> = {
  ACTIVE:   "bg-emerald-500",
  PAUSED:   "bg-amber-500",
  ARCHIVED: "bg-[#9CA3AF]",
};

type Client = {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  industry: string;
  contractValue: number;
  acquisitionSource: string;
  status: string;
  accountManagerId: string | null;
  accountManager: { id: string; fullName: string; avatarInitials: string } | null;
  _count: { projects: number; proposals: number; notes: number };
  createdAt: string;
  updatedAt: string;
};

function formatMAD(value: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
}

function MoneyStat({ value, label, accent, index }: { value: number; label: string; accent?: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "rounded-2xl border p-4 sm:p-5 shadow-sm",
        accent
          ? "border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50"
          : "border-[var(--os-border)] bg-white",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-xl",
          accent ? "bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]" : "bg-[#F1F5F9] text-[#475569]",
        )}>
          <DollarSign className="w-5 h-5" />
        </div>
      </div>
      <div className={cn("text-2xl sm:text-3xl font-bold tracking-tight", accent ? "text-[#8B00FF]" : "text-[#0F172A]")}>
        {formatMAD(value)}
        <span className="text-[12px] sm:text-[13px] font-medium text-[#9CA3AF] ml-1.5">MAD</span>
      </div>
      <div className="text-[12px] sm:text-[13px] text-[#64748B] mt-1 font-medium">{label}</div>
    </motion.div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => { if (Array.isArray(d)) setClients(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    let list = clients;
    if (filter !== "ALL") list = list.filter((c) => c.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q),
      );
    }
    return list;
  }, [clients, filter, query]);

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.status === "ACTIVE").length;
    const totalValue = clients.reduce((sum, c) => sum + (c.contractValue || 0), 0);
    const avg = clients.length ? totalValue / clients.length : 0;
    return { total: clients.length, active, totalValue, avg };
  }, [clients]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Clients" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="os-skeleton h-44 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Active accounts, contracts and account managers"
        count={clients.length}
        actions={
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white rounded-lg text-[13px] font-semibold shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            <Plus className="w-4 h-4" /> New client
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={stats.total} label="Total clients" icon={<Building2 className="w-5 h-5" />} index={0} />
        <StatCard value={stats.active} label="Active" icon={<Users className="w-5 h-5" />} index={1} />
        <MoneyStat value={stats.totalValue} label="Contract value" accent index={2} />
        <MoneyStat value={stats.avg} label="Avg deal size" index={3} />
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <FilterTabs
          items={[
            { value: "ALL", label: "All", count: clients.length },
            { value: "ACTIVE", label: "Active", count: clients.filter((c) => c.status === "ACTIVE").length },
            { value: "PAUSED", label: "Paused", count: clients.filter((c) => c.status === "PAUSED").length },
            { value: "ARCHIVED", label: "Archived", count: clients.filter((c) => c.status === "ARCHIVED").length },
          ]}
          active={filter}
          onChange={setFilter}
        />
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients..."
            className="h-10 pl-9 pr-3 w-72 bg-white border border-[#E5E7EB] rounded-lg text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-7 h-7" />}
          title={clients.length === 0 ? "No clients yet" : "No clients match this filter"}
          description={clients.length === 0
            ? "Convert a prospect or create one manually to get started."
            : "Try a different filter or clear the search."}
          action={
            clients.length === 0 ? (
              <Link
                href="/admin/clients/new"
                className="inline-flex items-center gap-2 h-10 px-4 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[13px] font-semibold"
              >
                <Plus className="w-4 h-4" /> New client
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <Link
                href={`/admin/clients/${c.id}`}
                className="block bg-white border border-[#E5E7EB] rounded-xl p-5 hover:border-[#D1D5DB] hover:shadow-md hover:shadow-slate-900/[0.04] transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#111827] truncate">{c.companyName}</h3>
                    <p className="text-[12px] text-[#6B7280] truncate">{c.industry || "—"}</p>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0",
                    STATUS_COLORS[c.status] ?? STATUS_COLORS.ACTIVE,
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOTS[c.status] ?? STATUS_DOTS.ACTIVE)} />
                    {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3">
                  {c.contactPerson && (
                    <p className="text-[13px] text-[#374151] truncate">{c.contactPerson}</p>
                  )}
                  {c.email && (
                    <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 shrink-0" /> {c.email}
                    </p>
                  )}
                  {c.phone && (
                    <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5">
                      <Phone className="w-3 h-3 shrink-0" /> {c.phone}
                    </p>
                  )}
                  {c.website && (
                    <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5 truncate">
                      <Globe className="w-3 h-3 shrink-0" /> {c.website.replace(/^https?:\/\//, "")}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <Briefcase className="w-3 h-3" /> {c._count.projects}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <FileText className="w-3 h-3" /> {c._count.proposals}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <StickyNote className="w-3 h-3" /> {c._count.notes}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-[#111827]">
                    {formatMAD(c.contractValue)} <span className="text-[10px] font-normal text-[#9CA3AF]">MAD</span>
                  </p>
                </div>

                {c.accountManager && (
                  <div className="flex items-center gap-2 pt-3 mt-2 border-t border-[#F3F4F6]">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[10px] font-bold">
                      {c.accountManager.avatarInitials}
                    </span>
                    <span className="text-[11px] text-[#6B7280]">
                      Managed by {c.accountManager.fullName}
                    </span>
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
