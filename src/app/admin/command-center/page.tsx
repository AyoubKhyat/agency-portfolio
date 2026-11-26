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
import { monthChange, REPORT_CURRENCY, type BusinessMoney } from "@/lib/business-report";

type KPIs = {
  activeClients: number; totalClients: number; activeProjects: number;
  meetingsThisWeek: number; tasksOverdue: number; conversionRate: number;
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

type Money = Pick<BusinessMoney, "signed" | "pipeline" | "paidInvoices" | "excluded" | "proposalsWithSeveralContracts">;

type CommandCenter = {
  kpis: KPIs;
  money: Money;
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
        console.warn("[command-center] load failed:", e);
        setLoadError(e instanceof Error ? e.message : "Could not load data");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (!loading && loadError) {
    return (
      <div>
        <PageHeader title="Business report" subtitle="How the agency is doing, right now." />
        <div className="bg-red-50 os-dark:bg-red-500/10 border border-red-200 os-dark:border-red-500/30 rounded-2xl p-6">
          <p className="text-[14px] font-semibold text-red-700 os-dark:text-red-300">Could not load dashboard</p>
          <p className="text-[13px] text-red-600 os-dark:text-red-400 mt-1">{loadError}</p>
          <p className="text-[12px] text-red-500 os-dark:text-red-400 mt-3">Try refreshing the page, or log out and back in if you recently changed accounts.</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Business report" subtitle="How the agency is doing, right now." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="os-skeleton h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { kpis, money, funnel, recentWins, projectsAtRisk, overdueTasks, upcomingMeetings, topSalesperson, topSector, crmHealth } = data;
  const signedChange = monthChange(money.signed.thisMonth.value, money.signed.lastMonth.value);
  const paidChange = monthChange(money.paidInvoices.thisMonth.value, money.paidInvoices.lastMonth.value);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business report"
        subtitle="How the agency is doing, right now."
        actions={<HealthPill score={crmHealth.score} />}
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPI label="Signed contracts" value={fmt(money.signed.value)} suffix={REPORT_CURRENCY} tone="purple"
          hint={`${money.signed.count} signed, active or completed${signedChange ? ` · ${signedChange} vs last month` : ""}`} />
        <KPI label="Pipeline: sent proposals" value={fmt(money.pipeline.sent.value)} suffix={REPORT_CURRENCY} tone="blue"
          hint={`${money.pipeline.sent.count} awaiting an answer · drafts not included`} />
        <KPI label="Active clients"   value={String(kpis.activeClients)}              tone="emerald" hint={`${kpis.totalClients} total`} />
        <KPI label="Prospects won (%)" value={`${kpis.conversionRate}%`}                tone="amber" hint="Won stage ÷ all prospects, all time" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <KPI label="Paid invoices" value={fmt(money.paidInvoices.value)} suffix={`${REPORT_CURRENCY}, VAT incl.`} tone="indigo"
          hint={`${money.paidInvoices.count} marked paid${paidChange ? ` · ${paidChange} vs last month` : ""}`} />
        <KPI label="Active projects"  value={String(kpis.activeProjects)} tone="cyan" />
        <KPI label="Tasks overdue"    value={String(kpis.tasksOverdue)}   tone={kpis.tasksOverdue > 0 ? "red" : "ok"} />
      </div>

      <MoneyDetail money={money} />

      {/* Funnel + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard padding="lg" className="lg:col-span-2">
          <SectionHeader title="Meeting → Client funnel" subtitle="All time." />
          <FunnelChart funnel={funnel} />
        </GlassCard>
        <GlassCard padding="lg">
          <SectionHeader title="CRM health" subtitle="Real-time red flags." />
          <div className="space-y-1.5">
            {crmHealth.signals.map((s) => (
              <HealthRow key={s.label} label={s.label} count={s.count} severity={s.severity} />
            ))}
          </div>
          <p className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mt-3 leading-relaxed">
            Follow-up dates include historical records, many from before the July 2026 cleanup.{" "}
            <Link href="/admin" className="text-purple-600 os-dark:text-purple-400 hover:text-purple-700 os-dark:hover:text-purple-300">Today</Link> shows which are backed by a recorded send.
          </p>
        </GlassCard>
      </div>

      {/* Recent Wins + Projects at Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard padding="lg">
          <SectionHeader
            title="Recent wins"
            subtitle="Signed contracts."
            link={{ href: "/admin/contracts?status=SIGNED", label: "All contracts" }}
            icon={<Trophy className="w-4 h-4 text-emerald-600 os-dark:text-emerald-400" />}
          />
          {recentWins.length === 0 ? (
            <EmptyPanel text="No signed contracts yet — once you sign one it lands here." />
          ) : (
            <ul className="divide-y divide-[#F3F4F6] os-dark:divide-[var(--os-border)]">
              {recentWins.map((w) => {
                const href = w.client ? `/admin/clients/${w.client.id}` : w.prospect ? `/admin/prospecting/${w.prospect.id}` : "#";
                return (
                  <li key={w.id}>
                    <Link href={href} className="flex items-center gap-3 py-3 hover:bg-[#FAFAFE] os-dark:hover:bg-[var(--os-hover)] -mx-2 px-2 rounded-lg">
                      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-600 os-dark:text-emerald-400 shrink-0">
                        <CircleDollarSign className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#111827] os-dark:text-[var(--os-text)] truncate">{w.title}</p>
                        <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)]">
                          {w.client?.companyName ?? w.prospect?.name ?? "—"}
                          {w.createdByName ? ` · ${w.createdByName}` : ""}
                          {w.signedDate ? ` · ${relativeDate(w.signedDate)}` : ""}
                        </p>
                      </div>
                      <p className="text-[13px] font-bold text-[#111827] os-dark:text-[var(--os-text)] shrink-0">
                        {fmt(w.amount)} <span className="text-[11px] font-normal text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">{w.currency}</span>
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
            icon={<AlertTriangle className="w-4 h-4 text-amber-600 os-dark:text-amber-400" />}
          />
          {projectsAtRisk.length === 0 ? (
            <EmptyPanel text="No projects flagged. Nice." />
          ) : (
            <ul className="divide-y divide-[#F3F4F6] os-dark:divide-[var(--os-border)]">
              {projectsAtRisk.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#111827] os-dark:text-[var(--os-text)] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)]">
                        {p.clientName} · {p.status.replace("_", " ")} · {p.progress}%
                      </p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded border",
                      p.daysOverdue > 0
                        ? "bg-red-50 os-dark:bg-red-500/10 text-red-700 os-dark:text-red-300 border-red-100 os-dark:border-red-500/30"
                        : "bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 border-amber-100 os-dark:border-amber-500/30",
                    )}>
                      {p.daysOverdue > 0 ? `${p.daysOverdue}d late` : p.dueDate ? `due ${relativeDate(p.dueDate)}` : "no date"}
                    </span>
                  </div>
                  <div className="h-1.5 mt-2 bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] rounded-full overflow-hidden">
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
            icon={<CheckSquare className="w-4 h-4 text-amber-600 os-dark:text-amber-400" />}
          />
          {overdueTasks.length === 0 ? (
            <EmptyPanel text="No overdue tasks. Smooth." />
          ) : (
            <ul className="space-y-1.5">
              {overdueTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 py-1.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[#111827] os-dark:text-[var(--os-text)] truncate">{t.title}</p>
                    <p className="text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">
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
            icon={<Calendar className="w-4 h-4 text-blue-600 os-dark:text-blue-400" />}
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
                    <Icon className="mt-0.5 w-3.5 h-3.5 text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#111827] os-dark:text-[var(--os-text)] truncate">{m.title}</p>
                      <p className="text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">
                        {linkedHref ? (
                          <Link href={linkedHref} className="hover:text-[#8B00FF] os-dark:hover:text-[var(--os-purple)]">{linkedLabel}</Link>
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
        <GlassCard padding="lg" className="border-purple-200 os-dark:border-purple-500/30 bg-gradient-to-br from-purple-50 to-violet-50 os-dark:from-purple-500/10 os-dark:to-violet-500/5">
          <SectionHeader title="Top salesperson" subtitle="By signed contract value (MAD)." icon={<Crown className="w-4 h-4 text-[#8B00FF] os-dark:text-[var(--os-purple)]" />} />
          {topSalesperson ? (
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[16px] font-bold">
                {topSalesperson.avatarInitials ?? (topSalesperson.fullName?.charAt(0) ?? "?")}
              </span>
              <div>
                <p className="text-[16px] font-bold text-[#111827] os-dark:text-[var(--os-text)]">{topSalesperson.fullName ?? "Unknown"}</p>
                <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)]">{topSalesperson.deals} deal{topSalesperson.deals === 1 ? "" : "s"}</p>
                <p className="text-[18px] font-bold text-[#8B00FF] os-dark:text-[var(--os-purple)] mt-1">{fmt(topSalesperson.revenue)} <span className="text-[11px] font-normal text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">MAD</span></p>
              </div>
            </div>
          ) : (
            <EmptyPanel text="Once contracts get signed, the leaderboard wakes up." />
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <SectionHeader title="Top sector" subtitle="Signed contract value (MAD) by prospect sector." icon={<Target className="w-4 h-4 text-emerald-600 os-dark:text-emerald-400" />} />
          {topSector ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[16px] font-bold text-[#111827] os-dark:text-[var(--os-text)]">{topSector.sector}</p>
                  <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)]">{topSector.deals} deal{topSector.deals === 1 ? "" : "s"}</p>
                </div>
                <p className="text-[18px] font-bold text-emerald-600 os-dark:text-emerald-400">{fmt(topSector.revenue)} <span className="text-[11px] font-normal text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">MAD</span></p>
              </div>
              {data.sectorBreakdown.length > 1 && (
                <div className="space-y-1.5">
                  {data.sectorBreakdown.slice(0, 5).map((s) => {
                    const pct = data.sectorBreakdown[0].revenue > 0 ? (s.revenue / data.sectorBreakdown[0].revenue) * 100 : 0;
                    return (
                      <div key={s.sector} className="flex items-center gap-2">
                        <span className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)] w-32 truncate">{s.sector}</span>
                        <div className="flex-1 h-1.5 bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full bg-emerald-500/60 rounded-full"
                          />
                        </div>
                        <span className="text-[11px] font-medium text-[#374151] os-dark:text-[var(--os-text)] w-16 text-right">{fmt(s.revenue)}</span>
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

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function MoneyDetail({ money }: { money: Money }) {
  const { pipeline, signed, paidInvoices, excluded } = money;
  const rows: { label: string; value: number; count: number; note: string }[] = [
    { label: "Accepted, not yet signed", value: pipeline.acceptedUnsigned.value, count: pipeline.acceptedUnsigned.count, note: "No signed or pending contract yet" },
    { label: "Contracts awaiting signature", value: pipeline.awaitingSignature.value, count: pipeline.awaitingSignature.count, note: "Pending signature" },
    { label: "Draft proposals", value: pipeline.drafts.value, count: pipeline.drafts.count, note: "Not sent; not in the pipeline" },
    { label: "Signed this month", value: signed.thisMonth.value, count: signed.thisMonth.count, note: `Last month: ${fmt(signed.lastMonth.value)}` },
    { label: "Paid this month (VAT incl.)", value: paidInvoices.thisMonth.value, count: paidInvoices.thisMonth.count, note: `Last month: ${fmt(paidInvoices.lastMonth.value)}` },
  ];
  const notes: string[] = [];
  const excludedParts = [
    excluded.contracts ? plural(excluded.contracts, "contract", "contracts") : "",
    excluded.proposals ? plural(excluded.proposals, "proposal", "proposals") : "",
    excluded.invoices ? plural(excluded.invoices, "paid invoice", "paid invoices") : "",
  ].filter(Boolean);
  if (excludedParts.length > 0) {
    notes.push(`${excludedParts.join(", ")} in another currency (or without a valid amount) left out of the ${REPORT_CURRENCY} figures. Nothing is converted.`);
  }
  if (signed.signedWithoutDate > 0) notes.push(`${plural(signed.signedWithoutDate, "signed contract has", "signed contracts have")} no signing date: in the total, not in a month.`);
  if (paidInvoices.paidWithoutDate > 0) notes.push(`${plural(paidInvoices.paidWithoutDate, "paid invoice has", "paid invoices have")} no payment date: in the total, not in a month.`);
  if (money.proposalsWithSeveralContracts > 0) {
    notes.push(`${plural(money.proposalsWithSeveralContracts, "proposal has", "proposals have")} more than one signed or pending contract. Each is counted; check them for duplicates.`);
  }

  return (
    <GlassCard padding="lg">
      <SectionHeader title="Money, in detail" subtitle={`All amounts in ${REPORT_CURRENCY}. Each deal is counted in one place only.`} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-[#F9FAFB] os-dark:bg-[var(--os-surface-2)] p-3">
            <p className="text-[16px] font-bold text-[#111827] os-dark:text-[var(--os-text)]">{fmt(r.value)} <span className="text-[11px] font-normal text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">{REPORT_CURRENCY}</span></p>
            <p className="text-[12px] font-medium text-[#374151] os-dark:text-[var(--os-text)]">{r.label}</p>
            <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)]">{r.count} · {r.note}</p>
          </div>
        ))}
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px] text-amber-700 os-dark:text-amber-300">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)]">
        Signed contracts are signed, active or completed, dated by their signing date. The pipeline is sent proposals only.
        Paid invoices include VAT and are marked paid by hand; contract and proposal values are before tax, so the two are never added together.
        There is no forecast figure, because it mixed these amounts.
      </p>
    </GlassCard>
  );
}

function KPI({ label, value, suffix, tone, hint }: { label: string; value: string; suffix?: string; tone: "purple" | "blue" | "emerald" | "amber" | "indigo" | "cyan" | "red" | "ok"; hint?: string }) {
  const tones: Record<typeof tone, { ring: string; text: string; bg: string }> = {
    purple:  { ring: "border-purple-200 os-dark:border-purple-500/30",  text: "text-[#8B00FF] os-dark:text-[var(--os-purple)]",  bg: "bg-gradient-to-br from-purple-50 to-violet-50 os-dark:from-purple-500/10 os-dark:to-violet-500/5" },
    blue:    { ring: "border-blue-200 os-dark:border-blue-500/30",    text: "text-blue-600 os-dark:text-blue-400",   bg: "bg-gradient-to-br from-blue-50 to-sky-50 os-dark:from-blue-500/10 os-dark:to-sky-500/5" },
    emerald: { ring: "border-emerald-200 os-dark:border-emerald-500/30", text: "text-emerald-600 os-dark:text-emerald-400",bg: "bg-gradient-to-br from-emerald-50 to-green-50 os-dark:from-emerald-500/10 os-dark:to-green-500/5" },
    amber:   { ring: "border-amber-200 os-dark:border-amber-500/30",   text: "text-amber-600 os-dark:text-amber-400",  bg: "bg-gradient-to-br from-amber-50 to-yellow-50 os-dark:from-amber-500/10 os-dark:to-yellow-500/5" },
    indigo:  { ring: "border-indigo-200 os-dark:border-indigo-500/30",  text: "text-indigo-600 os-dark:text-indigo-400", bg: "bg-gradient-to-br from-indigo-50 to-blue-50 os-dark:from-indigo-500/10 os-dark:to-blue-500/5" },
    cyan:    { ring: "border-cyan-200 os-dark:border-cyan-500/30",    text: "text-cyan-600 os-dark:text-cyan-400",   bg: "bg-gradient-to-br from-cyan-50 to-sky-50 os-dark:from-cyan-500/10 os-dark:to-sky-500/5" },
    red:     { ring: "border-red-200 os-dark:border-red-500/30",     text: "text-red-600 os-dark:text-red-400",    bg: "bg-gradient-to-br from-red-50 to-rose-50 os-dark:from-red-500/10 os-dark:to-rose-500/5" },
    ok:      { ring: "border-[var(--os-border)]",   text: "text-[#111827] os-dark:text-[var(--os-text)]",  bg: "bg-[var(--os-surface)]" },
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
        {value}{suffix ? <span className="text-[12px] sm:text-[13px] font-medium text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] ml-1.5">{suffix}</span> : null}
      </p>
      <p className="text-[12px] sm:text-[13px] text-[#475569] os-dark:text-[var(--os-text)] mt-1 font-medium">{label}</p>
      {hint && <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)] mt-1">{hint}</p>}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, link, icon }: { title: string; subtitle?: string; link?: { href: string; label: string }; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[14px] font-semibold text-[#111827] os-dark:text-[var(--os-text)]">{title}</h3>
        </div>
        {subtitle && <p className="text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)] mt-0.5">{subtitle}</p>}
      </div>
      {link && (
        <Link href={link.href} className="text-[11px] font-medium text-[#8B00FF] os-dark:text-[var(--os-purple)] hover:text-[#7A00E0] os-dark:hover:text-purple-300 flex items-center gap-0.5 shrink-0">
          {link.label} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="text-[12px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] text-center py-6">{text}</p>;
}

function HealthPill({ score }: { score: number }) {
  const tone =
    score >= 85 ? { text: "text-emerald-700 os-dark:text-emerald-300", bg: "bg-emerald-50 os-dark:bg-emerald-500/10", border: "border-emerald-100 os-dark:border-emerald-500/30", dot: "bg-emerald-500", label: "Healthy" } :
    score >= 65 ? { text: "text-amber-700 os-dark:text-amber-300",   bg: "bg-amber-50 os-dark:bg-amber-500/10",   border: "border-amber-100 os-dark:border-amber-500/30",   dot: "bg-amber-500",   label: "Needs attention" } :
                  { text: "text-red-700 os-dark:text-red-300",     bg: "bg-red-50 os-dark:bg-red-500/10",     border: "border-red-100 os-dark:border-red-500/30",     dot: "bg-red-500",     label: "Action required" };
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
    ok:     { dot: "bg-emerald-500", text: "text-[#111827] os-dark:text-[var(--os-text)]" },
    warn:   { dot: "bg-amber-500",   text: "text-amber-700 os-dark:text-amber-300" },
    danger: { dot: "bg-red-500",     text: "text-red-700 os-dark:text-red-300" },
  }[severity];
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5">
        <span className={cn("w-2 h-2 rounded-full", styles.dot)} />
        <span className="text-[13px] text-[#475569] os-dark:text-[var(--os-text)]">{label}</span>
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
              <span className="text-[12px] text-[#475569] os-dark:text-[var(--os-text)] font-medium">{s.label}</span>
              <div className="flex items-center gap-2">
                {conv !== null && <span className="text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">{conv}% of prev</span>}
                <span className="text-[14px] font-semibold text-[#111827] os-dark:text-[var(--os-text)]">{s.value}</span>
              </div>
            </div>
            <div className="h-2.5 bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] rounded-full overflow-hidden">
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
