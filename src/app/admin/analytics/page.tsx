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
import { formatRate, REPORT_CURRENCY, type ProposalReport, type ProspectingReport } from "@/lib/prospecting-report";

type AnalyticsData = { report: ProspectingReport; proposals: ProposalReport };

const STAGE_COLORS: Record<string, string> = {
  TO_CONTACT: "#3b82f6", WAITING: "#f59e0b", REPLIED: "#22c55e", IN_TALKS: "#8b5cf6",
  WON: "#10b981", UNREACHABLE: "#ef4444", CLOSED: "#6b7280", OTHER: "#a1a1aa",
};
const FUNNEL_COLORS: Record<string, string> = {
  PROSPECTS: "#3b82f6", CONTACTED: "#f59e0b", REPLIED: "#22c55e", IN_TALKS_OR_WON: "#8b5cf6", WON: "#10b981",
};
const TOOLTIP_STYLE = { background: "var(--os-popover)", border: "1px solid var(--os-border)", borderRadius: "12px", fontSize: "12px", color: "var(--os-text)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };

const SUBTITLE = "All time. Contacts, replies and wins by sector.";

function mad(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.ok ? r.json() : null; })
      .then((d) => d && d.report && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Prospecting report" subtitle={SUBTITLE} />
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

  if (!data) {
    return (
      <div>
        <PageHeader title="Prospecting report" subtitle={SUBTITLE} />
        <GlassCard padding="lg"><p className="text-sm text-[#475569] os-dark:text-[var(--os-text)]">The report could not be loaded.</p></GlassCard>
      </div>
    );
  }

  const { report, proposals } = data;
  const t = report.totals;

  const pieData = report.stages.map((s) => ({ name: s.label, value: s.count, color: STAGE_COLORS[s.key] || "#71717a" }));
  const sectorChartData = report.sectors.slice(0, 10).map((s) => ({
    name: s.sector.length > 15 ? s.sector.slice(0, 14) + "…" : s.sector,
    count: s.prospects,
  }));
  const funnelMax = Math.max(...report.funnel.map((s) => s.count), 1);

  return (
    <div>
      <PageHeader title="Prospecting report" subtitle={SUBTITLE} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={t.prospects} label="Prospects" icon={<Target className="w-5 h-5" />} index={0} />
        <StatCard value={t.contacted} label="Marked contacted" icon={<Send className="w-5 h-5" />} index={1} />
        <StatCard value={t.replied} label="Replied (incl. in talks, won)" icon={<Reply className="w-5 h-5" />} accent index={2} />
        <StatCard value={t.won} label="Won" icon={<UserCheck className="w-5 h-5" />} index={3} />
      </div>

      {/* Send evidence — kept apart from "contacted" */}
      <GlassCard padding="lg" className="mt-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-1">Send evidence for contacted prospects</h3>
        <p className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mb-3">Marked contacted is not the same as a message sent. Only a send recorded since the 7 July 2026 cleanup counts as evidence, and even that does not confirm delivery.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Evidence value={t.sendRecorded} label="Send recorded" hint={`${formatRate(t.sendRecordedRate)} of contacted`} tone="text-emerald-600 os-dark:text-emerald-400" />
          <Evidence value={t.legacySendOnly} label="Old send only" hint="Before the cleanup; unconfirmed" tone="text-amber-600 os-dark:text-amber-400" />
          <Evidence value={t.noSendRecord} label="No send record" hint={`${t.contactedByStatusOnly} by status alone`} tone="text-[#475569] os-dark:text-[var(--os-text)]" />
          <Evidence value={t.waitingWithoutSendRecord} label="Waiting, no send record" hint="Status Sent (ENVOYE) only" tone="text-[#475569] os-dark:text-[var(--os-text)]" />
        </div>
      </GlassCard>

      {/* Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <RateCard icon={<TrendingUp className="w-5 h-5 text-emerald-600 os-dark:text-emerald-400" />} bg="bg-emerald-50 os-dark:bg-emerald-500/10" tone="text-emerald-600 os-dark:text-emerald-400"
          value={formatRate(t.replyRate)} label="Replied ÷ marked contacted" delay={0.35} />
        <RateCard icon={<Percent className="w-5 h-5 text-purple-600 os-dark:text-purple-400" />} bg="bg-purple-50 os-dark:bg-purple-500/10" tone="text-purple-600 os-dark:text-purple-400"
          value={formatRate(t.winRate)} label="Won ÷ marked contacted" delay={0.4} />
      </div>

      {/* Proposals */}
      {proposals.counts.total > 0 && (
        <GlassCard padding="lg" className="mt-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-1">Proposals</h3>
          <p className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mb-3">
            {proposals.counts.draft} draft · {proposals.counts.sent} sent, awaiting answer · {proposals.counts.accepted} accepted · {proposals.counts.rejected} rejected
            {proposals.counts.other > 0 ? ` · ${proposals.counts.other} other status` : ""}
            {" "}· Accepted ÷ answered: {formatRate(proposals.acceptanceRate)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Evidence value={mad(proposals.mad.openValue)} label={`Sent, awaiting answer (${REPORT_CURRENCY})`} tone="text-[#0F172A] os-dark:text-[var(--os-text)]" />
            <Evidence value={mad(proposals.mad.acceptedValue)} label={`Accepted proposals (${REPORT_CURRENCY})`} hint="Not invoiced or paid revenue" tone="text-emerald-600 os-dark:text-emerald-400" />
            <Evidence value={mad(proposals.mad.draftValue)} label={`Drafts, not sent (${REPORT_CURRENCY})`} tone="text-[#475569] os-dark:text-[var(--os-text)]" />
            <Evidence
              value={proposals.mad.averageIssued === null ? "—" : mad(proposals.mad.averageIssued)}
              label={`Average issued proposal (${REPORT_CURRENCY})`}
              hint={`Across ${proposals.mad.averageBasis} sent, accepted or rejected`}
              tone="text-[#8B00FF] os-dark:text-[var(--os-purple)]"
            />
          </div>
          {proposals.excludedNonMad > 0 && (
            <p className="text-[12px] text-amber-700 os-dark:text-amber-300 mt-3">
              {proposals.excludedNonMad} proposal{proposals.excludedNonMad === 1 ? "" : "s"} in another currency (or without a valid amount) left out of the {REPORT_CURRENCY} totals and average.
            </p>
          )}
        </GlassCard>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-4">Current stage</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "var(--os-text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {pieData.map((entry, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                <span className="text-[11px] text-[#475569] os-dark:text-[var(--os-text)]">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-4">Prospects by sector</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "var(--os-text)" }} cursor={{ fill: "rgba(139, 92, 246, 0.08)" }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Funnel — each step is a subset of the one before */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-6">
        <GlassCard padding="lg">
          <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-1">Prospecting funnel</h3>
          <p className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mb-5">Based on each prospect&apos;s current stage. Every step is part of the step above it.</p>
          <div className="space-y-3">
            {report.funnel.map((step, i) => {
              const prev = i > 0 ? report.funnel[i - 1] : null;
              // Prospects → Contacted is the backlog, not a loss: say so plainly instead of a red drop-off.
              const notYetContacted = step.key === "CONTACTED" && prev ? prev.count - step.count : null;
              const dropOff = notYetContacted === null && prev && prev.count > 0 ? Math.round(((prev.count - step.count) / prev.count) * 100) : null;
              return (
                <div key={step.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{step.label}</span>
                      {notYetContacted !== null && notYetContacted > 0 && <span className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">{notYetContacted} not yet contacted</span>}
                      {dropOff !== null && dropOff > 0 && <span className="text-[11px] text-red-500 os-dark:text-red-400 font-medium">-{dropOff}%</span>}
                    </div>
                    <span className="text-[13px] font-bold text-[#0F172A] os-dark:text-[var(--os-text)]">{step.count}</span>
                  </div>
                  <div className="h-3 bg-[#F1F5F9] os-dark:bg-[var(--os-surface-2)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: FUNNEL_COLORS[step.key] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max((step.count / funnelMax) * 100, 2)}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + i * 0.08 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-[#F1F5F9] os-dark:border-[var(--os-border)] flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
            <span>Closed (lost or refused): <span className="font-bold">{report.funnelAside.closed}</span></span>
            <span>Unreachable: <span className="font-bold">{report.funnelAside.unreachable}</span></span>
          </div>
          <p className="mt-2 text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">Closed and Unreachable are stages of their own, not funnel steps. One with a first-contact date or a send record is also counted in Contacted.</p>
        </GlassCard>
      </motion.div>

      {/* Sector Performance Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-6">
        <GlassCard padding="none">
          <div className="px-5 py-4 border-b border-[var(--os-border)]">
            <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">Sector performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50/50 os-dark:bg-[var(--os-surface-2)]">
                  {["Sector", "Prospects", "Contacted", "Send recorded", "Replied", "Won", "Contacted %", "Replied %", "Won %"].map((h, i) => (
                    <th key={h} className={`${i === 0 ? "text-left px-5" : "text-center px-3"} py-2.5 text-[#475569] os-dark:text-[var(--os-text)] font-medium text-[11px] uppercase tracking-wider`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.sectors.map((s) => (
                  <tr key={s.sector} className="border-b border-[var(--os-border)] hover:bg-gray-50 os-dark:hover:bg-[var(--os-hover)] transition-colors">
                    <td className="px-5 py-2.5 text-[#1E293B] os-dark:text-[var(--os-text)] text-[13px] font-medium">{s.sector}</td>
                    <td className="text-center px-3 py-2.5 text-gray-600 os-dark:text-[var(--os-text)]">{s.prospects}</td>
                    <td className="text-center px-3 py-2.5 text-gray-600 os-dark:text-[var(--os-text)]">{s.contacted}</td>
                    <td className="text-center px-3 py-2.5 text-gray-600 os-dark:text-[var(--os-text)]">{s.sendRecorded}</td>
                    <td className="text-center px-3 py-2.5">
                      <span className={s.replied > 0 ? "text-emerald-600 os-dark:text-emerald-400 font-medium" : "text-[#64748B] os-dark:text-[var(--os-text-soft)]"}>{s.replied}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className={s.won > 0 ? "text-purple-600 os-dark:text-purple-400 font-medium" : "text-[#64748B] os-dark:text-[var(--os-text-soft)]"}>{s.won}</span>
                    </td>
                    <td className="text-center px-3 py-2.5 text-[#475569] os-dark:text-[var(--os-text)]">{formatRate(s.contactedRate)}</td>
                    <td className="text-center px-3 py-2.5">
                      <Badge variant={s.replyRate !== null && s.replyRate > 5 ? "green" : s.replyRate ? "amber" : "default"} size="sm">{formatRate(s.replyRate)}</Badge>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <Badge variant={s.winRate ? "purple" : "default"} size="sm">{formatRate(s.winRate)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>

      {/* Definitions */}
      <GlassCard padding="lg" className="mt-6">
        <h3 className="text-sm font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] mb-2">How these numbers are counted</h3>
        <dl className="space-y-1.5 text-[12px] text-[#475569] os-dark:text-[var(--os-text)]">
          <Def term="Marked contacted">Same as Today: a first-contact date, a stage of Waiting, Replied, In talks or Won, or any send record. It does not prove a message was sent.</Def>
          <Def term="Send recorded">A send button or saved outreach message logged since the 7 July 2026 cleanup. Older records are shown as &ldquo;Old send only&rdquo;. A status of Sent (ENVOYE) on its own is not a send record.</Def>
          <Def term="Replied">Prospects now in Replied, In talks or Won.</Def>
          <Def term="Won">Stage Won (CLIENT or CONVERTI).</Def>
          <Def term="Closed">Lost or refused (LOST, PERDU, REFUSE). Never counted as a reply, because the stored status can&apos;t show whether they answered first. Like Unreachable, it is a stage of its own, and is also counted in Contacted when there is a first-contact date or a send record.</Def>
          <Def term="Rates">Shown as &ldquo;—&rdquo; when there is nothing to divide by.</Def>
          <Def term="Proposal values">{REPORT_CURRENCY} only; proposals in another currency are counted separately, not converted. Accepted proposals are not invoiced or paid revenue.</Def>
        </dl>
      </GlassCard>
    </div>
  );
}

function Evidence({ value, label, hint, tone }: { value: number | string; label: string; hint?: string; tone: string }) {
  return (
    <div className="rounded-lg bg-gray-50/80 os-dark:bg-[var(--os-surface-2)] p-3">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-[12px] text-[#475569] os-dark:text-[var(--os-text)] font-medium">{label}</div>
      {hint && <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mt-0.5">{hint}</div>}
    </div>
  );
}

function RateCard({ icon, bg, tone, value, label, delay }: { icon: React.ReactNode; bg: string; tone: string; value: string; label: string; delay: number }) {
  return (
    <GlassCard padding="lg" hover initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
        <div>
          <div className={`text-2xl font-bold ${tone}`}>{value}</div>
          <div className="text-xs text-[#475569] os-dark:text-[var(--os-text)]">{label}</div>
        </div>
      </div>
    </GlassCard>
  );
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div><dt className="inline font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">{term}: </dt><dd className="inline">{children}</dd></div>
  );
}
