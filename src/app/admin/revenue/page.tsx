"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign, TrendingUp, AlertTriangle, Crown, Users, RefreshCw,
  Trophy, Clock, Loader2, ChevronRight, Flame,
  ShieldAlert, FileSignature, CalendarCheck, Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */
type PipelineMetrics = { potential: number; proposalValue: number; contractValue: number; wonRevenue: number; lostRevenue: number };
type Forecast = { best: number; expected: number; worst: number; count: number };
type Opportunity = {
  id: string; name: string; sector: string; city: string;
  score: number | null; qualityLabel: string | null;
  stage: string; proposalValue: number; probability: number; expectedRevenue: number;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
  expectedClose: string; lastActionAt: string | null;
};
type StalledItem = { id: string; prospectId: string | null; name: string; amount: number; daysStalled: number; lastEvent: string };
type TeamRow = {
  userId: string; name: string; avatarInitials: string;
  messages: number; replies: number; replyRate: number;
  meetings: number; proposals: number; contracts: number; revenueWon: number;
};

type RevenueData = {
  pipeline: { today: PipelineMetrics; week: PipelineMetrics; month: PipelineMetrics; quarter: PipelineMetrics };
  opportunities: Opportunity[];
  ceoTop10: Opportunity[];
  forecast: { in7: Forecast; in30: Forecast; in90: Forecast };
  stalled: { meetingDoneNoProposal: StalledItem[]; proposalSentNoReply: StalledItem[]; contractSentUnsigned: StalledItem[] };
  team: TeamRow[];
  alerts: { proposalsStale: number; contractsStale: number; meetingsWithoutFollowup: number; highValueInactive: number; overallHealth: "green" | "orange" | "red" };
  meta: { totalProspects: number; activeOpportunities: number; currency: string };
};

const STAGE_LABEL: Record<string, string> = {
  A_ENVOYER: "Not contacted",
  ENVOYE: "Contacted",
  REPONDU: "Replied",
  MEETING: "Meeting",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATION: "Negotiating",
  CONTRACT_SENT: "Contract pending",
  CLIENT: "Client",
  CONVERTI: "Client",
};

function fmtMAD(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/* ============================================================ */
export default function RevenueCommandCenter() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineWin, setPipelineWin] = useState<"today" | "week" | "month" | "quarter">("month");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/revenue");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Revenue Command Center" subtitle="Where the next revenue is hiding." />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const currentPipeline = data.pipeline[pipelineWin];

  return (
    <div>
      <PageHeader
        title="Revenue Command Center"
        subtitle={`${data.meta.activeOpportunities} active opportunities · ${data.meta.totalProspects} prospects in DB`}
        actions={
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Alerts strip */}
      <AlertsStrip alerts={data.alerts} />

      {/* CEO Widget */}
      <CeoWidget top10={data.ceoTop10} />

      {/* Pipeline */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#0F172A] flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#8B00FF]" /> Revenue pipeline
          </h2>
          <FilterTabs
            items={[
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
              { value: "quarter", label: "This quarter" },
            ]}
            active={pipelineWin}
            onChange={(v) => setPipelineWin(v as typeof pipelineWin)}
            size="sm"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <PipelineCard label="Potential" value={currentPipeline.potential} tone="purple" />
          <PipelineCard label="Proposals" value={currentPipeline.proposalValue} tone="indigo" />
          <PipelineCard label="Contracts" value={currentPipeline.contractValue} tone="cyan" />
          <PipelineCard label="Won" value={currentPipeline.wonRevenue} tone="emerald" highlight />
          <PipelineCard label="Lost" value={currentPipeline.lostRevenue} tone="rose" />
        </div>
      </div>

      {/* Forecast */}
      <div className="mt-6">
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#8B00FF]" /> Forecast
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ForecastCard label="Next 7 days" forecast={data.forecast.in7} />
          <ForecastCard label="Next 30 days" forecast={data.forecast.in30} />
          <ForecastCard label="Next 90 days" forecast={data.forecast.in90} />
        </div>
      </div>

      {/* Opportunity ranking */}
      <OpportunityTable opportunities={data.opportunities} />

      {/* Stalled deals */}
      <StalledSection stalled={data.stalled} />

      {/* Team performance */}
      <TeamSection team={data.team} />
    </div>
  );
}

/* ============================================================ */
function AlertsStrip({ alerts }: { alerts: RevenueData["alerts"] }) {
  const items = [
    { value: alerts.proposalsStale, label: "Proposals > 7 days old", icon: <FileSignature className="w-3.5 h-3.5" /> },
    { value: alerts.contractsStale, label: "Contracts > 14 days old", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { value: alerts.meetingsWithoutFollowup, label: "Meetings without next step", icon: <CalendarCheck className="w-3.5 h-3.5" /> },
    { value: alerts.highValueInactive, label: "High-value deals inactive", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];
  const tone = alerts.overallHealth;
  return (
    <div className={cn(
      "rounded-2xl border-2 p-4 mb-5",
      tone === "green" ? "border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-teal-50/40" :
      tone === "orange" ? "border-amber-200 bg-gradient-to-br from-amber-50/40 to-orange-50/40" :
      "border-rose-300 bg-gradient-to-br from-rose-50/60 to-red-50/40"
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0",
          tone === "green" ? "bg-emerald-500 shadow-emerald-500/30" :
          tone === "orange" ? "bg-amber-500 shadow-amber-500/30" :
          "bg-rose-600 shadow-rose-600/30"
        )}>
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#0F172A]">
            {tone === "green" ? "All clear" : tone === "orange" ? "Needs attention" : "Urgent: revenue at risk"}
          </div>
          <div className="text-[12px] text-[#475569]">
            {tone === "green" ? "No revenue alerts. Keep the cadence." : `${items.reduce((s, i) => s + i.value, 0)} item${items.reduce((s, i) => s + i.value, 0) !== 1 ? "s" : ""} need follow-up.`}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.label} className={cn(
            "rounded-xl bg-white border p-2.5",
            it.value > 0 ? (tone === "red" ? "border-rose-200" : "border-amber-200") : "border-[var(--os-border)]"
          )}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">
              <span className={cn(it.value > 0 ? (tone === "red" ? "text-rose-600" : "text-amber-600") : "text-[#94A3B8]")}>{it.icon}</span>
              {it.label}
            </div>
            <div className={cn("text-xl font-bold tabular-nums", it.value > 0 ? (tone === "red" ? "text-rose-700" : "text-amber-700") : "text-[#94A3B8]")}>
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
function CeoWidget({ top10 }: { top10: Opportunity[] }) {
  if (top10.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/40 to-violet-50/40 p-5 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-4 h-4 text-[#8B00FF]" />
          <h2 className="text-[14px] font-semibold text-[#0F172A]">CEO widget — if you only have 1 hour today</h2>
        </div>
        <div className="text-[12px] text-[#64748B]">No active opportunities yet. Log a proposal amount on a prospect to populate this list.</div>
      </div>
    );
  }
  const totalExpected = top10.reduce((s, o) => s + o.expectedRevenue, 0);
  return (
    <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50/60 to-violet-50/40 p-5 mb-5 shadow-md shadow-purple-500/10">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-[#8B00FF]" />
            <h2 className="text-[14px] font-semibold text-[#0F172A]">If you only have 1 hour today — contact these first</h2>
          </div>
          <div className="text-[12px] text-[#475569]">10 prospects · <span className="font-semibold text-[#8B00FF]">{fmtMAD(totalExpected)}</span> expected revenue at current probability</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {top10.map((o, i) => (
              <tr key={o.id} className="border-b border-purple-100 last:border-0">
                <td className="px-2 py-2 w-8">
                  <span className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-bold",
                    i === 0 ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white" : "bg-purple-100 text-[#7C3AED]"
                  )}>{i + 1}</span>
                </td>
                <td className="px-2 py-2">
                  <Link href={`/admin/prospecting/${o.id}`} className="text-[13px] font-semibold text-[#0F172A] hover:text-[#7C3AED]">{o.name}</Link>
                  <div className="text-[11px] text-[#64748B]">{o.sector} · {o.city} · {STAGE_LABEL[o.stage] || o.stage}</div>
                </td>
                <td className="px-2 py-2 text-right hidden sm:table-cell">
                  <div className="text-[12px] text-[#94A3B8] tabular-nums">{fmtMAD(o.proposalValue)} × {Math.round(o.probability * 100)}%</div>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="text-[13px] font-bold text-[#7C3AED] tabular-nums">{fmtMAD(o.expectedRevenue)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================ */
function PipelineCard({ label, value, tone, highlight }: { label: string; value: number; tone: string; highlight?: boolean }) {
  const tones: Record<string, string> = {
    purple: "text-purple-700 border-purple-200",
    indigo: "text-indigo-700 border-indigo-200",
    cyan: "text-cyan-700 border-cyan-200",
    emerald: "text-emerald-700 border-emerald-200",
    rose: "text-rose-700 border-rose-200",
  };
  return (
    <div className={cn(
      "rounded-2xl border bg-white p-4",
      tones[tone] || tones.purple,
      highlight && "shadow-md shadow-emerald-500/10"
    )}>
      <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", tones[tone]?.split(" ")[0] || "text-[#0F172A]")}>{fmtMAD(value)}</div>
    </div>
  );
}

/* ============================================================ */
function ForecastCard({ label, forecast }: { label: string; forecast: Forecast }) {
  return (
    <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium">{label}</div>
        <span className="text-[10px] text-[#94A3B8]">{forecast.count} opps in window</span>
      </div>
      <div className="space-y-1.5">
        <ForecastRow label="Best" value={forecast.best} tone="emerald" />
        <ForecastRow label="Expected" value={forecast.expected} tone="purple" emphasize />
        <ForecastRow label="Worst" value={forecast.worst} tone="rose" />
      </div>
    </div>
  );
}
function ForecastRow({ label, value, tone, emphasize }: { label: string; value: number; tone: string; emphasize?: boolean }) {
  const tones: Record<string, string> = { emerald: "text-emerald-700", purple: "text-[#7C3AED]", rose: "text-rose-700" };
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={cn(emphasize ? "text-[16px] font-bold" : "text-[13px] font-medium", tones[tone] || "text-[#0F172A]", "tabular-nums")}>{fmtMAD(value)}</span>
    </div>
  );
}

/* ============================================================ */
function OpportunityTable({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-[#8B00FF]" /> Top {opportunities.length} opportunities
      </h2>
      <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
              <tr>
                <th className="text-left px-3 py-2">Prospect</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Sector</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">City</th>
                <th className="text-right px-3 py-2">Score</th>
                <th className="text-left px-3 py-2">Stage</th>
                <th className="text-right px-3 py-2">Proposal</th>
                <th className="text-right px-3 py-2">Prob</th>
                <th className="text-right px-3 py-2">Expected</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o, i) => (
                <tr key={o.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#94A3B8] tabular-nums w-6">{i + 1}.</span>
                      <Link href={`/admin/prospecting/${o.id}`} className="text-[13px] font-medium text-[#0F172A] hover:text-[#7C3AED]">{o.name}</Link>
                      {o.qualityLabel === "HOT" && <Flame className="w-3 h-3 text-rose-600" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-[#475569] hidden md:table-cell">{o.sector}</td>
                  <td className="px-3 py-2 text-[12px] text-[#475569] hidden lg:table-cell">{o.city}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{o.score ?? 0}</td>
                  <td className="px-3 py-2 text-[12px] text-[#475569]">{STAGE_LABEL[o.stage] || o.stage}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{fmtMAD(o.proposalValue)}</td>
                  <td className="px-3 py-2 text-right text-[12px] tabular-nums">
                    <span className={cn(o.probability >= 0.6 ? "text-emerald-700 font-medium" : o.probability >= 0.3 ? "text-amber-700" : "text-[#94A3B8]")}>
                      {Math.round(o.probability * 100)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[13px] font-bold text-[#7C3AED] tabular-nums">{fmtMAD(o.expectedRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
function StalledSection({ stalled }: { stalled: RevenueData["stalled"] }) {
  const total = stalled.meetingDoneNoProposal.length + stalled.proposalSentNoReply.length + stalled.contractSentUnsigned.length;
  if (total === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
        <h2 className="text-[14px] font-semibold text-[#0F172A] flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" /> Stalled deals — none
        </h2>
        <div className="text-[12px] text-[#475569] mt-1">Every meeting has a next step, every proposal has been followed up.</div>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600" /> Stalled deals ({total}) · sorted by money at risk
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StalledList title="Meeting done, no proposal" items={stalled.meetingDoneNoProposal} tone="amber" />
        <StalledList title="Proposal sent, no reply" items={stalled.proposalSentNoReply} tone="orange" />
        <StalledList title="Contract sent, unsigned" items={stalled.contractSentUnsigned} tone="rose" />
      </div>
    </div>
  );
}

function StalledList({ title, items, tone }: { title: string; items: StalledItem[]; tone: string }) {
  const tones: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50/40",
    orange: "border-orange-200 bg-orange-50/40",
    rose: "border-rose-200 bg-rose-50/40",
  };
  return (
    <div className={cn("rounded-2xl border bg-white overflow-hidden", tones[tone])}>
      <div className="px-4 py-3 bg-white border-b border-[var(--os-border)]">
        <div className="text-[12.5px] font-semibold text-[#0F172A]">{title}</div>
        <div className="text-[11px] text-[#64748B]">{items.length} stalled</div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-[#94A3B8] bg-white">None</div>
      ) : (
        <div className="bg-white">
          {items.slice(0, 10).map((s) => (
            <Link
              key={s.id}
              href={s.prospectId ? `/admin/prospecting/${s.prospectId}` : "#"}
              className="block px-4 py-2 border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[#0F172A] truncate">{s.name}</span>
                <span className="text-[13px] font-bold text-[#0F172A] tabular-nums shrink-0">{fmtMAD(s.amount)}</span>
              </div>
              <div className="text-[10px] text-[#64748B]">{s.lastEvent} · {s.daysStalled}d stalled</div>
            </Link>
          ))}
          {items.length > 10 && <div className="px-4 py-2 text-[10px] text-[#94A3B8] text-center">+ {items.length - 10} more</div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
function TeamSection({ team }: { team: TeamRow[] }) {
  if (team.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-[#8B00FF]" /> Team performance · this month
      </h2>
      <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--os-border)] bg-gray-50/60 text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                <th className="text-left px-3 py-2">Team member</th>
                <th className="text-right px-3 py-2">Msg</th>
                <th className="text-right px-3 py-2">Replies</th>
                <th className="text-right px-3 py-2 hidden md:table-cell">Reply %</th>
                <th className="text-right px-3 py-2">Meets</th>
                <th className="text-right px-3 py-2">Props</th>
                <th className="text-right px-3 py-2">Contracts</th>
                <th className="text-right px-3 py-2">Revenue won</th>
              </tr>
            </thead>
            <tbody>
              {team.map((u, i) => (
                <tr key={u.userId} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#94A3B8] tabular-nums w-4">{i + 1}.</span>
                      <span className="text-[13px] font-medium text-[#0F172A]">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{u.messages}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{u.replies}</td>
                  <td className="px-3 py-2 text-right text-[12px] hidden md:table-cell tabular-nums">
                    <span className={cn(u.replyRate >= 15 ? "text-emerald-700 font-medium" : "text-[#475569]")}>{u.replyRate}%</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{u.meetings}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{u.proposals}</td>
                  <td className="px-3 py-2 text-right text-[12px] text-[#475569] tabular-nums">{u.contracts}</td>
                  <td className="px-3 py-2 text-right text-[14px] font-bold text-[#7C3AED] tabular-nums">{fmtMAD(u.revenueWon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
