"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, Users, FolderKanban, Clock, ArrowRight, MessageCircle, Reply, CalendarClock, AlertTriangle, CalendarDays, Layers, TrendingUp, DollarSign, CheckSquare, Sun, Inbox, Calendar as CalendarIcon, Phone, Video, MapPin, BarChart3, PieChart, Activity, UsersRound } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { PageHeader } from "@/components/admin/page-header";
import { FunnelChart, PipelineFunnel, LineChart, DonutChart, BarChart, TeamPerformanceChart } from "@/components/admin/charts";
import Link from "next/link";

type StatusCount = { status: string; _count: number };
type SectorCount = { sector: string; _count: { sector: number } };
type RecentLead = { id: string; fullName: string; status: string; createdAt: string; subject: string };

type DashboardData = {
  leadsByStatus: StatusCount[];
  prospectsByStatus: StatusCount[];
  prospectsBySector: SectorCount[];
  followUpCandidates: number;
  totalProjects: number;
  recentLeads: RecentLead[];
  followUpsDueToday: number;
  followUpsOverdue: number;
  followUpsUpcoming: number;
};

const STATUS_VARIANT: Record<string, string> = {
  NEW: "blue", CONTACTED: "amber", QUALIFIED: "green", CLOSED: "default",
};

type ExecData = {
  totalRevenue: number; collectedRevenue: number; activeProjects: number;
  wonDealsThisMonth: number; conversionRate: number; proposalAcceptRate: number;
  overdueTasks: number; teamMembers: number;
  recentWins: { id: string; amount: number; currency: string; prospect: { name: string; sector: string } }[];
};

type Task = {
  id: string; title: string; status: string; priority: string; dueDate: string | null;
  parentLabel: string | null; parentType: string | null; parentId: string | null;
  owner: { fullName: string; avatarInitials: string } | null;
};

type TaskBuckets = { mine: Task[]; today: Task[]; overdue: Task[] };

type Meeting = {
  id: string; title: string; type: string; status: string; startAt: string;
  client: { id: string; companyName: string } | null;
  prospect: { id: string; name: string } | null;
};

type MeetingBuckets = { today: Meeting[]; upcoming: Meeting[]; missed: Meeting[] };

type ChartData = {
  leadFunnel: { status: string; count: number }[];
  prospectPipeline: { status: string; count: number }[];
  revenue: { month: string; label: string; amount: number }[];
  sectorDistribution: { sector: string; count: number }[];
  weeklyActivity: { date: string; label: string; count: number }[];
  teamPerformance: { name: string; initials: string; sent: number; replied: number; converted: number }[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [exec, setExec] = useState<ExecData | null>(null);
  const [tasks, setTasks] = useState<TaskBuckets | null>(null);
  const [meetings, setMeetings] = useState<MeetingBuckets | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); }),
      fetch("/api/admin/executive").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/tasks?scope=mine&limit=5").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/tasks?scope=today&limit=5").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/tasks?scope=overdue&limit=5").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=today&limit=10").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=upcoming&limit=10").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=missed&limit=10").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/dashboard-charts").then((r) => r.ok ? r.json() : null),
    ]).then(([d, e, mine, today, overdue, mToday, mUpcoming, mMissed, chartData]) => {
      if (d) setData(d);
      if (e) setExec(e);
      setTasks({ mine: mine ?? [], today: today ?? [], overdue: overdue ?? [] });
      setMeetings({ today: mToday ?? [], upcoming: mUpcoming ?? [], missed: mMissed ?? [] });
      if (chartData) setCharts(chartData);
    })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function getCount(arr: StatusCount[] | undefined, status: string) {
    return arr?.find((s) => s.status === status)?._count || 0;
  }
  function getTotal(arr: StatusCount[] | undefined) {
    return arr?.reduce((sum, s) => sum + s._count, 0) || 0;
  }

  function dueShort(due: string | null): string {
    if (!due) return "";
    const diff = Math.round((new Date(due).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
    if (diff < 0) return `${-diff}d overdue`;
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff < 7) return `in ${diff}d`;
    return new Date(due).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  function MeetingWidget({ title, scope, list, icon, tone }: { title: string; scope: string; list: Meeting[]; icon: React.ReactNode; tone: "blue" | "purple" | "red" }) {
    const tones: Record<typeof tone, { border: string; iconBg: string; iconText: string; count: string }> = {
      blue:   { border: list.length > 0 ? "border-blue-200" : "border-[var(--os-border)]", iconBg: "bg-blue-50",   iconText: "text-blue-600",   count: "text-blue-600" },
      purple: { border: list.length > 0 ? "border-purple-200" : "border-[var(--os-border)]", iconBg: "bg-purple-50", iconText: "text-[#8B00FF]", count: "text-[#8B00FF]" },
      red:    { border: list.length > 0 ? "border-red-200" : "border-[var(--os-border)]", iconBg: "bg-red-50",    iconText: "text-red-600",    count: "text-red-600" },
    };
    const s = tones[tone];
    return (
      <GlassCard padding="lg" className={s.border} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.iconBg} ${s.iconText}`}>{icon}</div>
            <div>
              <div className={`text-2xl font-bold ${s.count}`}>{list.length}</div>
              <div className="text-xs text-[#64748B]">{title}</div>
            </div>
          </div>
          <Link href={`/admin/meetings?scope=${scope}`} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {list.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF] text-center py-3">{tone === "red" ? "No misses." : "Nothing here."}</p>
        ) : (
          <ul className="space-y-1.5">
            {list.slice(0, 4).map((m) => {
              const start = new Date(m.startAt);
              const linked = m.client?.companyName ?? m.prospect?.name ?? "—";
              const Icon = m.type === "ZOOM" || m.type === "GOOGLE_MEET" ? Video
                          : m.type === "IN_PERSON" ? MapPin : Phone;
              return (
                <li key={m.id} className="text-[12px] text-[#374151] flex items-start gap-2">
                  <Icon className="w-3 h-3 text-[#9CA3AF] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="truncate block">{m.title}</span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {linked} · {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    );
  }

  function TaskWidget({
    title, scope, count, tasks, icon, tone,
  }: {
    title: string; scope: string; count: number; tasks: Task[]; icon: React.ReactNode;
    tone: "purple" | "amber" | "red";
  }) {
    const toneStyles: Record<typeof tone, { border: string; iconBg: string; iconText: string; count: string }> = {
      purple: { border: count > 0 ? "border-purple-200" : "border-[var(--os-border)]", iconBg: "bg-purple-50", iconText: "text-[#8B00FF]", count: "text-[#8B00FF]" },
      amber:  { border: count > 0 ? "border-amber-200" : "border-[var(--os-border)]", iconBg: "bg-amber-50", iconText: "text-amber-600", count: "text-amber-600" },
      red:    { border: count > 0 ? "border-red-200" : "border-[var(--os-border)]", iconBg: "bg-red-50", iconText: "text-red-600", count: "text-red-600" },
    };
    const s = toneStyles[tone];
    return (
      <GlassCard padding="lg" className={s.border} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.iconBg} ${s.iconText}`}>
              {icon}
            </div>
            <div>
              <div className={`text-2xl font-bold ${s.count}`}>{count}</div>
              <div className="text-xs text-[#64748B]">{title}</div>
            </div>
          </div>
          <Link href={`/admin/tasks?scope=${scope}`} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {tasks.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF] text-center py-3">All clear.</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.slice(0, 4).map((t) => (
              <li key={t.id} className="text-[12px] text-[#374151] flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full bg-[#9CA3AF] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="truncate block">{t.title}</span>
                  <span className="text-[10px] text-[#9CA3AF]">
                    {t.parentLabel ? `${t.parentLabel} · ` : ""}{dueShort(t.dueDate)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    );
  }

  const totalProspects = getTotal(data?.prospectsByStatus);
  const contacted = getCount(data?.prospectsByStatus, "ENVOYE");
  const replied = getCount(data?.prospectsByStatus, "REPONDU");
  const converted = getCount(data?.prospectsByStatus, "CONVERTI");
  const pending = getCount(data?.prospectsByStatus, "A_ENVOYER");
  const totalLeads = getTotal(data?.leadsByStatus);
  const newLeads = getCount(data?.leadsByStatus, "NEW");

  const pipeline = [
    { label: "Prospects", count: totalProspects, color: "bg-zinc-500" },
    { label: "Contacted", count: contacted, color: "bg-amber-500" },
    { label: "Replied", count: replied, color: "bg-emerald-500" },
    { label: "Converted", count: converted, color: "bg-purple-500" },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <div className="os-skeleton h-64 rounded-xl lg:col-span-2" />
          <div className="os-skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero welcome card */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#8B00FF] via-[#C026D3] to-[#2563EB] p-5 sm:p-7 mb-6 shadow-xl shadow-purple-500/15">
        <div className="absolute top-0 right-0 w-60 h-60 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-white/5 blur-2xl translate-y-1/2" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Welcome back, Ayoub</h1>
          <p className="text-white/70 text-sm mt-1">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
      </motion.div>

      {/* Executive KPIs */}
      {exec && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard value={Math.round((exec.totalRevenue || 0) / 1000)} suffix="K" label="Won Revenue (MAD)" icon={<DollarSign className="w-5 h-5" />} accent index={0} />
          <StatCard value={exec.activeProjects} label="Active Projects" icon={<Layers className="w-5 h-5" />} href="/admin/pipeline" index={1} />
          <StatCard value={exec.conversionRate} suffix="%" label="Conversion Rate" icon={<TrendingUp className="w-5 h-5" />} index={2} />
          <StatCard value={exec.wonDealsThisMonth} label="Deals This Month" icon={<Target className="w-5 h-5" />} index={3} />
        </div>
      )}

      {/* Sales Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard value={totalProspects} label="Total Prospects" icon={<Target className="w-5 h-5" />} href="/admin/prospecting" index={0} />
        <StatCard value={pending} label="To Contact" icon={<MessageCircle className="w-5 h-5" />} href="/admin/prospecting?status=A_ENVOYER" accent index={1} />
        <StatCard value={totalLeads} label="Active Leads" icon={<Users className="w-5 h-5" />} href="/admin/leads" index={2} />
        <StatCard value={data?.totalProjects || 0} label="Portfolio Projects" icon={<FolderKanban className="w-5 h-5" />} href="/admin/projects" index={3} />
      </div>

      {/* Pipeline + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <GlassCard padding="lg" className="lg:col-span-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-[#0F172A]">Sales Pipeline</h3>
            <Link href="/admin/prospecting" className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {pipeline.map((stage, i) => {
              const maxCount = Math.max(...pipeline.map((p) => p.count), 1);
              const pct = (stage.count / maxCount) * 100;
              const convRate = i > 0 && pipeline[i - 1].count > 0
                ? ((stage.count / pipeline[i - 1].count) * 100).toFixed(0) + "%"
                : null;
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[#475569]">{stage.label}</span>
                    <div className="flex items-center gap-2">
                      {convRate && <span className="text-[10px] text-[#64748B]">{convRate}</span>}
                      <span className="text-sm font-semibold text-[#0F172A]">{stage.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${stage.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 2)}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/admin/prospecting?status=A_ENVOYER" className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 hover:bg-purple-500/[0.06] border border-transparent hover:border-purple-500/20 transition-all group">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#1E293B] group-hover:text-[#0F172A]">{pending} prospects to send</div>
                <div className="text-[11px] text-[#64748B]">Start outreach</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-purple-600 transition-colors" />
            </Link>

            <Link href="/admin/prospecting?status=ENVOYE" className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 hover:bg-amber-500/[0.06] border border-transparent hover:border-amber-500/20 transition-all group">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#1E293B] group-hover:text-[#0F172A]">{data?.followUpCandidates || 0} follow-ups due</div>
                <div className="text-[11px] text-[#64748B]">Sent 3+ days ago</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-amber-600 transition-colors" />
            </Link>

            <Link href="/admin/leads?status=NEW" className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 hover:bg-blue-500/[0.06] border border-transparent hover:border-blue-500/20 transition-all group">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#1E293B] group-hover:text-[#0F172A]">{newLeads} new leads</div>
                <div className="text-[11px] text-[#64748B]">Waiting for review</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-blue-600 transition-colors" />
            </Link>
          </div>
        </GlassCard>
      </div>

      {/* Meetings */}
      {meetings && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <MeetingWidget title="Meetings today"  scope="today"    list={meetings.today}    icon={<CalendarIcon className="w-5 h-5" />} tone="blue" />
          <MeetingWidget title="Upcoming"        scope="upcoming" list={meetings.upcoming} icon={<Clock className="w-5 h-5" />} tone="purple" />
          <MeetingWidget title="Missed"          scope="missed"   list={meetings.missed}   icon={<AlertTriangle className="w-5 h-5" />} tone="red" />
        </div>
      )}

      {/* Tasks */}
      {tasks && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <TaskWidget
            title="My open tasks"
            scope="mine"
            count={tasks.mine.length}
            tasks={tasks.mine}
            icon={<CheckSquare className="w-5 h-5" />}
            tone="purple"
          />
          <TaskWidget
            title="Due today"
            scope="today"
            count={tasks.today.length}
            tasks={tasks.today}
            icon={<Sun className="w-5 h-5" />}
            tone="amber"
          />
          <TaskWidget
            title="Overdue"
            scope="overdue"
            count={tasks.overdue.length}
            tasks={tasks.overdue}
            icon={<AlertTriangle className="w-5 h-5" />}
            tone="red"
          />
        </div>
      )}

      {/* Follow-up Management */}
      {(data?.followUpsDueToday || data?.followUpsOverdue || data?.followUpsUpcoming) ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <GlassCard padding="lg" hover className={data.followUpsOverdue ? "border-red-200 bg-red-50/30" : ""} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${data.followUpsOverdue ? "bg-red-100" : "bg-gray-100"}`}>
                <AlertTriangle className={`w-5 h-5 ${data.followUpsOverdue ? "text-red-600" : "text-[#64748B]"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${data.followUpsOverdue ? "text-red-600" : "text-[#0F172A]"}`}>{data.followUpsOverdue}</div>
                <div className="text-xs text-[#64748B]">Overdue</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="lg" hover className={data.followUpsDueToday ? "border-amber-200 bg-amber-50/30" : ""} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${data.followUpsDueToday ? "bg-amber-100" : "bg-gray-100"}`}>
                <CalendarClock className={`w-5 h-5 ${data.followUpsDueToday ? "text-amber-600" : "text-[#64748B]"}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${data.followUpsDueToday ? "text-amber-600" : "text-[#0F172A]"}`}>{data.followUpsDueToday}</div>
                <div className="text-xs text-[#64748B]">Due Today</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="lg" hover initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#0F172A]">{data.followUpsUpcoming}</div>
                <div className="text-xs text-[#64748B]">Upcoming (7d)</div>
              </div>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {/* Sector Performance + Recent Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Top Sectors</h3>
          <div className="space-y-2.5">
            {data?.prospectsBySector?.slice(0, 8).map((s, i) => {
              const max = data.prospectsBySector[0]?._count?.sector || 1;
              const pct = (s._count.sector / max) * 100;
              return (
                <div key={s.sector} className="flex items-center gap-3">
                  <span className="text-xs text-[#475569] w-32 truncate">{s.sector}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-purple-500/60"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.6 + i * 0.05 }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[#475569] w-6 text-right">{s._count.sector}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#0F172A]">Recent Leads</h3>
            <Link href="/admin/leads" className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {data?.recentLeads?.map((lead) => (
              <Link
                key={lead.id}
                href={`/admin/leads/${lead.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-xs font-semibold text-purple-700">
                  {lead.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#1E293B] truncate">{lead.fullName}</div>
                  <div className="text-[11px] text-[#64748B] truncate">{lead.subject}</div>
                </div>
                <Badge variant={(STATUS_VARIANT[lead.status] || "default") as "blue" | "amber" | "green" | "default"} size="sm">{lead.status}</Badge>
              </Link>
            ))}
            {(!data?.recentLeads || data.recentLeads.length === 0) && (
              <div className="text-center py-8 text-xs text-[#64748B]">No leads yet</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Insights */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }} className="mt-6">
        <GlassCard padding="lg" className="border-purple-200 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Reply className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A] mb-1.5">Insights</h3>
              <div className="space-y-1.5 text-[13px] text-[#475569]">
                {replied > 0 && contacted > 0 && (
                  <p>Reply rate: <span className="text-emerald-600 font-medium">{((replied / contacted) * 100).toFixed(1)}%</span> — {replied} replied out of {contacted} contacted.</p>
                )}
                {data?.followUpCandidates && data.followUpCandidates > 0 && (
                  <p><span className="text-amber-600 font-medium">{data.followUpCandidates}</span> prospects sent 3+ days ago without reply — follow up today.</p>
                )}
                {data?.prospectsBySector?.[0] && (
                  <p>Top sector: <span className="text-purple-600 font-medium">{data.prospectsBySector[0].sector}</span> with {data.prospectsBySector[0]._count.sector} prospects.</p>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Recent Wins */}
      {exec?.recentWins && exec.recentWins.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }} className="mt-6">
          <GlassCard padding="lg" className="border-emerald-200/50 bg-gradient-to-r from-emerald-50/80 to-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Recent Wins</h3>
            </div>
            <div className="space-y-2">
              {exec.recentWins.map((win) => (
                <div key={win.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/60">
                  <div>
                    <span className="text-[13px] font-medium text-[#0F172A]">{win.prospect.name}</span>
                    <span className="text-[11px] text-[#64748B] ml-2">{win.prospect.sector}</span>
                  </div>
                  <span className="text-[13px] font-bold text-emerald-600">{win.amount.toLocaleString()} {win.currency}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Visual Charts ────────────────────────────────────────── */}
      {charts && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.4 }}
          className="mt-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-sm font-semibold text-[#0F172A]">Analytics</h2>
          </div>

          {/* Row 1: Lead Funnel + Prospect Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.4 }}>
              <div className="flex items-center gap-2 mb-4">
                <Inbox className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-[#0F172A]">Lead Funnel</h3>
              </div>
              <FunnelChart data={charts.leadFunnel} />
            </GlassCard>

            <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.4 }}>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-semibold text-[#0F172A]">Prospect Pipeline</h3>
              </div>
              <PipelineFunnel data={charts.prospectPipeline} />
            </GlassCard>
          </div>

          {/* Row 2: Revenue trend (full width) */}
          <div className="mt-4">
            <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.4 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-[#0F172A]">Revenue Trend</h3>
                </div>
                <span className="text-[10px] text-[#94A3B8]">Last 6 months (MAD)</span>
              </div>
              <LineChart
                data={charts.revenue.map((r) => ({ label: r.label, value: r.amount }))}
                height={220}
                color="#10B981"
                formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              />
            </GlassCard>
          </div>

          {/* Row 3: Sector donut + Weekly activity bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 0.4 }}>
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-[#0F172A]">Sector Distribution</h3>
              </div>
              <DonutChart
                data={charts.sectorDistribution.map((s) => ({
                  label: s.sector,
                  value: s.count,
                }))}
                size={160}
              />
            </GlassCard>

            <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.4 }}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-[#0F172A]">Weekly Activity</h3>
              </div>
              <BarChart
                data={charts.weeklyActivity.map((a) => ({
                  label: a.label,
                  value: a.count,
                  color: "#3B82F6",
                }))}
                height={180}
              />
            </GlassCard>
          </div>

          {/* Row 4: Team performance (full width) */}
          {charts.teamPerformance.length > 0 && (
            <div className="mt-4">
              <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.4 }}>
                <div className="flex items-center gap-2 mb-4">
                  <UsersRound className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-[#0F172A]">Team Performance</h3>
                </div>
                <TeamPerformanceChart data={charts.teamPerformance} />
              </GlassCard>
            </div>
          )}
        </motion.div>
      )}

      {/* CRM Health */}
      <CRMHealthWidget />
    </div>
  );
}

function CRMHealthWidget() {
  const [health, setHealth] = useState<{ issues: { type: string; label: string; count: number }[]; score: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/crm-health").then((r) => r.ok ? r.json() : null).then(setHealth).catch(() => {});
  }, []);

  if (!health || health.issues.length === 0) return null;

  const scoreColor = health.score >= 80 ? "text-emerald-600" : health.score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.4 }} className="mt-6">
      <GlassCard padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#0F172A]">CRM Health</h3>
          <span className={`text-2xl font-bold ${scoreColor}`}>{health.score}%</span>
        </div>
        <div className="space-y-2">
          {health.issues.map((issue) => (
            <div key={issue.label} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${issue.type === "error" ? "bg-red-500" : issue.type === "warning" ? "bg-amber-500" : "bg-blue-400"}`} />
                <span className="text-[13px] text-[#475569]">{issue.label}</span>
              </div>
              <span className={`text-[13px] font-semibold ${issue.type === "error" ? "text-red-600" : issue.type === "warning" ? "text-amber-600" : "text-[#64748B]"}`}>{issue.count}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
