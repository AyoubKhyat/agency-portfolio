"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowRight, Briefcase, Calendar, CheckSquare,
  CircleDollarSign, FileSignature, Loader2, MapPin, Phone, ShieldCheck,
  Sparkles, Target, TrendingUp, Trophy, Users, Video, Crown,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { GlassCard } from "@/components/admin/glass-card";
import { cn } from "@/lib/utils";

type KPIs = {
  revenueWon: number; pipelineValue: number; revenueForecast: number;
  activeClients: number; totalClients: number; activeProjects: number;
  meetingsThisWeek: number; tasksOverdue: number; conversionRate: number;
  wonThisMonth: { amount: number; count: number };
  wonLastMonth: { amount: number; count: number };
};
type Funnel = { scheduled: number; completed: number; proposalSent: number; contractSigned: number; clients: number };
type Win = {
  id: string; title: string; amount: number; currency: string; signedDate: string | null;
  client: { id: string; companyName: string } | null;
  prospect: { id: string; name: string; sector: string } | null;
  createdByName: string | null;
};
type Risk = {
  id: string; name: string; clientName: string; status: string;
  dueDate: string | null; progress: number; daysOverdue: number;
};
type Task = {
  id: string; title: string; dueDate: string | null;
  ownerName: string | null; parentLabel: string | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
};
type Meeting = {
  id: string; title: string; type: string; startAt: string;
  client: { id: string; companyName: string } | null;
  prospect: { id: string; name: string } | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
};
type Sector = { sector: string; revenue: number; deals: number };
type Salesperson = { userId: string | null; fullName: string | null; avatarInitials: string | null; revenue: number; deals: number };

type CrmHealth = {
  score: number;
  signals: { label: string; count: number; severity: "ok" | "warn" | "danger" }[];
};

type CommandCenter = {
  kpis: KPIs;
  funnel: Funnel;
  recentWins: Win[];
  projectsAtRisk: Risk[];
  overdueTasks: Task[];
  upcomingMeetings: Meeting[];
  topSalesperson: Salesperson | null;
  topSector: Sector | null;
  sectorBreakdown: Sector[];
  crmHealth: CrmHealth;
};

function fmt(value: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
}

function fmtPct(value: number, prev?: number) {
  if (typeof prev !== "number" || prev === 0) return null;
  const change = ((value - prev) / prev) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${Math.round(change)}%`;
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 0) {
    const ahead = -days;
    if (ahead === 1) return "tomorrow";
    if (ahead < 7) return `in ${ahead}d`;
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, GOOGLE_MEET: Video, ZOOM: Video, WHATSAPP: Phone, IN_PERSON: MapPin,
};

export default function CommandCenterPage() {
  const router = useRouter();
  const [data, setData] = useState<CommandCenter | null>(null);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/command-center")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d && !d.error) setData(d);
        else if (d?.error) setLoadError(String(d.error));
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[command-center] load failed:", e);
        setLoadError(e instanceof Error ? e.message : "Could not load data");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (!loading && loadError) {
    return (
      <div>
        <PageHeader title="Command Center" subtitle="How the agency is doing, right now." />
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <p className="text-[14px] font-semibold text-red-700">Could not load dashboard</p>
          <p className="text-[13px] text-red-600 mt-1">{loadError}</p>
          <p className="text-[12px] text-red-500 mt-3">Try refreshing the page, or log out and back in if you recently changed accounts.</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Command Center" subtitle="How the agency is doing, right now." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="os-skeleton h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { kpis, funnel, recentWins, projectsAtRisk, overdueTasks, upcomingMeetings, topSalesperson, topSector, crmHealth } = data;
  const monthChange = fmtPct(kpis.wonThisMonth.amount, kpis.wonLastMonth.amount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        subtitle="How the agency is doing, right now."
        actions={<HealthPill score={crmHealth.score} />}
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPI label="Revenue won"      value={fmt(kpis.revenueWon)}      suffix="MAD" tone="purple" hint={monthChange ? `${monthChange} vs last month` : undefined} />
        <KPI label="Pipeline value"   value={fmt(kpis.pipelineValue)}   suffix="MAD" tone="blue" />
        <KPI label="Active clients"   value={String(kpis.activeClients)}              tone="emerald" hint={`${kpis.totalClients} total`} />
        <KPI label="Conversion rate"  value={`${kpis.conversionRate}%`}                tone="amber" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <KPI label="Revenue forecast" value={fmt(kpis.revenueForecast)} suffix="MAD" tone="indigo" />
        <KPI label="Active projects"  value={String(kpis.activeProjects)} tone="cyan" />
        <KPI label="Tasks overdue"    value={String(kpis.tasksOverdue)}   tone={kpis.tasksOverdue > 0 ? "red" : "ok"} />
      </div>

      {/* Funnel + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard padding="lg" className="lg:col-span-2">
          <SectionHeader title="Meeting → Client funnel" subtitle="Conversion at every stage in the last 90 days." />
          <FunnelChart funnel={funnel} />
        </GlassCard>
        <GlassCard padding="lg">
          <SectionHeader title="CRM health" subtitle="Real-time red flags." />
          <div className="space-y-1.5">
            {crmHealth.signals.map((s) => (
              <HealthRow key={s.label} label={s.label} count={s.count} severity={s.severity} />
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Recent Wins + Projects at Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard padding="lg">
          <SectionHeader
            title="Recent wins"
            subtitle="Signed contracts."
            link={{ href: "/admin/contracts?status=SIGNED", label: "All contracts" }}
            icon={<Trophy className="w-4 h-4 text-emerald-600" />}
          />
          {recentWins.length === 0 ? (
            <EmptyPanel text="No signed contracts yet — once you sign one it lands here." />
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {recentWins.map((w) => {
                const href = w.client ? `/admin/clients/${w.client.id}` : w.prospect ? `/admin/prospecting/${w.prospect.id}` : "#";
                return (
                  <li key={w.id}>
                    <Link href={href} className="flex items-center gap-3 py-3 hover:bg-[#FAFAFE] -mx-2 px-2 rounded-lg">
                      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                        <CircleDollarSign className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#111827] truncate">{w.title}</p>
                        <p className="text-[11px] text-[#6B7280]">
                          {w.client?.companyName ?? w.prospect?.name ?? "—"}
                          {w.createdByName ? ` · ${w.createdByName}` : ""}
                          {w.signedDate ? ` · ${relativeDate(w.signedDate)}` : ""}
                        </p>
                      </div>
                      <p className="text-[13px] font-bold text-[#111827] shrink-0">
                        {fmt(w.amount)} <span className="text-[10px] font-normal text-[#9CA3AF]">{w.currency}</span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <SectionHeader
            title="Projects at risk"
            subtitle="Overdue or due within a week."
            link={{ href: "/admin/pipeline", label: "Pipeline" }}
            icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          />
          {projectsAtRisk.length === 0 ? (
            <EmptyPanel text="No projects flagged. Nice." />
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {projectsAtRisk.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#111827] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#6B7280]">
                        {p.clientName} · {p.status.replace("_", " ")} · {p.progress}%
                      </p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded border",
                      p.daysOverdue > 0
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-amber-50 text-amber-700 border-amber-100",
                    )}>
                      {p.daysOverdue > 0 ? `${p.daysOverdue}d late` : p.dueDate ? `due ${relativeDate(p.dueDate)}` : "no date"}
                    </span>
                  </div>
                  <div className="h-1.5 mt-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full",
                      p.daysOverdue > 0 ? "bg-red-500" : p.progress > 50 ? "bg-emerald-500" : "bg-amber-500"
                    )} style={{ width: `${Math.min(p.progress, 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Tasks + Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard padding="lg">
          <SectionHeader
            title="Overdue tasks"
            subtitle="What's slipping through the cracks."
            link={{ href: "/admin/tasks?scope=overdue", label: "All overdue" }}
            icon={<CheckSquare className="w-4 h-4 text-amber-600" />}
          />
          {overdueTasks.length === 0 ? (
            <EmptyPanel text="No overdue tasks. Smooth." />
          ) : (
            <ul className="space-y-1.5">
              {overdueTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 py-1.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[#111827] truncate">{t.title}</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {t.ownerName ? `${t.ownerName} · ` : ""}{t.parentLabel ? `${t.parentLabel} · ` : ""}
                      Due {relativeDate(t.dueDate)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <SectionHeader
            title="Upcoming meetings"
            subtitle="Next 7 days."
            link={{ href: "/admin/meetings?scope=upcoming", label: "All meetings" }}
            icon={<Calendar className="w-4 h-4 text-blue-600" />}
          />
          {upcomingMeetings.length === 0 ? (
            <EmptyPanel text="No meetings scheduled this week." />
          ) : (
            <ul className="space-y-1.5">
              {upcomingMeetings.map((m) => {
                const Icon = TYPE_ICON[m.type] ?? Phone;
                const linkedHref = m.client ? `/admin/clients/${m.client.id}` : m.prospect ? `/admin/prospecting/${m.prospect.id}` : null;
                const linkedLabel = m.client?.companyName ?? m.prospect?.name ?? "—";
                return (
                  <li key={m.id} className="flex items-start gap-2 py-1.5">
                    <Icon className="mt-0.5 w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#111827] truncate">{m.title}</p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {linkedHref ? (
                          <Link href={linkedHref} className="hover:text-[#8B00FF]">{linkedLabel}</Link>
                        ) : linkedLabel}
                        {m.owner ? ` · ${m.owner.fullName}` : ""}
                        {` · ${new Date(m.startAt).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard padding="lg" className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <SectionHeader title="Top salesperson" subtitle="By signed contract revenue." icon={<Crown className="w-4 h-4 text-[#8B00FF]" />} />
          {topSalesperson ? (
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[16px] font-bold">
                {topSalesperson.avatarInitials ?? (topSalesperson.fullName?.charAt(0) ?? "?")}
              </span>
              <div>
                <p className="text-[16px] font-bold text-[#111827]">{topSalesperson.fullName ?? "Unknown"}</p>
                <p className="text-[12px] text-[#6B7280]">{topSalesperson.deals} deal{topSalesperson.deals === 1 ? "" : "s"}</p>
                <p className="text-[18px] font-bold text-[#8B00FF] mt-1">{fmt(topSalesperson.revenue)} <span className="text-[11px] font-normal text-[#9CA3AF]">MAD</span></p>
              </div>
            </div>
          ) : (
            <EmptyPanel text="Once contracts get signed, the leaderboard wakes up." />
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <SectionHeader title="Top sector" subtitle="Where the revenue lives." icon={<Target className="w-4 h-4 text-emerald-600" />} />
          {topSector ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[16px] font-bold text-[#111827]">{topSector.sector}</p>
                  <p className="text-[12px] text-[#6B7280]">{topSector.deals} deal{topSector.deals === 1 ? "" : "s"}</p>
                </div>
                <p className="text-[18px] font-bold text-emerald-600">{fmt(topSector.revenue)} <span className="text-[11px] font-normal text-[#9CA3AF]">MAD</span></p>
              </div>
              {data.sectorBreakdown.length > 1 && (
                <div className="space-y-1.5">
                  {data.sectorBreakdown.slice(0, 5).map((s) => {
                    const pct = data.sectorBreakdown[0].revenue > 0 ? (s.revenue / data.sectorBreakdown[0].revenue) * 100 : 0;
                    return (
                      <div key={s.sector} className="flex items-center gap-2">
                        <span className="text-[11px] text-[#6B7280] w-32 truncate">{s.sector}</span>
                        <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full bg-emerald-500/60 rounded-full"
                          />
                        </div>
                        <span className="text-[11px] font-medium text-[#374151] w-16 text-right">{fmt(s.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <EmptyPanel text="Sectors will surface once contracts are linked to prospect sectors." />
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function KPI({ label, value, suffix, tone, hint }: { label: string; value: string; suffix?: string; tone: "purple" | "blue" | "emerald" | "amber" | "indigo" | "cyan" | "red" | "ok"; hint?: string }) {
  const tones: Record<typeof tone, { ring: string; text: string; bg: string }> = {
    purple:  { ring: "border-purple-200",  text: "text-[#8B00FF]",  bg: "bg-gradient-to-br from-purple-50 to-violet-50" },
    blue:    { ring: "border-blue-200",    text: "text-blue-600",   bg: "bg-gradient-to-br from-blue-50 to-sky-50" },
    emerald: { ring: "border-emerald-200", text: "text-emerald-600",bg: "bg-gradient-to-br from-emerald-50 to-green-50" },
    amber:   { ring: "border-amber-200",   text: "text-amber-600",  bg: "bg-gradient-to-br from-amber-50 to-yellow-50" },
    indigo:  { ring: "border-indigo-200",  text: "text-indigo-600", bg: "bg-gradient-to-br from-indigo-50 to-blue-50" },
    cyan:    { ring: "border-cyan-200",    text: "text-cyan-600",   bg: "bg-gradient-to-br from-cyan-50 to-sky-50" },
    red:     { ring: "border-red-200",     text: "text-red-600",    bg: "bg-gradient-to-br from-red-50 to-rose-50" },
    ok:      { ring: "border-[#E5E7EB]",   text: "text-[#111827]",  bg: "bg-white" },
  };
  const s = tones[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("rounded-2xl border p-4 sm:p-5 shadow-sm", s.ring, s.bg)}
    >
      <p className={cn("text-2xl sm:text-3xl font-bold tracking-tight", s.text)}>
        {value}{suffix ? <span className="text-[12px] sm:text-[13px] font-medium text-[#9CA3AF] ml-1.5">{suffix}</span> : null}
      </p>
      <p className="text-[12px] sm:text-[13px] text-[#475569] mt-1 font-medium">{label}</p>
      {hint && <p className="text-[11px] text-[#6B7280] mt-1">{hint}</p>}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, link, icon }: { title: string; subtitle?: string; link?: { href: string; label: string }; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[14px] font-semibold text-[#111827]">{title}</h3>
        </div>
        {subtitle && <p className="text-[12px] text-[#6B7280] mt-0.5">{subtitle}</p>}
      </div>
      {link && (
        <Link href={link.href} className="text-[11px] font-medium text-[#8B00FF] hover:text-[#7A00E0] flex items-center gap-0.5 shrink-0">
          {link.label} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="text-[12px] text-[#9CA3AF] text-center py-6">{text}</p>;
}

function HealthPill({ score }: { score: number }) {
  const tone =
    score >= 85 ? { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", dot: "bg-emerald-500", label: "Healthy" } :
    score >= 65 ? { text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-100",   dot: "bg-amber-500",   label: "Needs attention" } :
                  { text: "text-red-700",     bg: "bg-red-50",     border: "border-red-100",     dot: "bg-red-500",     label: "Action required" };
  return (
    <Link href="/admin/system-status" className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-xl border", tone.bg, tone.border)}>
      <span className={cn("w-2 h-2 rounded-full", tone.dot)} />
      <span className={cn("text-[12px] font-semibold", tone.text)}>{tone.label}</span>
      <span className={cn("text-[14px] font-bold", tone.text)}>{score}</span>
      <ShieldCheck className={cn("w-3.5 h-3.5", tone.text)} />
    </Link>
  );
}

function HealthRow({ label, count, severity }: { label: string; count: number; severity: "ok" | "warn" | "danger" }) {
  const styles = {
    ok:     { dot: "bg-emerald-500", text: "text-[#111827]" },
    warn:   { dot: "bg-amber-500",   text: "text-amber-700" },
    danger: { dot: "bg-red-500",     text: "text-red-700" },
  }[severity];
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5">
        <span className={cn("w-2 h-2 rounded-full", styles.dot)} />
        <span className="text-[13px] text-[#475569]">{label}</span>
      </div>
      <span className={cn("text-[14px] font-semibold", styles.text)}>{count}</span>
    </div>
  );
}

function FunnelChart({ funnel }: { funnel: Funnel }) {
  const stages = [
    { label: "Scheduled",        value: funnel.scheduled,      color: "bg-blue-500" },
    { label: "Completed",        value: funnel.completed,      color: "bg-cyan-500" },
    { label: "Proposal sent",    value: funnel.proposalSent,   color: "bg-amber-500" },
    { label: "Contract signed",  value: funnel.contractSigned, color: "bg-emerald-500" },
    { label: "Client",           value: funnel.clients,        color: "bg-purple-500" },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] text-[#475569] font-medium">{s.label}</span>
              <div className="flex items-center gap-2">
                {conv !== null && <span className="text-[10px] text-[#9CA3AF]">{conv}% of prev</span>}
                <span className="text-[14px] font-semibold text-[#111827]">{s.value}</span>
              </div>
            </div>
            <div className="h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 2)}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                className={cn("h-full rounded-full", s.color)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
