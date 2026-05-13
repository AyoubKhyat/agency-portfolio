"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const STATUSES = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "CLOSED"] as const;

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/20 text-blue-400",
  CONTACTED: "bg-yellow-500/20 text-yellow-400",
  QUALIFIED: "bg-green-500/20 text-green-400",
  CLOSED: "bg-gray-500/20 text-gray-400",
};

type Lead = {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  status: string;
  createdAt: string;
};

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 animate-pulse">Loading...</div>}>
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

    fetch(`/api/admin/leads?${qs}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setLeads(data.leads);
          setTotal(data.total);
          setPages(data.pages);
        }
        setLoading(false);
      });
  }, [statusFilter, pageParam, router]);

  function navigate(status: string, page = 1) {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/leads${qs.toString() ? `?${qs}` : ""}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">
          Leads <span className="text-gray-500 text-lg font-normal">({total})</span>
        </h1>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => navigate(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-violet-500/15 text-violet-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse">Loading...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No leads found.</div>
      ) : (
        <>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Subject</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${lead.id}`} className="text-gray-200 font-medium hover:text-violet-400 transition-colors">
                        {lead.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{lead.email}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{lead.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[lead.status] ?? STATUS_COLORS.NEW}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => navigate(statusFilter, p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === pageParam
                      ? "bg-violet-500 text-white"
                      : "text-gray-500 hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
