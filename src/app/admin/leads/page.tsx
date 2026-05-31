"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const STATUSES = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "CLOSED"] as const;
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-600 border-blue-100",
  CONTACTED: "bg-amber-50 text-amber-600 border-amber-100",
  QUALIFIED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CLOSED: "bg-gray-100 text-gray-500 border-gray-200",
};

type Lead = { id: string; fullName: string; email: string; subject: string; status: string; createdAt: string };

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "ALL";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter !== "ALL") qs.set("status", statusFilter);
    qs.set("page", String(pageParam));
    fetch(`/api/admin/leads?${qs}`).then((r) => {
      if (r.status === 401) { router.push("/admin/login"); return null; }
      return r.json();
    }).then((data) => { if (data) { setLeads(data.leads); setTotal(data.total); setPages(data.pages); } }).catch(() => {}).finally(() => setLoading(false));
  }, [statusFilter, pageParam, router]);

  function navigate(status: string, page = 1) {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/leads${qs.toString() ? `?${qs}` : ""}`);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <p className="text-sm text-gray-400 mt-0.5">{total} total</p>
      </div>

      <div className="flex gap-1.5 mb-6">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => navigate(s)} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${statusFilter === s ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No leads found.</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {leads.map((lead) => (
              <Link key={lead.id} href={`/admin/leads/${lead.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-gray-900">{lead.fullName}</p>
                  <p className="text-[12px] text-gray-400 truncate">{lead.subject}</p>
                </div>
                <p className="text-[12px] text-gray-400 hidden sm:block">{lead.email}</p>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase border shrink-0 ${STATUS_COLORS[lead.status] ?? STATUS_COLORS.NEW}`}>
                  {lead.status}
                </span>
                <p className="text-[12px] text-gray-400 shrink-0">{new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</p>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex justify-center gap-1.5 mt-8">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => navigate(statusFilter, p)} className={`w-9 h-9 rounded-xl text-[13px] font-medium transition-all ${p === pageParam ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-100 hover:border-gray-300"}`}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
