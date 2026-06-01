"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, Send, Reply, UserCheck, TrendingUp, Percent } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";

type StatusCount = { status: string; _count: number };
type SectorCount = { sector: string; _count: { sector: number } };
type SectorPerf = {
  sector: string; total: number; sent: number; replied: number; converted: number;
  sentRate: number; replyRate: number; conversionRate: number;
};

type FunnelStep = { status: string; count: number };

type AnalyticsData = {
  prospectsByStatus: StatusCount[];
  prospectsBySector: SectorCount[];
  leadsByStatus: StatusCount[];
  sectorPerformance: SectorPerf[];
  funnel: FunnelStep[];
};

const STATUS_COLORS: Record<string, string> = {
  A_ENVOYER: "#3b82f6", ENVOYE: "#f59e0b", REPONDU: "#22c55e", PAS_DE_WHATSAPP: "#ef4444", CONVERTI: "#8b5cf6",
  MEETING: "#8b5cf6", PROPOSAL_SENT: "#3b82f6", NEGOTIATION: "#f59e0b", CLIENT: "#10b981", LOST: "#6b7280",
};

const FUNNEL_LABELS: Record<string, string> = {
  A_ENVOYER: "Prospects", ENVOYE: "Contacted", REPONDU: "Replied", MEETING: "Meeting",
  PROPOSAL_SENT: "Proposal", NEGOTIATION: "Negotiation", CLIENT: "Client", LOST: "Lost",
};
const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "To Send", ENVOYE: "Sent", REPONDU: "Replied", PAS_DE_WHATSAPP: "No WA", CONVERTI: "Converted",
};
const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6"];

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function getCount(arr: StatusCount[] | undefined, status: string) {
    return arr?.find((s) => s.status === status)?._count || 0;
  }
  function getTotal(arr: StatusCount[] | undefined) {
    return arr?.reduce((sum, s) => sum + s._count, 0) || 0;
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Performance metrics and insights" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <div className="os-skeleton h-80 rounded-xl" />
          <div className="os-skeleton h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const totalProspects = getTotal(data?.prospectsByStatus);
  const sent = getCount(data?.prospectsByStatus, "ENVOYE") + getCount(data?.prospectsByStatus, "REPONDU") + getCount(data?.prospectsByStatus, "CONVERTI") + getCount(data?.prospectsByStatus, "PAS_DE_WHATSAPP");
  const replied = getCount(data?.prospectsByStatus, "REPONDU") + getCount(data?.prospectsByStatus, "CONVERTI");
  const converted = getCount(data?.prospectsByStatus, "CONVERTI");
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0";
  const conversionRate = sent > 0 ? ((converted / sent) * 100).toFixed(1) : "0";

  const pieData = data?.prospectsByStatus?.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s._count,
    color: STATUS_COLORS[s.status] || "#71717a",
  })) || [];

  const sectorChartData = data?.prospectsBySector?.slice(0, 10).map((s) => ({
    name: s.sector.length > 15 ? s.sector.slice(0, 14) + "…" : s.sector,
    count: s._count.sector,
  })) || [];

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Performance metrics and insights" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={totalProspects} label="Total Prospects" icon={<Target className="w-5 h-5" />} index={0} />
        <StatCard value={sent} label="Messages Sent" icon={<Send className="w-5 h-5" />} index={1} />
        <StatCard value={replied} label="Replies" icon={<Reply className="w-5 h-5" />} accent index={2} />
        <StatCard value={converted} label="Converted" icon={<UserCheck className="w-5 h-5" />} index={3} />
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <GlassCard padding="lg" hover initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{replyRate}%</div>
              <div className="text-xs text-[#475569]">Reply Rate</div>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="lg" hover initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Percent className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{conversionRate}%</div>
              <div className="text-xs text-[#475569]">Conversion Rate</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {/* Pipeline Distribution */}
        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Pipeline Distribution</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid rgba(120,120,180,0.15)", borderRadius: "12px", fontSize: "12px", color: "#111827", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  itemStyle={{ color: "#111827" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {pieData.map((entry, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                <span className="text-[11px] text-[#475569]">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Top Sectors */}
        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Prospects by Sector</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid rgba(120,120,180,0.15)", borderRadius: "12px", fontSize: "12px", color: "#111827", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Conversion Funnel */}
      {data?.funnel && data.funnel.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-6">
          <GlassCard padding="lg">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Sales Pipeline</h3>
            <div className="space-y-3">
              {data.funnel.filter(s => s.status !== "LOST").map((step, i) => {
                const maxCount = Math.max(...data.funnel.map(s => s.count), 1);
                const pct = (step.count / maxCount) * 100;
                const prevStep = i > 0 ? data.funnel.filter(s => s.status !== "LOST")[i - 1] : null;
                const dropOff = prevStep && prevStep.count > 0 ? Math.round(((prevStep.count - step.count) / prevStep.count) * 100) : null;
                return (
                  <div key={step.status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#0F172A]">{FUNNEL_LABELS[step.status] || step.status}</span>
                        {dropOff !== null && dropOff > 0 && (
                          <span className="text-[10px] text-red-500 font-medium">-{dropOff}%</span>
                        )}
                      </div>
                      <span className="text-[13px] font-bold text-[#0F172A]">{step.count}</span>
                    </div>
                    <div className="h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: STATUS_COLORS[step.status] || "#8b5cf6" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 2)}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.08 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {data.funnel.find(s => s.status === "LOST")?.count ? (
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                <span className="text-[13px] text-[#64748B]">Lost</span>
                <span className="text-[13px] font-bold text-[#64748B]">{data.funnel.find(s => s.status === "LOST")?.count || 0}</span>
              </div>
            ) : null}
          </GlassCard>
        </motion.div>
      )}

      {/* Sector Performance Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-6">
        <GlassCard padding="none">
          <div className="px-5 py-4 border-b border-[var(--os-border)]">
            <h3 className="text-sm font-semibold text-[#0F172A]">Sector Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50/50">
                  <th className="text-left px-5 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Sector</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Total</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Sent</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Replied</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Converted</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Sent %</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Reply %</th>
                  <th className="text-center px-3 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {data?.sectorPerformance?.map((s) => (
                  <tr key={s.sector} className="border-b border-[var(--os-border)] hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-2.5 text-[#1E293B] text-[13px] font-medium">{s.sector}</td>
                    <td className="text-center px-3 py-2.5 text-gray-600">{s.total}</td>
                    <td className="text-center px-3 py-2.5 text-gray-600">{s.sent}</td>
                    <td className="text-center px-3 py-2.5">
                      <span className={s.replied > 0 ? "text-emerald-600 font-medium" : "text-[#64748B]"}>{s.replied}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className={s.converted > 0 ? "text-purple-600 font-medium" : "text-[#64748B]"}>{s.converted}</span>
                    </td>
                    <td className="text-center px-3 py-2.5 text-[#475569]">{s.sentRate}%</td>
                    <td className="text-center px-3 py-2.5">
                      <Badge variant={s.replyRate > 5 ? "green" : s.replyRate > 0 ? "amber" : "default"} size="sm">{s.replyRate}%</Badge>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <Badge variant={s.conversionRate > 0 ? "purple" : "default"} size="sm">{s.conversionRate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
