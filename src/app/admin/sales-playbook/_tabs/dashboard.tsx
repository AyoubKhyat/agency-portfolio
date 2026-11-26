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
      <div className="flex items-center justify-between text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
        <span>Last {data.sinceDays} days</span>
        <button
          onClick={recomputeScores}
          disabled={recomputing}
          className="inline-flex items-center gap-1.5 text-[#8B00FF] os-dark:text-[var(--os-purple)] hover:text-[#7C3AED] os-dark:hover:text-[var(--os-purple)] disabled:opacity-50"
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
        <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">Coaching insights</h2>
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
        <div className="rounded-2xl border-2 border-purple-200 os-dark:border-purple-500/30 bg-gradient-to-br from-purple-50 to-violet-50 os-dark:from-purple-500/10 os-dark:to-violet-500/5 p-4 sm:p-5 flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shadow-md shadow-purple-500/30">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[#8B00FF] os-dark:text-[var(--os-purple)] font-bold mb-0.5">Winning insight</div>
            <div className="text-[14px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">{data.winningInsight.label}</div>
            <div className="text-[13px] text-[#8B00FF] os-dark:text-[var(--os-purple)] font-medium">{data.winningInsight.value} <span className="text-[#64748B] os-dark:text-[var(--os-text-soft)] font-normal">· {data.winningInsight.meta}</span></div>
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
          <h2 className="text-[15px] font-semibold text-[var(--os-text)]">Team performance</h2>
          {winner && (
            <span className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
              Leader: <span className="font-medium text-[var(--os-text)]">{winner.name}</span>
            </span>
          )}
        </div>

        <div className="border border-[var(--os-border)] rounded-2xl overflow-hidden bg-[var(--os-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 os-dark:bg-[var(--os-surface-2)] border-b border-[var(--os-border)]">
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Team member</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Sent</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Replies</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Reply rate</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)] hidden md:table-cell">Meetings</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)] hidden md:table-cell">Proposals</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Won</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">
                      No team activity in the last {data.sinceDays} days.
                    </td>
                  </tr>
                ) : sortedUsers.map((u, i) => (
                  <tr key={u.userId} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#94A3B8] os-dark:text-[var(--os-text-soft)] w-4 tabular-nums">{i + 1}</span>
                        <span className="text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums">{u.messagesSent}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums">{u.repliesReceived}</td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums">
                      <span className={u.replyRate >= 15 ? "text-emerald-600 os-dark:text-emerald-400 font-medium" : "text-[#475569] os-dark:text-[var(--os-text)]"}>
                        {u.replyRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums hidden md:table-cell">{u.meetingsBooked}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums hidden md:table-cell">{u.proposalsSent}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-[#8B00FF] os-dark:text-[var(--os-purple)] tabular-nums">{u.clientsWon}</td>
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
      <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">A/B/C/D performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {variants.map((v) => {
          const isWinner = v.variant === winnerVariant && v.sent >= 5;
          return (
            <div
              key={v.variant}
              className={cn(
                "rounded-2xl border p-4 bg-[var(--os-surface)]",
                isWinner ? "border-purple-300 os-dark:border-purple-500/30 shadow-sm shadow-purple-500/10" : "border-[var(--os-border)]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold",
                  isWinner ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white" : "bg-gray-100 os-dark:bg-[var(--os-surface-2)] text-[#475569] os-dark:text-[var(--os-text)]"
                )}>
                  {v.variant}
                </div>
                {isWinner && <span className="text-[10px] uppercase tracking-wider text-[#8B00FF] os-dark:text-[var(--os-purple)] font-bold">Winner</span>}
              </div>
              <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mb-1.5">{VARIANT_LABELS[v.variant] || v.variant}</div>
              <div className={cn("text-2xl font-bold tabular-nums", isWinner ? "text-[#8B00FF] os-dark:text-[var(--os-purple)]" : "text-[#0F172A] os-dark:text-[var(--os-text)]")}>
                {v.replyRate}%
              </div>
              <div className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mt-1 tabular-nums">{v.replied} / {v.sent} sends</div>
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
      <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">Conversion funnel</h2>
      <div className="border border-[var(--os-border)] rounded-2xl bg-[var(--os-surface)] p-4 sm:p-5 space-y-2">
        {funnel.map((stage, i) => {
          const widthPct = Math.max(8, (stage.count / max) * 100);
          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="text-[12px] text-[#64748B] os-dark:text-[var(--os-text-soft)] w-28 shrink-0">{stage.stage}</span>
              <div className="flex-1 relative">
                <div
                  className="h-7 rounded-md bg-gradient-to-r from-[#8B00FF] to-[#C026D3] flex items-center px-2 text-white text-[12px] font-semibold transition-all"
                  style={{ width: `${widthPct}%`, opacity: 1 - i * 0.12 }}
                >
                  {stage.count.toLocaleString()}
                </div>
              </div>
              <span className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] w-14 text-right tabular-nums">
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
      <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">Template performance</h2>
      <div className="border border-[var(--os-border)] rounded-2xl overflow-hidden bg-[var(--os-surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 os-dark:bg-[var(--os-surface-2)] border-b border-[var(--os-border)]">
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Template</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Sent</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Replied</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Meetings</th>
              <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider font-medium text-[#64748B] os-dark:text-[var(--os-text-soft)]">Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const isTop = topThird.includes(t);
              const isBottom = bottomThird.includes(t);
              return (
                <tr key={t.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-[#0F172A] os-dark:text-[var(--os-text)]">{t.name}</span>
                      <span className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] uppercase">{t.channel}</span>
                      {isTop && <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 font-medium">TOP</span>}
                      {isBottom && !isTop && <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-50 os-dark:bg-rose-500/10 text-rose-700 os-dark:text-rose-300 font-medium">BOTTOM</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums">{t.sent}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums">{t.replied}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#475569] os-dark:text-[var(--os-text)] tabular-nums">{t.meetingBooked}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{t.replyRate}%</td>
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
        <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">Why prospects reply</h2>
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-5 text-[12px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">
          Tag reasons as replies come in to surface what's actually killing deals.
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">Why prospects reply</h2>
      <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
        <div className="h-3 w-full rounded-full bg-gray-100 os-dark:bg-[var(--os-surface-2)] overflow-hidden flex">
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
              <span className="text-[#0F172A] os-dark:text-[var(--os-text)] font-medium flex-1">{REPLY_REASON_LABELS[r.reason] || r.reason}</span>
              <span className="text-[#64748B] os-dark:text-[var(--os-text-soft)] tabular-nums">{r.count} ({Math.round((r.count / total) * 100)}%)</span>
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
      <h2 className="text-[15px] font-semibold text-[var(--os-text)] mb-3">{monthly.label} so far</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1.5">Messages</div>
          <div className="text-2xl font-bold text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{monthly.messagesSent}</div>
        </div>
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1.5">Replies</div>
          <div className="text-2xl font-bold text-[#0F172A] os-dark:text-[var(--os-text)] tabular-nums">{monthly.repliesReceived}</div>
        </div>
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1.5">Reply rate</div>
          <div className={cn("text-2xl font-bold tabular-nums", monthly.replyRate >= 15 ? "text-emerald-600 os-dark:text-emerald-400" : "text-[#0F172A] os-dark:text-[var(--os-text)]")}>
            {monthly.replyRate}%
          </div>
        </div>
        <div className="rounded-2xl border border-purple-200 os-dark:border-purple-500/30 bg-gradient-to-br from-purple-50 to-violet-50 os-dark:from-purple-500/10 os-dark:to-violet-500/5 p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1.5">Clients won</div>
          <div className="text-2xl font-bold text-[#8B00FF] os-dark:text-[var(--os-purple)] tabular-nums">{monthly.clientsWon}</div>
        </div>
      </div>
    </div>
  );
}

function CoachingCard({ icon, label, data, empty }: { icon: React.ReactNode; label: string; data: CoachingHighlight; empty: string }) {
  return (
    <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
        <span className="text-[#8B00FF] os-dark:text-[var(--os-purple)]">{icon}</span>
        {label}
      </div>
      {data ? (
        <div className="mt-3">
          <div className="text-[15px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">{data.label}</div>
          <div className="text-[13px] text-[#8B00FF] os-dark:text-[var(--os-purple)] font-medium mt-1">{data.value}</div>
          <div className="text-[11px] text-[#64748B] os-dark:text-[var(--os-text-soft)] mt-0.5">{data.meta}</div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)] leading-relaxed">{empty}</div>
      )}
    </div>
  );
}
