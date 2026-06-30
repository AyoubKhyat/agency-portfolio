"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Send, MessageCircle, CalendarCheck, FileSignature, Trophy, Flame,
  Phone as PhoneIcon, ChevronRight, SkipForward, RefreshCw,
  ChevronLeft, Sparkles, ExternalLink, BookOpen, Crown, MapPin, AlertTriangle,
  Plus, X, Loader2, CheckCircle2 as CheckIcon,
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

type Coverage = {
  threshold: number;
  needsExpansion: boolean;
  marrakech: {
    totalProspects: number;
    actionableHot: number;
    breakdown: { mobileAndInstagram: number; mobileOnly: number; instagramOnly: number; fixedLineOnly: number; websiteOnly: number; noContact: number };
    qualityLabels: { HOT: number; WARM: number; COLD: number };
  };
  recommendations: Array<{
    key: string; label: string; population: number; densityScore: number; outreachScore: number;
    sectors: string[]; rationale: string; expectedScore: number;
  }>;
  summary: string;
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

/* ---------- WhatsApp pre-fill helpers ---------- */
type Template = { key: string; name: string; channel: string; language: string; subject: string; body: string };

function fillTemplate(body: string, p: { name: string; sector: string; neighborhood: string }): string {
  return body
    .replace(/\{\{name\}\}/g, p.name)
    .replace(/\{\{sector\}\}/g, p.sector || "")
    .replace(/\{\{city\}\}/g, p.neighborhood || "Marrakech");
}

function pickTemplate(sector: string, templates: Template[]): Template | null {
  const s = (sector || "").toLowerCase();
  if (/spa|hammam/.test(s)) {
    return templates.find((t) => t.key === "WEBSITE_OFFER_SPA_HAMMAM") ?? null;
  }
  // Default fallback chain — extend with more sector branches over time
  return (
    templates.find((t) => t.key === "WEBSITE_OFFER") ??
    templates.find((t) => t.key === "INTRO") ??
    null
  );
}

/** wa.me requires international digits. Stored whatsappLink is already in 212xxx form;
 *  phone is usually local Moroccan (06/07/05). Prefer the stored link; only synthesize
 *  from phone when whatsappLink is empty. */
function buildWaUrl(p: { phone: string | null; whatsappLink: string | null }, body: string): string {
  let base = "";
  const stored = (p.whatsappLink || "").trim();
  if (stored) {
    // Strip any pre-existing query/trailing slash so we don't double-encode
    base = stored.split("?")[0].replace(/\/+$/, "");
  } else if (p.phone) {
    const digits = p.phone.replace(/\D/g, "");
    // Moroccan local format: 0X XX XX XX XX (10 digits, leading 0) → drop the 0, prefix 212
    const intl = digits.length === 10 && digits.startsWith("0") ? "212" + digits.slice(1) : digits;
    if (intl) base = `https://wa.me/${intl}`;
  }
  if (!base) return "";
  return body ? `${base}?text=${encodeURIComponent(body)}` : base;
}

/* ============================================================ */
export default function OutreachCommandCenter() {
  const [tab, setTab] = useState<"all" | "queue" | "predict" | "focus">("queue");

  const [queue, setQueue] = useState<QueueData | null>(null);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [q, s, p, c, t] = await Promise.all([
      fetch("/api/admin/outreach/queue").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/outreach/scoreboard").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/outreach/predictions").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/outreach/coverage").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/outreach/templates").then((r) => r.ok ? r.json() : null),
    ]);
    if (q) setQueue(q);
    if (s) setScoreboard(s);
    if (p) setPredictions(p.predictions || []);
    if (c) setCoverage(c);
    if (t) setTemplates(t.templates || []);
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
        subtitle={coverage
          ? `${coverage.marrakech.actionableHot} actionable HOT leads in Marrakech · target ${coverage.threshold}`
          : "Convert HOT prospects into clients."}
        actions={
          <div className="flex items-center gap-1.5">
            <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20 hover:shadow-lg">
              <Plus className="w-3.5 h-3.5" /> Add prospect
            </button>
            <button onClick={loadAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:bg-gray-50">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        }
      />

      {/* Persistent scoreboard */}
      <ScoreboardCard scoreboard={scoreboard} loading={loading && !scoreboard} actionableHot={coverage?.marrakech.actionableHot} />

      {/* Coverage report */}
      <div className="mt-4">
        <CoverageBlock coverage={coverage} loading={loading && !coverage} />
      </div>

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
        <QueueTab queue={queue} loading={loading && !queue} onAction={markStatus} templates={templates} />
      )}
      {tab === "predict" && (
        <PredictionsTab predictions={predictions} loading={loading && !predictions} onAction={markStatus} templates={templates} />
      )}
      {tab === "focus" && (
        <FocusTab prospects={
          predictions && predictions.length > 0
            ? predictions
            : allHot.filter((p) => !p.sentAt).slice(0, 50)
        } onAction={markStatus} templates={templates} />
      )}
      {tab === "all" && (
        <AllHotTab prospects={allHot} loading={loading && allHot.length === 0} onAction={markStatus} templates={templates} />
      )}

      {addOpen && (
        <QuickAddModal onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); loadAll(); }} />
      )}
    </div>
  );
}

/* ============================================================
 * Scoreboard
 * ============================================================ */
function ScoreboardCard({ scoreboard, loading, actionableHot }: { scoreboard: Scoreboard | null; loading: boolean; actionableHot?: number }) {
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
        {typeof actionableHot === "number" && (
          <ScoreCard label="Actionable HOT" value={actionableHot} icon={<Flame className="w-3.5 h-3.5" />} subtle="mobile / IG / WA" pool />
        )}
        <ScoreCard label="Messages" value={c.messagesSent} icon={<Send className="w-3.5 h-3.5" />} />
        <ScoreCard label="Replies" value={c.replies} icon={<MessageCircle className="w-3.5 h-3.5" />} subtle={`${c.replyRate}%`} />
        <ScoreCard label="Prospects" value={c.prospectsContacted} icon={<Flame className="w-3.5 h-3.5" />} subtle="touched today" />
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

function ScoreCard({ label, value, icon, subtle, highlight, pool }: { label: string; value: number; icon: React.ReactNode; subtle?: string; highlight?: boolean; pool?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-2.5",
      highlight ? "border-purple-300 bg-white shadow-sm shadow-purple-500/10"
        : pool ? "border-rose-200 bg-gradient-to-br from-rose-50/60 to-orange-50/40"
        : "border-purple-100 bg-white"
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium mb-1">
        <span className={cn(highlight ? "text-[#8B00FF]" : pool ? "text-rose-600" : "text-[#7C3AED]")}>{icon}</span>
        <span className={pool ? "text-rose-700" : "text-[#64748B]"}>{label}</span>
      </div>
      <div className={cn(
        "text-xl sm:text-2xl font-bold tabular-nums",
        highlight ? "text-[#8B00FF]" : pool ? "text-rose-700" : "text-[#0F172A]"
      )}>
        {value}
      </div>
      {subtle && <div className={cn("text-[10px]", pool ? "text-rose-600" : "text-[#64748B]")}>{subtle}</div>}
    </div>
  );
}

/* ============================================================
 * Coverage block — Marrakech breakdown + city expansion recommendation
 * ============================================================ */
function CoverageBlock({ coverage, loading }: { coverage: Coverage | null; loading: boolean }) {
  if (loading || !coverage) return <div className="os-skeleton h-32 rounded-2xl" />;
  const { marrakech, recommendations, needsExpansion, threshold, summary } = coverage;
  const b = marrakech.breakdown;

  return (
    <div className={cn(
      "rounded-2xl border-2 p-4 sm:p-5",
      needsExpansion ? "border-amber-200 bg-gradient-to-br from-amber-50/40 to-orange-50/40" : "border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-teal-50/40"
    )}>
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0",
          needsExpansion ? "bg-amber-500 shadow-amber-500/30" : "bg-emerald-500 shadow-emerald-500/30"
        )}>
          {needsExpansion ? <AlertTriangle className="w-5 h-5 text-white" /> : <MapPin className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[#0F172A]">Marrakech coverage</div>
          <div className="text-[12px] text-[#475569] mt-0.5">{summary}</div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <CoverageStat label="Total prospects" value={marrakech.totalProspects} />
        <CoverageStat label="Actionable HOT" value={marrakech.actionableHot} tone="hot" subtle={`target ${threshold}`} />
        <CoverageStat label="Mobile + IG" value={b.mobileAndInstagram} tone="hot" />
        <CoverageStat label="Mobile only" value={b.mobileOnly} tone="hot" />
        <CoverageStat label="Instagram only" value={b.instagramOnly} tone="hot" />
        <CoverageStat label="Fixed-line only" value={b.fixedLineOnly} tone="warm" subtle="not WhatsApp-able" />
      </div>

      {/* City expansion recommendation */}
      {needsExpansion && (
        <div className="border-t border-amber-200/60 pt-4">
          <div className="text-[13px] font-semibold text-[#0F172A] mb-1">
            Next-city recommendation
          </div>
          <div className="text-[11.5px] text-[#475569] mb-3">
            Below {threshold} actionable HOTs in Marrakech. Ranked by population × business density × outreach potential.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recommendations.slice(0, 4).map((c, i) => (
              <div key={c.key} className={cn(
                "rounded-xl border bg-white p-3",
                i === 0 ? "border-amber-300 shadow-sm" : "border-[var(--os-border)]"
              )}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-bold",
                    i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" : "bg-gray-100 text-[#475569]"
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-[14px] font-semibold text-[#0F172A]">{c.label}</span>
                  <span className="text-[11px] text-[#94A3B8]">{c.population.toLocaleString()}k pop</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-700 font-bold">score {c.expectedScore}</span>
                </div>
                <div className="text-[11.5px] text-[#475569] leading-snug mb-2">{c.rationale}</div>
                <div className="flex flex-wrap gap-1">
                  {c.sectors.slice(0, 5).map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-[#7C3AED] border border-purple-100">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {recommendations.length > 4 && (
            <details className="mt-2 text-[11px]">
              <summary className="cursor-pointer text-[#7C3AED] hover:underline">Show all {recommendations.length} cities</summary>
              <div className="mt-2 space-y-1.5">
                {recommendations.slice(4).map((c, i) => (
                  <div key={c.key} className="flex items-center gap-2 text-[11.5px]">
                    <span className="text-[#94A3B8] tabular-nums w-5">{i + 5}.</span>
                    <span className="font-medium text-[#0F172A]">{c.label}</span>
                    <span className="text-[#64748B]">— {c.rationale}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="mt-3">
            <Link
              href="/admin/prospect-discovery"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open Discovery to sweep {recommendations[0].label}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageStat({ label, value, tone, subtle }: { label: string; value: number; tone?: "hot" | "warm"; subtle?: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-2.5 bg-white",
      tone === "hot" ? "border-rose-200" : tone === "warm" ? "border-amber-200" : "border-[var(--os-border)]"
    )}>
      <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-0.5">{label}</div>
      <div className={cn(
        "text-lg sm:text-xl font-bold tabular-nums",
        tone === "hot" ? "text-rose-700" : tone === "warm" ? "text-amber-700" : "text-[#0F172A]"
      )}>
        {value.toLocaleString()}
      </div>
      {subtle && <div className="text-[10px] text-[#94A3B8]">{subtle}</div>}
    </div>
  );
}

/* ============================================================
 * One-click action row (reused everywhere)
 * ============================================================ */
function ActionRow({ p, onAction, compact, templates }: { p: QueueProspect; onAction: (id: string, status: string | null, actionType: string) => void; compact?: boolean; templates: Template[] }) {
  const hasPhone = !!(p.phone && p.phone.trim());
  const hasIG = !!(p.instagram && p.instagram.trim());
  const igUrl = hasIG ? `https://instagram.com/${(p.instagram || "").replace(/^@/, "")}` : "";

  function handleWhatsApp() {
    const tpl = pickTemplate(p.sector, templates);
    const body = tpl ? fillTemplate(tpl.body, p) : "";
    const url = buildWaUrl(p, body);
    if (url) window.open(url, "_blank");
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
function QueueTab({ queue, loading, onAction, templates }: { queue: QueueData | null; loading: boolean; onAction: (id: string, status: string | null, actionType: string) => void; templates: Template[] }) {
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
                  <ProspectRow key={p.id} p={p} onAction={onAction} templates={templates} />
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

function ProspectRow({ p, onAction, templates }: { p: QueueProspect; onAction: (id: string, status: string | null, actionType: string) => void; templates: Template[] }) {
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
          <ActionRow p={p} onAction={onAction} templates={templates} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Predictions tab
 * ============================================================ */
function PredictionsTab({ predictions, loading, onAction, templates }: { predictions: Prediction[] | null; loading: boolean; onAction: (id: string, status: string | null, actionType: string) => void; templates: Template[] }) {
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
              <ActionRow p={p} onAction={onAction} templates={templates} />
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
function FocusTab({ prospects, onAction, templates }: { prospects: QueueProspect[]; onAction: (id: string, status: string | null, actionType: string) => void; templates: Template[] }) {
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
                const tpl = pickTemplate(current.sector, templates);
                const body = tpl ? fillTemplate(tpl.body, current) : "";
                const url = buildWaUrl(current, body);
                if (url) window.open(url, "_blank");
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
function AllHotTab({ prospects, loading, onAction, templates }: { prospects: QueueProspect[]; loading: boolean; onAction: (id: string, status: string | null, actionType: string) => void; templates: Template[] }) {
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
                      <ActionRow p={p} onAction={onAction} compact templates={templates} />
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

/* ============================================================
 * Quick Add modal — minimal fields, save → ready to message
 * ============================================================ */
const SUGGESTED_SECTORS = [
  "Restaurant", "Café", "Hotel", "Riad", "Clinic", "Dentist", "Beauty salon",
  "Spa", "Gym", "Real estate", "Lawyer", "Architect", "School", "Other",
];

function QuickAddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [sector, setSector] = useState("Restaurant");
  const [neighborhood, setNeighborhood] = useState("Marrakech");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; qualityLabel: string | null } | null>(null);

  // At least one of phone or instagram is required
  const canSubmit = name.trim().length > 0 && (phone.trim().length > 0 || instagram.trim().length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/outreach/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, instagram, sector, neighborhood, website, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.duplicate) {
          setError(`Already exists: ${data.duplicate.name}`);
        } else {
          setError(data.error || `Failed (${res.status})`);
        }
        return;
      }
      setSaved({ name: data.prospect.name, qualityLabel: data.prospect.qualityLabel });
      // Auto-close after a beat so the queue refresh kicks in
      setTimeout(() => onSaved(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-16 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--os-border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B00FF] to-[#C026D3] flex items-center justify-center shadow-md shadow-purple-500/20">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#0F172A]">Quick add prospect</h2>
              <div className="text-[11px] text-[#64748B]">Lands in &quot;Never contacted&quot; — start messaging right after</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"><X className="w-4 h-4" /></button>
        </div>

        {saved ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 mx-auto mb-3 flex items-center justify-center shadow-md shadow-emerald-500/30">
              <CheckIcon className="w-6 h-6 text-white" />
            </div>
            <div className="text-[14px] font-semibold text-[#0F172A] mb-1">{saved.name} added</div>
            <div className="text-[12px] text-[#64748B]">
              Classified as <span className={cn(
                "px-1.5 py-0.5 rounded font-bold",
                saved.qualityLabel === "HOT" ? "bg-rose-100 text-rose-700" :
                saved.qualityLabel === "WARM" ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-600"
              )}>{saved.qualityLabel}</span> · refreshing queue...
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            <QField label="Business name *" required>
              <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Restaurant Le Foundouk" className={QINPUT} required />
            </QField>

            <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-[#7C3AED] font-bold mb-2">Contact (need at least one)</div>
              <div className="grid grid-cols-2 gap-2">
                <QField label="Phone">
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className={QINPUT} />
                </QField>
                <QField label="Instagram">
                  <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" className={QINPUT} />
                </QField>
              </div>
              {phone.trim() && (
                <div className="text-[10px] text-[#64748B] mt-1.5">
                  {/^[+]?2?1?2?0?[67]/.test(phone.replace(/\D/g, "")) || /^[67]/.test(phone.replace(/\D/g, ""))
                    ? <span className="text-emerald-700">✓ Mobile — will be HOT, WhatsApp ready</span>
                    : /^[+]?2?1?2?0?5/.test(phone.replace(/\D/g, "")) || /^5/.test(phone.replace(/\D/g, ""))
                    ? <span className="text-amber-700">⚠ Landline (05xx) — will be WARM unless Instagram added</span>
                    : <span className="text-[#94A3B8]">Format will be normalized to +212</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <QField label="Sector">
                <select value={sector} onChange={(e) => setSector(e.target.value)} className={QINPUT}>
                  {SUGGESTED_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </QField>
              <QField label="Neighborhood">
                <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Gueliz" className={QINPUT} />
              </QField>
            </div>

            <details className="text-[12px]">
              <summary className="cursor-pointer text-[#7C3AED] hover:underline">Add website / email (optional)</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <QField label="Website">
                  <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={QINPUT} />
                </QField>
                <QField label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@..." className={QINPUT} />
                </QField>
              </div>
            </details>

            {error && (
              <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9]">Cancel</button>
              <button type="submit" disabled={!canSubmit || saving} className={cn(
                "inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold text-white shadow-md transition-all",
                !canSubmit || saving ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:shadow-lg"
              )}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {saving ? "Adding..." : "Add & ready to message"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const QINPUT = "w-full px-2.5 py-1.5 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300";

function QField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
