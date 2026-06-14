"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Target as TargetIcon, RefreshCw, Lock, Unlock, Flame, MessageSquare,
  CalendarCheck, FileSignature, Trophy, Phone as PhoneIcon, Users,
  AlertTriangle, CheckCircle2, ExternalLink, ChevronRight,
} from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */
type SatData = {
  config: { saturationThresholdPct: number; remainingThreshold: number; nextQueueMinScore: number; nextQueueLimit: number };
  metrics: {
    totalProspects: number; hotTotal: number;
    hotContacted: number; hotNotContacted: number;
    hotReplied: number; hotWithMeetings: number; hotWithProposals: number; hotConverted: number;
  };
  saturation: { percentage: number; tier: "RED" | "ORANGE" | "YELLOW" | "GREEN"; unlockedExpansion: boolean; unlockReason: string };
  nextQueue: Array<{
    id: string; name: string; sector: string; neighborhood: string;
    phone: string; whatsappLink: string; instagram: string;
    score: number | null; qualityLabel: string | null;
    owner: { id: string; fullName: string; avatarInitials: string } | null;
    hasMobile: boolean; hasInstagram: boolean;
  }>;
  expansionCities: Array<{
    key: string; label: string; populationK: number;
    discoverable: number; hot: number; mobile: number;
    sectors: string[]; rationale: string; locked: boolean;
  }>;
};

const TIER_TONE: Record<string, { bg: string; border: string; text: string; bar: string; label: string }> = {
  RED:    { bg: "from-rose-50/40 to-red-50/40",          border: "border-rose-300",   text: "text-rose-700",    bar: "from-rose-500 to-red-600",     label: "RED" },
  ORANGE: { bg: "from-orange-50/40 to-amber-50/40",      border: "border-orange-300", text: "text-orange-700",  bar: "from-orange-500 to-amber-500", label: "ORANGE" },
  YELLOW: { bg: "from-amber-50/40 to-yellow-50/40",      border: "border-amber-300",  text: "text-amber-700",   bar: "from-amber-400 to-yellow-500", label: "YELLOW" },
  GREEN:  { bg: "from-emerald-50/40 to-teal-50/40",      border: "border-emerald-300",text: "text-emerald-700", bar: "from-emerald-500 to-teal-500", label: "GREEN" },
};

function fmt(n: number): string {
  return n.toLocaleString();
}

/* ============================================================ */
export default function SaturationPage() {
  const [data, setData] = useState<SatData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/saturation");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markSent(id: string) {
    await fetch(`/api/admin/prospecting/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ENVOYE", actionType: "SENT_WHATSAPP" }),
    });
    load();
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Marrakech Saturation" subtitle="Proof that the city is exhausted before expanding." />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const m = data.metrics;
  const s = data.saturation;
  const tone = TIER_TONE[s.tier];

  return (
    <div>
      <PageHeader
        title="Marrakech Saturation"
        subtitle="Don't switch cities until Marrakech is exhausted."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Saturation gauge */}
      <div className={cn("rounded-2xl border-2 p-5 sm:p-6 bg-gradient-to-br", tone.bg, tone.border)}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0",
            s.tier === "GREEN" ? "bg-emerald-500 shadow-emerald-500/30" :
            s.tier === "YELLOW" ? "bg-amber-500 shadow-amber-500/30" :
            s.tier === "ORANGE" ? "bg-orange-500 shadow-orange-500/30" :
            "bg-rose-600 shadow-rose-600/30"
          )}>
            <TargetIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-[15px] font-semibold text-[#0F172A]">Marrakech HOT saturation</h2>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border", tone.border, tone.text)}>
                {tone.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn("text-5xl sm:text-6xl font-bold tabular-nums", tone.text)}>{s.percentage}%</span>
              <span className="text-[13px] text-[#475569]">of HOT prospects contacted</span>
            </div>
            <div className="text-[12px] text-[#64748B] mt-1">
              <span className="font-semibold text-[#0F172A]">{m.hotContacted}</span> contacted /
              <span className="font-semibold text-[#0F172A]"> {m.hotTotal}</span> HOT total ·
              <span className="font-semibold text-[#0F172A]"> {m.hotNotContacted}</span> remaining
            </div>
            {/* progress bar */}
            <div className="mt-3 h-3 rounded-full bg-white/60 overflow-hidden border border-white">
              <div className={cn("h-full bg-gradient-to-r transition-all", tone.bar)} style={{ width: `${Math.min(100, s.percentage)}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#64748B]">
              <span>0%</span>
              <span className={cn(s.percentage >= 50 && "font-semibold text-orange-700")}>50%</span>
              <span className={cn(s.percentage >= 80 && "font-semibold text-amber-700")}>80%</span>
              <span className={cn(s.percentage >= 95 && "font-semibold text-emerald-700")}>95% gate</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Unlock state */}
        <div className={cn(
          "mt-4 rounded-xl border bg-white p-3 flex items-start gap-3",
          s.unlockedExpansion ? "border-emerald-200" : "border-amber-200"
        )}>
          {s.unlockedExpansion
            ? <Unlock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            : <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
          <div className="flex-1 text-[12px]">
            <div className={cn("font-semibold", s.unlockedExpansion ? "text-emerald-700" : "text-amber-700")}>
              {s.unlockedExpansion ? "Expansion unlocked" : "Expansion locked"}
            </div>
            <div className="text-[#475569]">{s.unlockReason}</div>
          </div>
        </div>
      </div>

      {/* 8 metric cards */}
      <div className="mt-5">
        <h2 className="text-[14px] font-semibold text-[#0F172A] mb-3">Marrakech metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total prospects" value={m.totalProspects} icon={<Users className="w-3.5 h-3.5" />} />
          <Metric label="HOT prospects" value={m.hotTotal} icon={<Flame className="w-3.5 h-3.5" />} tone="rose" />
          <Metric label="HOT contacted" value={m.hotContacted} icon={<MessageSquare className="w-3.5 h-3.5" />} tone="blue" />
          <Metric label="HOT not contacted" value={m.hotNotContacted} icon={<AlertTriangle className="w-3.5 h-3.5" />} tone="amber" subtle={`target < ${data.config.remainingThreshold}`} />
          <Metric label="HOT replied" value={m.hotReplied} icon={<MessageSquare className="w-3.5 h-3.5" />} tone="emerald" />
          <Metric label="HOT with meetings" value={m.hotWithMeetings} icon={<CalendarCheck className="w-3.5 h-3.5" />} tone="purple" />
          <Metric label="HOT with proposals" value={m.hotWithProposals} icon={<FileSignature className="w-3.5 h-3.5" />} tone="indigo" />
          <Metric label="HOT converted" value={m.hotConverted} icon={<Trophy className="w-3.5 h-3.5" />} tone="violet" highlight />
        </div>
      </div>

      {/* Funnel viz */}
      <div className="mt-5 rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
        <h2 className="text-[14px] font-semibold text-[#0F172A] mb-3">HOT funnel</h2>
        <FunnelRow label="HOT total" value={m.hotTotal} max={m.hotTotal || 1} tone="rose" />
        <FunnelRow label="Contacted" value={m.hotContacted} max={m.hotTotal || 1} tone="blue" />
        <FunnelRow label="Replied" value={m.hotReplied} max={m.hotTotal || 1} tone="emerald" />
        <FunnelRow label="Meeting" value={m.hotWithMeetings} max={m.hotTotal || 1} tone="purple" />
        <FunnelRow label="Proposal" value={m.hotWithProposals} max={m.hotTotal || 1} tone="indigo" />
        <FunnelRow label="Converted" value={m.hotConverted} max={m.hotTotal || 1} tone="violet" />
      </div>

      {/* Next Marrakech Prospects */}
      <NextQueueSection queue={data.nextQueue} minScore={data.config.nextQueueMinScore} onMarkSent={markSent} />

      {/* Expansion cities */}
      <ExpansionSection cities={data.expansionCities} unlocked={s.unlockedExpansion} />
    </div>
  );
}

/* ============================================================ */
function Metric({ label, value, icon, tone = "default", subtle, highlight }: { label: string; value: number; icon: React.ReactNode; tone?: string; subtle?: string; highlight?: boolean }) {
  const tones: Record<string, string> = {
    default: "text-[#0F172A] border-[var(--os-border)]",
    rose:    "text-rose-700 border-rose-200",
    blue:    "text-blue-700 border-blue-200",
    amber:   "text-amber-700 border-amber-200",
    emerald: "text-emerald-700 border-emerald-200",
    purple:  "text-purple-700 border-purple-200",
    indigo:  "text-indigo-700 border-indigo-200",
    violet:  "text-[#8B00FF] border-purple-300",
  };
  return (
    <div className={cn("rounded-2xl border bg-white p-4", tones[tone] || tones.default, highlight && "shadow-md shadow-purple-500/10")}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">
        <span className={tones[tone]?.split(" ")[0] || "text-[#475569]"}>{icon}</span>
        {label}
      </div>
      <div className={cn("text-2xl sm:text-3xl font-bold tabular-nums", tones[tone]?.split(" ")[0] || "text-[#0F172A]")}>{fmt(value)}</div>
      {subtle && <div className="text-[10px] text-[#94A3B8] mt-0.5">{subtle}</div>}
    </div>
  );
}

function FunnelRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const tones: Record<string, string> = {
    rose: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    purple: "bg-purple-100 text-purple-700",
    indigo: "bg-indigo-100 text-indigo-700",
    violet: "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white",
  };
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-1.5 last:mb-0">
      <span className="text-[11px] text-[#64748B] w-24 shrink-0">{label}</span>
      <div className="flex-1 h-7 rounded-md bg-gray-50 overflow-hidden relative">
        <div className={cn("h-full flex items-center px-2 text-[12px] font-bold transition-all", tones[tone])} style={{ width: `${Math.max(8, pct)}%` }}>
          {fmt(value)}
        </div>
      </div>
      <span className="text-[11px] text-[#64748B] w-12 text-right tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

/* ============================================================ */
function NextQueueSection({ queue, minScore, onMarkSent }: { queue: SatData["nextQueue"]; minScore: number; onMarkSent: (id: string) => void }) {
  return (
    <div className="mt-5">
      <h2 className="text-[14px] font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
        <Flame className="w-4 h-4 text-rose-600" /> Next Marrakech Prospects · {queue.length}
      </h2>
      <p className="text-[11px] text-[#64748B] mb-3">
        HOT · never contacted · mobile or Instagram · score &gt; {minScore}. The list to clear before considering expansion.
      </p>
      {queue.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
          <div className="text-[14px] font-semibold text-[#0F172A]">No prospects match these criteria</div>
          <div className="text-[12px] text-[#64748B] mt-1">Either you've contacted them all (great), or the threshold (score &gt; {minScore}) is too tight. Loosen via the API config to widen the pool.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                <tr>
                  <th className="text-left px-3 py-2">Prospect</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Sector</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Neighborhood</th>
                  <th className="text-right px-3 py-2">Score</th>
                  <th className="text-center px-3 py-2">Channels</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((p, i) => {
                  const wa = p.whatsappLink || (p.phone ? `https://wa.me/${p.phone.replace(/\D/g, "")}` : "");
                  const ig = p.instagram ? `https://instagram.com/${p.instagram.replace(/^@/, "")}` : "";
                  return (
                    <tr key={p.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[#94A3B8] tabular-nums w-5">{i + 1}.</span>
                          <Link href={`/admin/prospecting/${p.id}`} className="text-[13px] font-medium text-[#0F172A] hover:text-[#7C3AED]">{p.name}</Link>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] hidden md:table-cell">{p.sector}</td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] hidden lg:table-cell">{p.neighborhood || "—"}</td>
                      <td className="px-3 py-2 text-right text-[13px] font-bold text-[#7C3AED] tabular-nums">{p.score ?? 0}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          {p.hasMobile && <span title={p.phone} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">📱 mobile</span>}
                          {p.hasInstagram && <span title={p.instagram} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-[#7C3AED] font-medium">📷 IG</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {p.hasMobile && (
                            <a
                              href={wa} target="_blank" rel="noopener noreferrer"
                              onClick={() => onMarkSent(p.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500 text-white shadow-sm hover:shadow"
                            ><FaWhatsapp className="w-3 h-3" /> WA</a>
                          )}
                          {p.hasInstagram && (
                            <a
                              href={ig} target="_blank" rel="noopener noreferrer"
                              onClick={() => onMarkSent(p.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm hover:shadow"
                            ><FaInstagram className="w-3 h-3" /> IG</a>
                          )}
                          {p.phone && (
                            <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100">
                              <PhoneIcon className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
function ExpansionSection({ cities, unlocked }: { cities: SatData["expansionCities"]; unlocked: boolean }) {
  return (
    <div className="mt-6">
      <h2 className="text-[14px] font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
        {unlocked ? <Unlock className="w-4 h-4 text-emerald-600" /> : <Lock className="w-4 h-4 text-amber-600" />}
        Next-city expansion {unlocked ? "(unlocked)" : "(locked)"}
      </h2>
      <p className="text-[11px] text-[#64748B] mb-3">
        {unlocked
          ? "Marrakech is saturated. Pick a city below to start the next sweep."
          : "These stay grayed out until Marrakech is exhausted. Estimates shown so you can plan ahead, but no Discovery sweeps recommended yet."}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cities.map((c, i) => (
          <div key={c.key} className={cn(
            "rounded-2xl border-2 p-4 transition-all",
            c.locked
              ? "border-gray-200 bg-gray-50/40 opacity-70"
              : i === 0
                ? "border-emerald-300 bg-gradient-to-br from-emerald-50/40 to-teal-50/40 shadow-md"
                : "border-[var(--os-border)] bg-white"
          )}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center justify-center w-7 h-7 rounded-lg text-[12px] font-bold",
                  i === 0 && !c.locked ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white" :
                  c.locked ? "bg-gray-200 text-[#94A3B8]" :
                  "bg-purple-100 text-[#7C3AED]"
                )}>{i + 1}</span>
                <span className="text-[15px] font-semibold text-[#0F172A]">{c.label}</span>
                <span className="text-[11px] text-[#94A3B8]">{c.populationK}k pop</span>
              </div>
              {c.locked
                ? <span className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8] bg-gray-100 px-2 py-0.5 rounded">Locked</span>
                : <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Available</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <CityStat label="Discoverable" value={c.discoverable} dim={c.locked} />
              <CityStat label="Est. HOT" value={c.hot} tone="rose" dim={c.locked} />
              <CityStat label="Mobile / WA" value={c.mobile} tone="emerald" dim={c.locked} />
            </div>

            <div className="text-[11.5px] text-[#475569] mb-2 leading-snug">{c.rationale}</div>

            <div className="flex flex-wrap gap-1 mb-3">
              {c.sectors.map((s) => (
                <span key={s} className={cn("text-[10px] px-1.5 py-0.5 rounded border",
                  c.locked ? "bg-gray-50 text-[#94A3B8] border-gray-200" : "bg-purple-50 text-[#7C3AED] border-purple-100"
                )}>{s}</span>
              ))}
            </div>

            {c.locked ? (
              <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gray-100 text-[#94A3B8] cursor-not-allowed w-full justify-center">
                <Lock className="w-3.5 h-3.5" /> Exhaust Marrakech first
              </button>
            ) : (
              <Link
                href={`/admin/prospect-discovery?city=${c.key}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md hover:shadow-lg w-full justify-center"
              >
                Start {c.label} sweep <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CityStat({ label, value, tone, dim }: { label: string; value: number; tone?: string; dim?: boolean }) {
  const tones: Record<string, string> = {
    rose: "text-rose-700",
    emerald: "text-emerald-700",
  };
  return (
    <div className="rounded-lg border border-[var(--os-border)] bg-white p-2 text-center">
      <div className="text-[9px] uppercase tracking-wider text-[#64748B] font-medium">{label}</div>
      <div className={cn("text-base font-bold tabular-nums", dim ? "text-[#94A3B8]" : (tones[tone || ""] || "text-[#0F172A]"))}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </div>
    </div>
  );
}
