"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Send, MessageCircle, CalendarCheck, FileSignature, Trophy, Flame,
  Phone as PhoneIcon, Loader2, AlertCircle, ChevronRight, SkipForward, RefreshCw,
  ChevronLeft, Target as TargetIcon, Sparkles, CheckCircle2, ExternalLink, BookOpen, Crown,
} from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */
type QueueProspect = {
  id: string; name: string; phone: string | null; whatsappLink: string | null;
  instagram: string | null; sector: string; neighborhood: string;
  score: number | null; qualityLabel: string | null; status: string;
  sentAt: string | null; followup1At: string | null; followup2At: string | null; followup3At: string | null;
  lastActionByName: string | null; lastActionAt: string | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
};

type QueueData = {
  buckets: { never_contacted: QueueProspect[]; due_day_4: QueueProspect[]; due_day_10: QueueProspect[]; due_day_20: QueueProspect[] };
  counts: { never_contacted: number; due_day_4: number; due_day_10: number; due_day_20: number };
  totalHot: number;
};

type Scoreboard = {
  scope: string;
  counts: { messagesSent: number; replies: number; replyRate: number; prospectsContacted: number; meetingsBooked: number; proposalsSent: number; clientsWon: number };
  perUser: Array<{ userId: string | null; name: string; messagesSent: number; replies: number; replyRate: number }>;
};

type Prediction = QueueProspect & {
  predictionScore: number;
  reasons: string[];
  hasWebsite?: boolean;
  website?: string | null;
  _count?: { outreachMessages: number; meetings: number };
};

const BUCKET_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  never_contacted: { label: "Never contacted", icon: "🆕", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  due_day_4: { label: "Day 4+ no follow-up", icon: "📨", color: "bg-amber-50 text-amber-700 border-amber-200" },
  due_day_10: { label: "Day 10+ no follow-up", icon: "⏰", color: "bg-rose-50 text-rose-700 border-rose-200" },
  due_day_20: { label: "Day 20+ no follow-up", icon: "🚨", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

function followupStage(p: QueueProspect): string {
  if (!p.sentAt) return "Not contacted";
  if (!p.followup1At) return "Day 1 sent";
  if (!p.followup2At) return "Day 4 sent";
  if (!p.followup3At) return "Day 10 sent";
  return "Day 20 sent (cycle done)";
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
export default function OutreachCommandCenter() {
  const [tab, setTab] = useState<"all" | "queue" | "predict" | "focus">("queue");

  const [queue, setQueue] = useState<QueueData | null>(null);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [q, s, p] = await Promise.all([
      fetch("/api/admin/outreach/queue").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/outreach/scoreboard").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/outreach/predictions").then((r) => r.ok ? r.json() : null),
    ]);
    if (q) setQueue(q);
    if (s) setScoreboard(s);
    if (p) setPredictions(p.predictions || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function markStatus(prospectId: string, status: string | null, actionType: string) {
    const body: Record<string, unknown> = { actionType };
    if (status) body.status = status;
    await fetch(`/api/admin/prospecting/${prospectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Refresh data after action
    loadAll();
  }

  const allHot: QueueProspect[] = useMemo(() => {
    if (!queue) return [];
    return [
      ...queue.buckets.never_contacted,
      ...queue.buckets.due_day_4,
      ...queue.buckets.due_day_10,
      ...queue.buckets.due_day_20,
    ].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [queue]);

  return (
    <div>
      <PageHeader
        title="Outreach Command Center"
        subtitle="Convert HOT prospects into clients. 293 ready · stop discovery until 100+ contacted."
        actions={
          <button onClick={loadAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Persistent scoreboard */}
      <ScoreboardCard scoreboard={scoreboard} loading={loading && !scoreboard} />

      {/* Tab nav */}
      <div className="mt-5 mb-4">
        <FilterTabs
          items={[
            { value: "queue", label: "Queue", count: queue ? queue.counts.never_contacted + queue.counts.due_day_4 + queue.counts.due_day_10 + queue.counts.due_day_20 : undefined },
            { value: "predict", label: "Predictions", count: predictions?.length },
            { value: "focus", label: "Focus mode" },
            { value: "all", label: "All HOT", count: queue?.totalHot },
          ]}
          active={tab}
          onChange={(v) => setTab(v as typeof tab)}
          size="md"
        />
      </div>

      {tab === "queue" && (
        <QueueTab queue={queue} loading={loading && !queue} onAction={markStatus} />
      )}
      {tab === "predict" && (
        <PredictionsTab predictions={predictions} loading={loading && !predictions} onAction={markStatus} />
      )}
      {tab === "focus" && (
        <FocusTab prospects={
          predictions && predictions.length > 0
            ? predictions
            : allHot.filter((p) => !p.sentAt).slice(0, 50)
        } onAction={markStatus} />
      )}
      {tab === "all" && (
        <AllHotTab prospects={allHot} loading={loading && allHot.length === 0} onAction={markStatus} />
      )}
    </div>
  );
}

/* ============================================================
 * Scoreboard
 * ============================================================ */
function ScoreboardCard({ scoreboard, loading }: { scoreboard: Scoreboard | null; loading: boolean }) {
  if (loading || !scoreboard) {
    return <div className="os-skeleton h-24 rounded-2xl" />;
  }
  const c = scoreboard.counts;
  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/40 to-violet-50/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="w-4 h-4 text-[#8B00FF]" />
        <h2 className="text-[14px] font-semibold text-[#0F172A]">Today&apos;s scoreboard</h2>
        <span className="ml-auto text-[11px] text-[#64748B]">all team members</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        <ScoreCard label="Messages" value={c.messagesSent} icon={<Send className="w-3.5 h-3.5" />} />
        <ScoreCard label="Replies" value={c.replies} icon={<MessageCircle className="w-3.5 h-3.5" />} subtle={`${c.replyRate}%`} />
        <ScoreCard label="Prospects" value={c.prospectsContacted} icon={<Flame className="w-3.5 h-3.5" />} subtle="touched" />
        <ScoreCard label="Meetings" value={c.meetingsBooked} icon={<CalendarCheck className="w-3.5 h-3.5" />} />
        <ScoreCard label="Proposals" value={c.proposalsSent} icon={<FileSignature className="w-3.5 h-3.5" />} />
        <ScoreCard label="Clients" value={c.clientsWon} icon={<Trophy className="w-3.5 h-3.5" />} highlight />
      </div>
      {scoreboard.perUser.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#64748B]">
          <span className="font-semibold text-[#0F172A]">By user:</span>
          {scoreboard.perUser.map((u) => (
            <span key={u.userId} className="px-2 py-0.5 bg-white rounded border border-[var(--os-border)]">
              {u.name}: <span className="font-medium text-[#0F172A]">{u.messagesSent}</span> sent
              {u.replies > 0 && <span className="text-emerald-700"> · {u.replies} replies ({u.replyRate}%)</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, icon, subtle, highlight }: { label: string; value: number; icon: React.ReactNode; subtle?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-2.5 bg-white",
      highlight ? "border-purple-300 shadow-sm shadow-purple-500/10" : "border-purple-100"
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">
        <span className={cn(highlight ? "text-[#8B00FF]" : "text-[#7C3AED]")}>{icon}</span>
        {label}
      </div>
      <div className={cn("text-xl sm:text-2xl font-bold tabular-nums", highlight ? "text-[#8B00FF]" : "text-[#0F172A]")}>{value}</div>
      {subtle && <div className="text-[10px] text-[#64748B]">{subtle}</div>}
    </div>
  );
}

/* ============================================================
 * One-click action row (reused everywhere)
 * ============================================================ */
function ActionRow({ p, onAction, compact }: { p: QueueProspect; onAction: (id: string, status: string | null, actionType: string) => void; compact?: boolean }) {
  const hasPhone = !!(p.phone && p.phone.trim());
  const hasIG = !!(p.instagram && p.instagram.trim());
  const waUrl = p.whatsappLink || (hasPhone ? `https://wa.me/${(p.phone || "").replace(/\D/g, "")}` : "");
  const igUrl = hasIG ? `https://instagram.com/${(p.instagram || "").replace(/^@/, "")}` : "";

  function handleWhatsApp() {
    if (waUrl) window.open(waUrl, "_blank");
    onAction(p.id, "ENVOYE", "SENT_WHATSAPP");
  }
  function handleInstagram() {
    if (igUrl) window.open(igUrl, "_blank");
    onAction(p.id, "ENVOYE", "SENT_INSTAGRAM");
  }

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", compact && "gap-1")}>
      {hasPhone && (
        <button onClick={handleWhatsApp} title="Open WhatsApp + mark sent" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
          <FaWhatsapp className="w-3.5 h-3.5" /> WA
        </button>
      )}
      {hasIG && (
        <button onClick={handleInstagram} title="Open Instagram + mark sent" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-purple-50 text-[#7C3AED] hover:bg-purple-100">
          <FaInstagram className="w-3.5 h-3.5" /> IG
        </button>
      )}
      {hasPhone && (
        <a href={`tel:${p.phone}`} title={`Call ${p.phone}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100">
          <PhoneIcon className="w-3.5 h-3.5" /> Call
        </a>
      )}
      <div className="w-px h-4 bg-[var(--os-border)] mx-0.5" />
      <button onClick={() => onAction(p.id, "REPONDU", "MARKED_REPLIED")} title="Mark replied" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">
        <MessageCircle className="w-3.5 h-3.5" /> Reply
      </button>
      <button onClick={() => onAction(p.id, null, "MEETING_BOOKED")} title="Mark meeting booked" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-cyan-50 text-cyan-700 hover:bg-cyan-100">
        <CalendarCheck className="w-3.5 h-3.5" /> Meeting
      </button>
      <button onClick={() => onAction(p.id, null, "PROPOSAL_SENT")} title="Mark proposal sent" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
        <FileSignature className="w-3.5 h-3.5" /> Proposal
      </button>
      <button onClick={() => onAction(p.id, "CONVERTI", "STATUS_CONVERTI")} title="Mark client won" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm hover:shadow">
        <Trophy className="w-3.5 h-3.5" /> Won
      </button>
    </div>
  );
}

/* ============================================================
 * Queue tab
 * ============================================================ */
function QueueTab({ queue, loading, onAction }: { queue: QueueData | null; loading: boolean; onAction: (id: string, status: string | null, actionType: string) => void }) {
  if (loading || !queue) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-32 rounded-2xl" />)}</div>;

  const sections: Array<keyof QueueData["buckets"]> = ["never_contacted", "due_day_4", "due_day_10", "due_day_20"];

  return (
    <div className="space-y-4">
      {sections.map((key) => {
        const bucket = queue.buckets[key];
        const meta = BUCKET_LABELS[key];
        return (
          <details key={key} open={key === "never_contacted" || bucket.length > 0} className="rounded-2xl border border-[var(--os-border)] bg-white">
            <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/60 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">{meta.icon}</span>
                <h2 className="text-[14px] font-semibold text-[#0F172A]">{meta.label}</h2>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", meta.color)}>{bucket.length}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </summary>
            {bucket.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#94A3B8] border-t border-[var(--os-border)]">
                Empty — every HOT prospect at this stage has been handled.
              </div>
            ) : (
              <div className="border-t border-[var(--os-border)] divide-y divide-[var(--os-border)]">
                {bucket.slice(0, 50).map((p) => (
                  <ProspectRow key={p.id} p={p} onAction={onAction} />
                ))}
                {bucket.length > 50 && (
                  <div className="px-4 py-2 text-[11px] text-[#64748B] text-center">+ {bucket.length - 50} more</div>
                )}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

function ProspectRow({ p, onAction }: { p: QueueProspect; onAction: (id: string, status: string | null, actionType: string) => void }) {
  return (
    <div className="px-4 py-3 hover:bg-gray-50/60">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Link href={`/admin/prospecting/${p.id}`} className="text-[14px] font-semibold text-[#0F172A] hover:text-[#7C3AED]">
              {p.name}
            </Link>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold uppercase tracking-wider"><Flame className="w-2.5 h-2.5 inline -mt-0.5" /> HOT</span>
            <span className="text-[11px] text-[#64748B]">{p.sector}</span>
            {p.neighborhood && <span className="text-[11px] text-[#94A3B8]">· {p.neighborhood}</span>}
            {p.score !== null && <span className="text-[10px] text-[#7C3AED] font-medium">score {p.score}</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#64748B] flex-wrap">
            {p.phone && <span className="tabular-nums">{p.phone}</span>}
            {p.instagram && <span>@{p.instagram.replace(/^@/, "")}</span>}
            <span>·</span>
            <span>{followupStage(p)}</span>
            {p.lastActionAt && <><span>·</span><span>last touched {relativeDate(p.lastActionAt)}</span></>}
            {p.owner && <><span>·</span><span className="font-medium text-[#475569]">{p.owner.fullName}</span></>}
          </div>
        </div>
        <div className="shrink-0">
          <ActionRow p={p} onAction={onAction} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Predictions tab
 * ============================================================ */
function PredictionsTab({ predictions, loading, onAction }: { predictions: Prediction[] | null; loading: boolean; onAction: (id: string, status: string | null, actionType: string) => void }) {
  if (loading || !predictions) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-2xl" />)}</div>;
  if (predictions.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--os-border)] bg-white p-8 text-center text-[#64748B]">
        <Sparkles className="w-6 h-6 mx-auto text-[#94A3B8] mb-2" />
        <p className="text-[13px]">No HOT prospects to predict yet. Mark some as replied to generate signal.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {predictions.map((p, i) => (
        <div key={p.id} className="rounded-2xl border border-[var(--os-border)] bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/30">
              <div className="text-[9px] uppercase tracking-wider font-medium opacity-80 leading-none">Score</div>
              <div className="text-[15px] font-bold tabular-nums leading-tight">{p.predictionScore}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[12px] text-[#94A3B8] tabular-nums font-medium">#{i + 1}</span>
                <Link href={`/admin/prospecting/${p.id}`} className="text-[14px] font-semibold text-[#0F172A] hover:text-[#7C3AED]">{p.name}</Link>
                <span className="text-[11px] text-[#64748B]">{p.sector}</span>
                {p.neighborhood && <span className="text-[11px] text-[#94A3B8]">· {p.neighborhood}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {p.reasons.map((r) => (
                  <span key={r} className="text-[10.5px] px-1.5 py-0.5 rounded bg-purple-50 text-[#7C3AED] border border-purple-100">{r}</span>
                ))}
              </div>
              <ActionRow p={p} onAction={onAction} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
 * Focus tab
 * ============================================================ */
function FocusTab({ prospects, onAction }: { prospects: QueueProspect[]; onAction: (id: string, status: string | null, actionType: string) => void }) {
  const [idx, setIdx] = useState(0);

  if (prospects.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--os-border)] bg-white p-10 text-center">
        <Trophy className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
        <div className="text-[15px] font-semibold text-[#0F172A]">Queue empty</div>
        <div className="text-[12px] text-[#64748B] mt-1">All priority HOT prospects have been touched. Check Queue or Predictions tabs.</div>
      </div>
    );
  }

  const current = prospects[Math.min(idx, prospects.length - 1)];
  const remaining = prospects.length - idx - 1;
  const hasPhone = !!(current.phone && current.phone.trim());
  const hasIG = !!(current.instagram && current.instagram.trim());

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-3 text-[11px] text-[#64748B]">
        <span>Prospect <span className="font-bold text-[#0F172A] tabular-nums">{idx + 1}</span> of {prospects.length}</span>
        <span>{remaining} remaining tonight</span>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border-2 border-purple-200 bg-white p-6 sm:p-8 mb-4 shadow-md shadow-purple-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-rose-600" />
          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold uppercase tracking-wider">HOT</span>
          <span className="text-[11px] text-[#94A3B8]">·</span>
          <span className="text-[11px] text-[#64748B]">score {current.score ?? 0} · {current.sector}{current.neighborhood ? ` · ${current.neighborhood}` : ""}</span>
        </div>
        <h2 className="text-[22px] sm:text-[26px] font-bold text-[#0F172A] tracking-tight mb-2">{current.name}</h2>
        <div className="space-y-1 mb-4 text-[13px] text-[#475569]">
          {current.phone && <div className="flex items-center gap-2"><PhoneIcon className="w-3.5 h-3.5 text-[#94A3B8]" /><span className="tabular-nums">{current.phone}</span></div>}
          {current.instagram && <div className="flex items-center gap-2"><FaInstagram className="w-3.5 h-3.5 text-[#94A3B8]" /><span>@{current.instagram.replace(/^@/, "")}</span></div>}
          <div className="flex items-center gap-2 text-[#94A3B8]">
            <span>Stage: {followupStage(current)}</span>
            {current.lastActionAt && <span>· last touched {relativeDate(current.lastActionAt)}</span>}
          </div>
        </div>

        {/* Big action buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {hasPhone && (
            <button
              onClick={() => {
                window.open(current.whatsappLink || `https://wa.me/${(current.phone || "").replace(/\D/g, "")}`, "_blank");
                onAction(current.id, "ENVOYE", "SENT_WHATSAPP");
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-emerald-500 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg"
            >
              <FaWhatsapp className="w-4 h-4" /> WhatsApp
            </button>
          )}
          {hasIG && (
            <button
              onClick={() => {
                window.open(`https://instagram.com/${(current.instagram || "").replace(/^@/, "")}`, "_blank");
                onAction(current.id, "ENVOYE", "SENT_INSTAGRAM");
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30 hover:shadow-lg"
            >
              <FaInstagram className="w-4 h-4" /> Instagram
            </button>
          )}
          {hasPhone && (
            <a href={`tel:${current.phone}`} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-amber-500 text-white shadow-md shadow-amber-500/30 hover:shadow-lg">
              <PhoneIcon className="w-4 h-4" /> Call
            </a>
          )}
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onAction(current.id, "REPONDU", "MARKED_REPLIED")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">
            <MessageCircle className="w-3 h-3" /> Replied
          </button>
          <button onClick={() => onAction(current.id, null, "MEETING_BOOKED")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-cyan-50 text-cyan-700 hover:bg-cyan-100">
            <CalendarCheck className="w-3 h-3" /> Meeting
          </button>
          <button onClick={() => onAction(current.id, null, "PROPOSAL_SENT")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
            <FileSignature className="w-3 h-3" /> Proposal
          </button>
          <button onClick={() => onAction(current.id, "CONVERTI", "STATUS_CONVERTI")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white">
            <Trophy className="w-3 h-3" /> Client won
          </button>
        </div>

        {/* Detail / playbook links */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--os-border)] text-[11px]">
          <Link href={`/admin/prospecting/${current.id}`} className="text-[#7C3AED] hover:underline inline-flex items-center gap-1">
            Full profile <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href={`/admin/sales-playbook`} className="text-[#7C3AED] hover:underline inline-flex items-center gap-1">
            Sales Playbook <BookOpen className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Nav controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(prospects.length - 1, i + 1))}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md hover:shadow-lg"
        >
          Next prospect <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIdx((i) => Math.min(prospects.length - 1, i + 1))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569]"
          title="Skip without action"
        >
          Skip <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
 * All HOT tab
 * ============================================================ */
function AllHotTab({ prospects, loading, onAction }: { prospects: QueueProspect[]; loading: boolean; onAction: (id: string, status: string | null, actionType: string) => void }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = useMemo(() => {
    if (filter === "ALL") return prospects;
    if (filter === "NEW") return prospects.filter((p) => !p.sentAt);
    if (filter === "FOLLOWUP") return prospects.filter((p) => p.sentAt && (!p.followup1At || !p.followup2At || !p.followup3At));
    if (filter === "REPLIED") return prospects.filter((p) => p.status === "REPONDU");
    return prospects;
  }, [prospects, filter]);

  if (loading) return <div className="os-skeleton h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: "ALL", label: `All (${prospects.length})` },
          { id: "NEW", label: "Never contacted" },
          { id: "FOLLOWUP", label: "Mid-sequence" },
          { id: "REPLIED", label: "Replied" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all",
              filter === f.id
                ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm"
                : "bg-white border border-[var(--os-border)] text-[#475569] hover:bg-gray-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--os-border)] bg-gray-50/60 text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                <th className="text-left px-3 py-2">Business</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Sector</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Phone</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Instagram</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Last touch</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Stage</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Owner</th>
                <th className="text-left px-3 py-2">Reply</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((p) => (
                <tr key={p.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                  <td className="px-3 py-2">
                    <Link href={`/admin/prospecting/${p.id}`} className="text-[13px] font-medium text-[#0F172A] hover:text-[#7C3AED]">{p.name}</Link>
                    <div className="text-[10px] text-[#94A3B8] md:hidden">{p.sector}{p.neighborhood ? ` · ${p.neighborhood}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-[#475569] hidden md:table-cell">{p.sector}</td>
                  <td className="px-3 py-2 text-[12px] text-[#475569] hidden lg:table-cell tabular-nums">{p.phone || <span className="text-[#CBD5E1]">—</span>}</td>
                  <td className="px-3 py-2 text-[12px] text-[#475569] hidden lg:table-cell">{p.instagram ? `@${p.instagram.replace(/^@/, "")}` : <span className="text-[#CBD5E1]">—</span>}</td>
                  <td className="px-3 py-2 text-[12px] text-[#475569] hidden md:table-cell">{relativeDate(p.lastActionAt)}</td>
                  <td className="px-3 py-2 text-[11px] text-[#64748B] hidden md:table-cell">{followupStage(p)}</td>
                  <td className="px-3 py-2 text-[11px] text-[#64748B] hidden lg:table-cell">{p.owner?.fullName || <span className="text-[#CBD5E1]">unassigned</span>}</td>
                  <td className="px-3 py-2">
                    {p.status === "REPONDU" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">REPLIED</span>}
                    {p.status === "ENVOYE" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">SENT</span>}
                    {p.status === "A_ENVOYER" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#64748B] font-medium">PENDING</span>}
                    {p.status === "CONVERTI" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-[#7C3AED] font-medium">CLIENT</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <ActionRow p={p} onAction={onAction} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 300 && (
          <div className="px-4 py-2 text-[11px] text-[#64748B] text-center border-t border-[var(--os-border)]">Showing top 300 of {filtered.length}</div>
        )}
      </div>
    </div>
  );
}
