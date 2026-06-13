"use client";

import { useEffect, useState } from "react";
import {
  Send, MessageSquare, CalendarCheck, Trophy,
  Sparkles, TrendingUp, Award, RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { cn } from "@/lib/utils";

type CoachingHighlight = { label: string; value: string; meta: string } | null;
type PerUser = {
  userId: string;
  name: string;
  messagesSent: number;
  repliesReceived: number;
  replyRate: number;
  meetingsBooked: number;
  proposalsSent: number;
  clientsWon: number;
};
type TemplateStat = {
  id: string; name: string; channel: string;
  sent: number; replied: number; meetingBooked: number;
  replyRate: number; meetingRate: number;
};
type FunnelStage = { stage: string; count: number; conversionFromPrev: number | null };
type ReplyReason = { reason: string; count: number };
type DashboardData = {
  sinceDays: number;
  totals: {
    messagesSent: number;
    repliesReceived: number;
    replyRate: number;
    meetingsBooked: number;
    proposalsSent: number;
    clientsWon: number;
  } | null;
  perUser: PerUser[];
  coaching: {
    bestMessage: CoachingHighlight;
    bestSector: CoachingHighlight;
    bestSalesperson: CoachingHighlight;
  };
  templatePerformance: TemplateStat[];
  funnel: FunnelStage[];
  replyReasons: ReplyReason[];
  totalTaggedReplies: number;
  variantPerformance: { variant: string; sent: number; replied: number; replyRate: number }[];
  tonePerformance: { tone: string; sent: number; replied: number; replyRate: number }[];
  sectorWinners: Record<string, { templateName: string; sent: number; replied: number; replyRate: number }>;
  winningInsight: { label: string; value: string; meta: string } | null;
  monthly: {
    label: string;
    messagesSent: number;
    repliesReceived: number;
    clientsWon: number;
    replyRate: number;
  };
};

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sales-playbook/dashboard");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function recomputeScores() {
    if (recomputing) return;
    setRecomputing(true);
    try {
      await fetch("/api/admin/prospecting/score-all", { method: "POST" });
    } finally {
      setRecomputing(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-2xl" />)}
      </div>
    );
  }

  const totals = data.totals;
  const sortedUsers = [...data.perUser].sort((a, b) => b.replyRate - a.replyRate || b.clientsWon - a.clientsWon);
  const winner = sortedUsers[0];

  return (
    <div className="space-y-6">
      {/* Range note + actions */}
      <div className="flex items-center justify-between text-[12px] text-[#64748B]">
        <span>Last {data.sinceDays} days</span>
        <button
          onClick={recomputeScores}
          disabled={recomputing}
          className="inline-flex items-center gap-1.5 text-[#8B00FF] hover:text-[#7C3AED] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? "animate-spin" : ""}`} />
          {recomputing ? "Scoring..." : "Recompute prospect scores"}
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard value={totals?.messagesSent || 0} label="Messages sent" icon={<Send className="w-5 h-5" />} index={0} />
        <StatCard value={totals?.repliesReceived || 0} label={`Replies (${totals?.replyRate || 0}%)`} icon={<MessageSquare className="w-5 h-5" />} index={1} />
        <StatCard value={totals?.meetingsBooked || 0} label="Meetings booked" icon={<CalendarCheck className="w-5 h-5" />} index={2} />
        <StatCard value={totals?.clientsWon || 0} label="Clients won" icon={<Trophy className="w-5 h-5" />} index={3} accent />
      </div>

      {/* Coaching highlights */}
      <div>
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">Coaching insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <CoachingCard
            icon={<Sparkles className="w-4 h-4" />}
            label="Best performing message"
            data={data.coaching.bestMessage}
            empty="Log 3+ uses per template to surface a winner."
          />
          <CoachingCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Best performing sector"
            data={data.coaching.bestSector}
            empty="Win your first client to see top sector."
          />
          <CoachingCard
            icon={<Award className="w-4 h-4" />}
            label="Best performing salesperson"
            data={data.coaching.bestSalesperson}
            empty="At least 5 messages sent to qualify."
          />
        </div>
      </div>

      {/* Winning insight banner */}
      {data.winningInsight && (
        <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 sm:p-5 flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shadow-md shadow-purple-500/30">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[#8B00FF] font-bold mb-0.5">Winning insight</div>
            <div className="text-[14px] font-semibold text-[#0F172A]">{data.winningInsight.label}</div>
            <div className="text-[13px] text-[#8B00FF] font-medium">{data.winningInsight.value} <span className="text-[#64748B] font-normal">· {data.winningInsight.meta}</span></div>
          </div>
        </div>
      )}

      {/* Variant performance (A/B/C/D) */}
      {data.variantPerformance.length > 0 && <VariantPerformance variants={data.variantPerformance} />}

      {/* Conversion funnel (Feature 5) */}
      <ConversionFunnel funnel={data.funnel} />

      {/* Template performance (Feature 3) */}
      <TemplatePerformance templates={data.templatePerformance} />

      {/* Reply reasons (Feature 4) */}
      <ReplyReasonsBlock reasons={data.replyReasons} total={data.totalTaggedReplies} />

      {/* Monthly snapshot (Feature 6) */}
      <MonthlySnapshot monthly={data.monthly} />

      {/* Leaderboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Team performance</h2>
          {winner && (
            <span className="text-[11px] text-[#64748B]">
              Leader: <span className="font-medium text-[#0F172A]">{winner.name}</span>
            </span>
          )}
        </div>

        <div className="border border-[var(--os-border)] rounded-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-[var(--os-border)]">
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Team member</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Sent</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Replies</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Reply rate</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] hidden md:table-cell">Meetings</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] hidden md:table-cell">Proposals</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Won</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#64748B]">
                      No team activity in the last {data.sinceDays} days.
                    </td>
                  </tr>
                ) : sortedUsers.map((u, i) => (
                  <tr key={u.userId} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#94A3B8] w-4 tabular-nums">{i + 1}</span>
                        <span className="text-[13px] font-medium text-[#0F172A]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums">{u.messagesSent}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums">{u.repliesReceived}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums">
                      <span className={u.replyRate >= 15 ? "text-emerald-600 font-medium" : "text-[#475569]"}>
                        {u.replyRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums hidden md:table-cell">{u.meetingsBooked}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums hidden md:table-cell">{u.proposalsSent}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-[#8B00FF] tabular-nums">{u.clientsWon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const REPLY_REASON_LABELS: Record<string, string> = {
  MEETING_REQUESTED: "Wants a meeting",
  PROPOSAL_REQUESTED: "Wants a proposal",
  INTERESTED: "Interested",
  LATER: "Call later",
  NOT_INTERESTED: "Not interested",
  HAS_PROVIDER: "Already has provider",
  TOO_EXPENSIVE: "Too expensive",
  NO_BUDGET: "No budget",
};

const REPLY_REASON_COLORS: Record<string, string> = {
  MEETING_REQUESTED: "bg-purple-600",
  PROPOSAL_REQUESTED: "bg-indigo-600",
  INTERESTED: "bg-emerald-500",
  LATER: "bg-amber-500",
  NOT_INTERESTED: "bg-gray-400",
  HAS_PROVIDER: "bg-blue-500",
  TOO_EXPENSIVE: "bg-orange-500",
  NO_BUDGET: "bg-rose-500",
};

const VARIANT_LABELS: Record<string, string> = {
  A: "WhatsApp · short",
  B: "WhatsApp · long",
  C: "Instagram · short",
  D: "Instagram · long",
};

function VariantPerformance({ variants }: { variants: { variant: string; sent: number; replied: number; replyRate: number }[] }) {
  const winnerVariant = variants[0]?.variant;
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">A/B/C/D performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {variants.map((v) => {
          const isWinner = v.variant === winnerVariant && v.sent >= 5;
          return (
            <div
              key={v.variant}
              className={cn(
                "rounded-2xl border p-4 bg-white",
                isWinner ? "border-purple-300 shadow-sm shadow-purple-500/10" : "border-[var(--os-border)]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold",
                  isWinner ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white" : "bg-gray-100 text-[#475569]"
                )}>
                  {v.variant}
                </div>
                {isWinner && <span className="text-[9px] uppercase tracking-wider text-[#8B00FF] font-bold">Winner</span>}
              </div>
              <div className="text-[11px] text-[#64748B] mb-1.5">{VARIANT_LABELS[v.variant] || v.variant}</div>
              <div className={cn("text-2xl font-bold tabular-nums", isWinner ? "text-[#8B00FF]" : "text-[#0F172A]")}>
                {v.replyRate}%
              </div>
              <div className="text-[10px] text-[#94A3B8] mt-1 tabular-nums">{v.replied} / {v.sent} sends</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConversionFunnel({ funnel }: { funnel: FunnelStage[] }) {
  const max = Math.max(...funnel.map((f) => f.count), 1);
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">Conversion funnel</h2>
      <div className="border border-[var(--os-border)] rounded-2xl bg-white p-4 sm:p-5 space-y-2">
        {funnel.map((stage, i) => {
          const widthPct = Math.max(8, (stage.count / max) * 100);
          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="text-[12px] text-[#64748B] w-28 shrink-0">{stage.stage}</span>
              <div className="flex-1 relative">
                <div
                  className="h-7 rounded-md bg-gradient-to-r from-[#8B00FF] to-[#C026D3] flex items-center px-2 text-white text-[12px] font-semibold transition-all"
                  style={{ width: `${widthPct}%`, opacity: 1 - i * 0.12 }}
                >
                  {stage.count.toLocaleString()}
                </div>
              </div>
              <span className="text-[11px] text-[#64748B] w-14 text-right tabular-nums">
                {stage.conversionFromPrev === null ? "—" : `${stage.conversionFromPrev}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemplatePerformance({ templates }: { templates: TemplateStat[] }) {
  if (templates.length === 0) return null;
  const topThird = templates.slice(0, Math.max(1, Math.floor(templates.length / 3)));
  const bottomThird = templates.length > 2 ? templates.slice(-Math.max(1, Math.floor(templates.length / 3))) : [];
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">Template performance</h2>
      <div className="border border-[var(--os-border)] rounded-2xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-[var(--os-border)]">
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Template</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Sent</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Replied</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Meetings</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B]">Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const isTop = topThird.includes(t);
              const isBottom = bottomThird.includes(t);
              return (
                <tr key={t.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-[#0F172A]">{t.name}</span>
                      <span className="text-[10px] text-[#64748B] uppercase">{t.channel}</span>
                      {isTop && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">TOP</span>}
                      {isBottom && !isTop && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">BOTTOM</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums">{t.sent}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums">{t.replied}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#475569] tabular-nums">{t.meetingBooked}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold text-[#0F172A] tabular-nums">{t.replyRate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReplyReasonsBlock({ reasons, total }: { reasons: ReplyReason[]; total: number }) {
  if (total === 0) {
    return (
      <div>
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">Why prospects reply</h2>
        <div className="rounded-2xl border border-[var(--os-border)] bg-white p-5 text-[12px] text-[#94A3B8]">
          Tag reasons as replies come in to surface what's actually killing deals.
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">Why prospects reply</h2>
      <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden flex">
          {reasons.map((r) => (
            <div
              key={r.reason}
              className={cn("h-full transition-all", REPLY_REASON_COLORS[r.reason] || "bg-gray-400")}
              style={{ width: `${(r.count / total) * 100}%` }}
              title={`${REPLY_REASON_LABELS[r.reason] || r.reason}: ${r.count}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {reasons.map((r) => (
            <div key={r.reason} className="flex items-center gap-2 text-[12px]">
              <span className={cn("w-2.5 h-2.5 rounded-sm", REPLY_REASON_COLORS[r.reason] || "bg-gray-400")} />
              <span className="text-[#0F172A] font-medium flex-1">{REPLY_REASON_LABELS[r.reason] || r.reason}</span>
              <span className="text-[#64748B] tabular-nums">{r.count} ({Math.round((r.count / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthlySnapshot({ monthly }: { monthly: DashboardData["monthly"] }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">{monthly.label} so far</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-1.5">Messages</div>
          <div className="text-2xl font-bold text-[#0F172A] tabular-nums">{monthly.messagesSent}</div>
        </div>
        <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-1.5">Replies</div>
          <div className="text-2xl font-bold text-[#0F172A] tabular-nums">{monthly.repliesReceived}</div>
        </div>
        <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-1.5">Reply rate</div>
          <div className={cn("text-2xl font-bold tabular-nums", monthly.replyRate >= 15 ? "text-emerald-600" : "text-[#0F172A]")}>
            {monthly.replyRate}%
          </div>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-1.5">Clients won</div>
          <div className="text-2xl font-bold text-[#8B00FF] tabular-nums">{monthly.clientsWon}</div>
        </div>
      </div>
    </div>
  );
}

function CoachingCard({ icon, label, data, empty }: { icon: React.ReactNode; label: string; data: CoachingHighlight; empty: string }) {
  return (
    <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
        <span className="text-[#8B00FF]">{icon}</span>
        {label}
      </div>
      {data ? (
        <div className="mt-3">
          <div className="text-[15px] font-semibold text-[#0F172A]">{data.label}</div>
          <div className="text-[13px] text-[#8B00FF] font-medium mt-1">{data.value}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">{data.meta}</div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-[#94A3B8] leading-relaxed">{empty}</div>
      )}
    </div>
  );
}
