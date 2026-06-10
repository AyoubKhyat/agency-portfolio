"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarClock, AlertCircle, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";

type SequenceItem = {
  prospectId: string;
  prospectName: string;
  sector: string;
  scoreLabel: "HIGH" | "MEDIUM" | "LOW" | null;
  step: "followup1" | "followup2" | "followup3";
  stepLabel: string;
  dueOn: string;
  overdueDays: number;
};

const SCORE_BADGE: Record<string, string> = {
  HIGH: "bg-emerald-50 text-emerald-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-gray-50 text-gray-600",
};

export function SequencesTab() {
  const [items, setItems] = useState<SequenceItem[]>([]);
  const [counts, setCounts] = useState({ due: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"due" | "upcoming" | "all">("due");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sales-playbook/sequences");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setCounts(data.counts || { due: 0, upcoming: 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markDone(item: SequenceItem) {
    const res = await fetch(`/api/admin/prospecting/${item.prospectId}/sequence`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: item.step, done: true }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.prospectId !== item.prospectId || i.step !== item.step));
      setCounts((prev) => ({ ...prev, due: Math.max(0, prev.due - (item.overdueDays >= 0 ? 1 : 0)) }));
    }
  }

  const filtered =
    filter === "due" ? items.filter((i) => i.overdueDays >= 0)
    : filter === "upcoming" ? items.filter((i) => i.overdueDays < 0)
    : items;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["due", "upcoming", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "text-[12px] px-3 py-1.5 rounded-lg font-medium capitalize transition-all",
                filter === f
                  ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#7C3AED] border border-purple-200"
                  : "text-[#475569] hover:bg-[#F1F5F9] border border-transparent"
              )}
            >
              {f === "due" ? `Due now (${counts.due})` : f === "upcoming" ? `Upcoming (${counts.upcoming})` : `All (${items.length})`}
            </button>
          ))}
        </div>

        <div className="text-[12px] text-[#64748B]">
          Cadence: <span className="text-[#0F172A] font-medium">Day 1 → 4 → 10 → 20</span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-7 h-7" />}
          title={filter === "due" ? "Nothing due right now" : filter === "upcoming" ? "No upcoming follow-ups" : "No active sequences"}
          description={filter === "due" ? "Reach out to new prospects to start the cadence." : "Send initial contact to start the 20-day cadence."}
        />
      ) : (
        <div className="border border-[var(--os-border)] rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-[var(--os-border)]">
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Prospect</th>
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Next step</th>
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] hidden md:table-cell">Due</th>
                <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={`${item.prospectId}-${item.step}`} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/prospecting/${item.prospectId}`} className="block group">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-[#0F172A] group-hover:text-[#8B00FF]">{item.prospectName}</span>
                        {item.scoreLabel && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", SCORE_BADGE[item.scoreLabel])}>
                            {item.scoreLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">{item.sector}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#475569]">{item.stepLabel}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {item.overdueDays > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-red-600 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {item.overdueDays}d overdue
                      </span>
                    ) : item.overdueDays === 0 ? (
                      <span className="text-[12px] text-amber-700 font-medium">Today</span>
                    ) : (
                      <span className="text-[12px] text-[#64748B]">in {Math.abs(item.overdueDays)}d</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => markDone(item)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-md"
                        title="Mark this follow-up sent"
                      >
                        <Check className="w-3 h-3" />
                        Sent
                      </button>
                      <Link
                        href={`/admin/prospecting/${item.prospectId}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475569] hover:text-[#8B00FF]"
                      >
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
