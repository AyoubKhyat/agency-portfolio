"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Kanban, List, Mail, Calendar, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/badge";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

const COLUMNS = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"] as const;
const COL_COLORS: Record<string, { border: string; bg: string; dot: string; badge: string }> = {
  NEW: { border: "border-blue-200", bg: "bg-blue-50/50", dot: "bg-blue-600", badge: "blue" },
  CONTACTED: { border: "border-amber-200", bg: "bg-amber-50/50", dot: "bg-amber-600", badge: "amber" },
  QUALIFIED: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "bg-emerald-600", badge: "green" },
  CLOSED: { border: "border-gray-200", bg: "bg-gray-50/50", dot: "bg-gray-400", badge: "default" },
};

type Lead = { id: string; fullName: string; email: string; subject: string; status: string; createdAt: string; phone?: string | null; assignedToName?: string | null };

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-96 rounded-xl" />)}</div>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "ALL";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (view === "kanban") {
      Promise.all(
        COLUMNS.map((s) => fetch(`/api/admin/leads?status=${s}&page=1`).then((r) => r.ok ? r.json() : { leads: [], total: 0 }))
      ).then((results) => {
        const all = results.flatMap((r) => r.leads);
        setAllLeads(all);
        setTotal(all.length);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      const qs = new URLSearchParams();
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      qs.set("page", String(pageParam));
      fetch(`/api/admin/leads?${qs}`)
        .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
        .then((data) => {
          if (data) { setFilteredLeads(data.leads); setTotal(data.total); setPages(data.pages); }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [view, statusFilter, pageParam, router]);

  async function updateStatus(leadId: string, newStatus: string) {
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setAllLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
    }
  }

  function navigate(status: string, page = 1) {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/leads${qs.toString() ? `?${qs}` : ""}`);
  }

  function relativeDate(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        count={total}
        actions={
          <div className="flex items-center bg-gray-50/80 border border-[var(--os-border)] rounded-lg p-0.5">
            <button onClick={() => setView("kanban")} className={cn("p-1.5 rounded-md transition-colors", view === "kanban" ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]" : "text-[#475569] hover:text-[#1E293B]")}>
              <Kanban className="w-4 h-4" />
            </button>
            <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]" : "text-[#475569] hover:text-[#1E293B]")}>
              <List className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {view === "kanban" ? (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-96 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colLeads = allLeads.filter((l) => l.status === col);
              const colors = COL_COLORS[col];
              return (
                <motion.div
                  key={col}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: COLUMNS.indexOf(col) * 0.08 }}
                  className={cn("rounded-xl border p-3 min-h-[400px]", colors.border, colors.bg)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
                      <span className="text-xs font-semibold text-[#1E293B] uppercase tracking-wide">{col}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#475569] bg-gray-100 px-1.5 py-0.5 rounded-full">{colLeads.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {colLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/admin/leads/${lead.id}`}
                        className="block p-3 rounded-lg bg-white/80 border border-[var(--os-border)] hover:border-[var(--os-border-hover)] hover:bg-white/90 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[13px] font-medium text-[#0F172A] group-hover:text-purple-600 transition-colors truncate">{lead.fullName}</span>
                        </div>
                        <p className="text-[11px] text-[#475569] truncate mb-2">{lead.subject}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{lead.email}</span>
                          <span className="ml-auto flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {relativeDate(lead.createdAt)}
                          </span>
                        </div>
                        {lead.assignedToName && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[#8B00FF]">
                            <UserCheck className="w-3 h-3" />
                            <span>{lead.assignedToName}</span>
                          </div>
                        )}
                      </Link>
                    ))}
                    {colLeads.length === 0 && (
                      <div className="text-center py-8 text-[11px] text-[#64748B]">No leads</div>
                    )}
                  </div>

                  {/* Quick move buttons at bottom for each card */}
                  {colLeads.length > 0 && col !== "CLOSED" && (
                    <div className="mt-3 pt-2 border-t border-[var(--os-border)]">
                      <p className="text-[10px] text-[#64748B] px-1 mb-1">Move selected to:</p>
                      <div className="flex gap-1 flex-wrap">
                        {COLUMNS.filter((c) => c !== col).map((targetCol) => (
                          <button
                            key={targetCol}
                            className="text-[10px] px-2 py-1 rounded bg-gray-50/80 text-[#475569] hover:text-[#1E293B] hover:bg-gray-100 transition-colors"
                            onClick={(e) => { e.preventDefault(); }}
                            title={`Drag leads to ${targetCol} or use lead detail page`}
                          >
                            {targetCol}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* List View */
        <>
          <FilterTabs
            items={[{ value: "ALL", label: "All" }, ...COLUMNS.map((s) => ({ value: s, label: s }))]}
            active={statusFilter}
            onChange={(v) => navigate(v)}
            className="mb-6"
          />

          {loading ? (
            <div className="os-skeleton h-64 rounded-xl" />
          ) : filteredLeads.length === 0 ? (
            <EmptyState icon={<Users className="w-6 h-6" />} title="No leads found" />
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {filteredLeads.map((lead) => (
                  <Link key={lead.id} href={`/admin/leads/${lead.id}`} className="block p-3.5 rounded-xl border border-[var(--os-border)] bg-white/80 hover:border-[var(--os-border-hover)] transition-all">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[13px] font-medium text-[#0F172A] truncate">{lead.fullName}</span>
                      <Badge variant={COL_COLORS[lead.status]?.badge as "blue" | "amber" | "green" | "default" || "default"} size="sm">{lead.status}</Badge>
                    </div>
                    <p className="text-[11px] text-[#475569] truncate mb-1">{lead.subject}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{lead.email}</span>
                      <span className="ml-auto">{relativeDate(lead.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block border border-[var(--os-border)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--os-border)] bg-gray-50/80">
                      <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Name</th>
                      <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Email</th>
                      <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs hidden lg:table-cell">Subject</th>
                      <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Status</th>
                      <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs hidden lg:table-cell">Assigned</th>
                      <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-[var(--os-border)] hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/leads/${lead.id}`} className="text-[#0F172A] font-medium hover:text-purple-600 transition-colors">{lead.fullName}</Link>
                        </td>
                        <td className="px-4 py-3 text-[#475569] text-xs">{lead.email}</td>
                        <td className="px-4 py-3 text-[#475569] text-xs max-w-xs truncate hidden lg:table-cell">{lead.subject}</td>
                        <td className="px-4 py-3">
                          <Badge variant={COL_COLORS[lead.status]?.badge as "blue" | "amber" | "green" | "default" || "default"} size="sm">{lead.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-[#475569] text-xs hidden lg:table-cell">
                          {lead.assignedToName ? (
                            <span className="inline-flex items-center gap-1 text-[#8B00FF]">
                              <UserCheck className="w-3 h-3" />
                              {lead.assignedToName}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#64748B] text-xs">{relativeDate(lead.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
              {pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => navigate(statusFilter, p)} className={cn("w-8 h-8 rounded-lg text-xs font-medium transition-colors", p === pageParam ? "bg-purple-500 text-white" : "text-[#475569] hover:bg-gray-100")}>{p}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
