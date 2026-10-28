"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Reply, CalendarClock, Inbox, Calendar, Send, ShieldCheck, ShieldAlert, FileQuestion, History } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { cn } from "@/lib/utils";
import { STAGES, stageStatusParam, type StageKey } from "@/lib/prospect-stages";

// TODAY — the admin home. One question: what should I do right now?
// The previous all-metrics dashboard lives on, unchanged, at /admin/overview.

type ProspectRow = { id: string; name: string; sector: string; followUpDate: string | null; lastActionAt: string | null };

type Today = {
  enquiries: { new: number; latest: { id: string; fullName: string; subject: string; createdAt: string }[]; markedTest: number };
  replies: { count: number; list: ProspectRow[] };
  followUps: {
    dueToday: number; overdue: number; list: ProspectRow[];
    recorded: { dueToday: number; overdue: number };
    /** Not backed by a send since the July 2026 cleanup: old send records only, or none. */
    unbacked: { dueToday: number; overdue: number; legacy: number };
  };
  readyToContact: { verified: number; unverified: number };
  meetingsToday: { id: string; title: string; type: string; startAt: string; client: { companyName: string } | null; prospect: { id: string; name: string } | null }[];
  stages: Record<StageKey, number> & { other: number };
  outreach: { contacted: number; sendRecorded: number; legacySendOnly: number; noSendRecord: number; channelVerified: number };
};

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function daysLate(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff < 0) return `${-diff}d late`;
  return diff === 0 ? "today" : shortDate(iso);
}

function ActionCard({
  title, count, href, icon, tone, empty, children,
}: {
  title: string; count: number; href: string; icon: React.ReactNode;
  tone: "green" | "amber" | "blue" | "purple"; empty: string; children?: React.ReactNode;
}) {
  const tones = {
    green:  "bg-emerald-50 text-emerald-600",
    amber:  "bg-amber-50 text-amber-600",
    blue:   "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-[#8B00FF]",
  };
  return (
    <GlassCard padding="lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", tones[tone])}>{icon}</div>
          <div>
            <div className="text-2xl font-bold text-[#0F172A] tabular-nums">{count}</div>
            <div className="text-xs text-[#64748B]">{title}</div>
          </div>
        </div>
        <Link href={href} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
          Open <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {count === 0 ? <p className="text-[12px] text-[#9CA3AF] py-2">{empty}</p> : children}
    </GlassCard>
  );
}

function RowList({ rows }: { rows: { key: string; href: string; primary: string; secondary: string }[] }) {
  return (
    <ul className="space-y-0.5">
      {rows.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className="flex items-center justify-between gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-[#1E293B] truncate">{r.primary}</span>
            <span className="text-[11px] text-[#94A3B8] shrink-0">{r.secondary}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function TodayPage() {
  const router = useRouter();
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/today")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setError(true));
  }, [router]);

  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  if (error) {
    return (
      <div>
        <PageHeader title="Today" subtitle={dateLabel} />
        <GlassCard padding="lg"><p className="text-sm text-[#64748B]">Could not load today&apos;s summary. Refresh to try again.</p></GlassCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Today" subtitle={dateLabel} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const fuRecorded = data.followUps.recorded;
  const fuUnbacked = data.followUps.unbacked;
  const recordedTotal = fuRecorded.dueToday + fuRecorded.overdue;
  const unbackedTotal = fuUnbacked.dueToday + fuUnbacked.overdue;
  const unbackedNone = unbackedTotal - fuUnbacked.legacy;

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={dateLabel}
        actions={
          <Link href="/admin/overview" className="text-xs text-[#64748B] hover:text-[#0F172A] flex items-center gap-1">
            Full dashboard <ArrowRight className="w-3 h-3" />
          </Link>
        }
      />

      {/* 1. Do these first */}
      <h2 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] mb-3">Do these first</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard title="Replies waiting for you" count={data.replies.count} href="/admin/prospecting?status=REPONDU"
          icon={<Reply className="w-5 h-5" />} tone="green" empty="No one is waiting on a reply.">
          <RowList rows={data.replies.list.map((p) => ({ key: p.id, href: `/admin/prospecting/${p.id}`, primary: p.name, secondary: p.sector }))} />
        </ActionCard>

        <ActionCard title={fuRecorded.overdue > 0 ? `Follow-ups after a recorded send · ${fuRecorded.overdue} late` : "Follow-ups after a recorded send"}
          count={recordedTotal}
          href={fuRecorded.overdue > 0 ? "/admin/prospecting?due=overdue&evidence=recorded" : "/admin/prospecting?due=today&evidence=recorded"}
          icon={<CalendarClock className="w-5 h-5" />} tone="amber" empty="No follow-ups due after a recorded send.">
          <RowList rows={data.followUps.list.map((p) => ({ key: p.id, href: `/admin/prospecting/${p.id}`, primary: p.name, secondary: daysLate(p.followUpDate) }))} />
        </ActionCard>

        <ActionCard title="New website enquiries" count={data.enquiries.new} href="/admin/leads?status=NEW"
          icon={<Inbox className="w-5 h-5" />} tone="blue"
          empty={data.enquiries.markedTest > 0
            ? `No new enquiries. ${data.enquiries.markedTest} marked as internal test${data.enquiries.markedTest === 1 ? "" : "s"} ${data.enquiries.markedTest === 1 ? "is" : "are"} not counted.`
            : "No new enquiries."}>
          <RowList rows={data.enquiries.latest.map((l) => ({ key: l.id, href: `/admin/leads/${l.id}`, primary: l.fullName, secondary: shortDate(l.createdAt) }))} />
          {/* Nothing guesses which enquiries are tests; only ones marked "Internal test" by hand are left out. */}
          <p className="text-[11px] text-[#94A3B8] mt-2">
            If one of these is an internal test, open it and set its status to &ldquo;Internal test&rdquo; to stop counting it.
            {data.enquiries.markedTest > 0 && <> {data.enquiries.markedTest} already marked as internal test{data.enquiries.markedTest === 1 ? "" : "s"} {data.enquiries.markedTest === 1 ? "is" : "are"} not counted.</>}
          </p>
        </ActionCard>

        <ActionCard title="Meetings today" count={data.meetingsToday.length} href="/admin/meetings?scope=today"
          icon={<Calendar className="w-5 h-5" />} tone="purple" empty="No meetings today.">
          <RowList rows={data.meetingsToday.map((m) => ({
            key: m.id, href: "/admin/meetings?scope=today",
            primary: `${m.title}${m.client?.companyName ?? m.prospect?.name ? ` · ${m.client?.companyName ?? m.prospect?.name}` : ""}`,
            secondary: new Date(m.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          }))} />
        </ActionCard>
      </div>

      {/* Follow-up dates without current evidence — shown, never presented as confirmed work */}
      {unbackedTotal > 0 && (
        <Link href={fuUnbacked.overdue > 0 ? "/admin/prospecting?due=overdue&evidence=unbacked" : "/admin/prospecting?due=today&evidence=unbacked"}
          className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-[var(--os-border)] bg-white/40 px-5 py-4 hover:border-[#CBD5E1] hover:bg-white transition-colors">
          <History className="w-4 h-4 text-[#94A3B8] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] text-[#475569]">
              <span className="font-semibold text-[#0F172A] tabular-nums">{unbackedTotal}</span> historical follow-up date{unbackedTotal === 1 ? "" : "s"}
              {fuUnbacked.overdue > 0 && <> ({fuUnbacked.overdue} past due)</>} — not enough evidence to act on as follow-ups
            </div>
            <p className="text-[12px] text-[#94A3B8] mt-0.5">
              {fuUnbacked.legacy > 0 && <>{fuUnbacked.legacy} only have send records from before the 7 July 2026 cleanup, when send buttons opened unconfirmed WhatsApp links. </>}
              {unbackedNone > 0 && <>{unbackedNone} have no send record at all. </>}
              The first message may never have arrived, so treat these as prospects to re-check, not overdue follow-ups.
            </p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] ml-auto mt-1 shrink-0" />
        </Link>
      )}

      {/* 2. Ready to contact */}
      <h2 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] mt-8 mb-3">Ready to contact</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/prospecting?status=A_ENVOYER&channel=verified" className="group rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-5 hover:border-emerald-200 transition-colors">
          <div className="flex items-center gap-2 text-emerald-700 text-[13px] font-medium"><ShieldCheck className="w-4 h-4" /> Channel verified</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">{data.readyToContact.verified}</div>
          <p className="text-[12px] text-[#64748B] mt-1">Not contacted yet, with a confirmed WhatsApp or Instagram.</p>
        </Link>
        <Link href="/admin/prospecting?status=A_ENVOYER&channel=unverified" className="group rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-5 hover:border-amber-200 transition-colors">
          <div className="flex items-center gap-2 text-amber-700 text-[13px] font-medium"><ShieldAlert className="w-4 h-4" /> Channel unverified</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">{data.readyToContact.unverified}</div>
          <p className="text-[12px] text-[#64748B] mt-1">Not contacted yet, and no channel confirmed. Confirm WhatsApp or Instagram before sending.</p>
        </Link>
      </div>

      {/* 3. Where prospects are */}
      <h2 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] mt-8 mb-3">Where your prospects are</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAGES.map((s) => (
          <Link key={s.key} href={`/admin/prospecting?status=${stageStatusParam(s)}`} title={s.hint}
            className="rounded-xl border border-[var(--os-border)] bg-white/60 px-3 py-2.5 hover:border-[#CBD5E1] hover:bg-white transition-all">
            <Badge variant={s.badge} size="sm" dot>{s.label}</Badge>
            <div className="text-[18px] font-semibold text-[#0F172A] tabular-nums mt-1.5">{data.stages[s.key]}</div>
          </Link>
        ))}
      </div>
      {data.stages.other > 0 && (
        <p className="text-[11px] text-[#94A3B8] mt-2">{data.stages.other} prospect(s) have a status outside these stages and are not counted above.</p>
      )}

      {/* 4. Outreach evidence — two separate facts, never combined */}
      <h2 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] mt-8 mb-3">Outreach so far</h2>
      <GlassCard padding="lg">
        <p className="text-[13px] text-[#475569]">
          <span className="font-semibold text-[#0F172A] tabular-nums">{data.outreach.contacted}</span> prospects are marked as contacted.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] mb-2">Outreach recorded</div>
            <Link href="/admin/prospecting?evidence=recorded" className="flex items-center gap-2 py-1 group">
              <Send className="w-4 h-4 text-blue-600" />
              <span className="text-[13px] text-[#475569] group-hover:text-[#0F172A]">Send recorded</span>
              <span className="text-[15px] font-semibold text-[#0F172A] tabular-nums ml-auto">{data.outreach.sendRecorded}</span>
            </Link>
            <Link href="/admin/prospecting?evidence=legacy" className="flex items-center gap-2 py-1 group">
              <History className="w-4 h-4 text-[#94A3B8]" />
              <span className="text-[13px] text-[#475569] group-hover:text-[#0F172A]">Old send, unconfirmed</span>
              <span className="text-[15px] font-semibold text-[#0F172A] tabular-nums ml-auto">{data.outreach.legacySendOnly}</span>
            </Link>
            <Link href="/admin/prospecting?evidence=none" className="flex items-center gap-2 py-1 group">
              <FileQuestion className="w-4 h-4 text-amber-600" />
              <span className="text-[13px] text-[#475569] group-hover:text-[#0F172A]">No send record</span>
              <span className="text-[15px] font-semibold text-[#0F172A] tabular-nums ml-auto">{data.outreach.noSendRecord}</span>
            </Link>
            <p className="text-[11px] text-[#94A3B8] mt-2">
              &ldquo;Send recorded&rdquo; means the app logged a send button or saved message since the 7 July 2026 cleanup. It does not confirm delivery.
              &ldquo;Old send&rdquo; records predate the cleanup and are not treated as evidence.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] mb-2">Contact channel</div>
            <div className="flex items-center gap-2 py-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-[13px] text-[#475569]">Channel verified</span>
              <span className="text-[15px] font-semibold text-[#0F172A] tabular-nums ml-auto">{data.outreach.channelVerified}</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <ShieldAlert className="w-4 h-4 text-[#94A3B8]" />
              <span className="text-[13px] text-[#475569]">Channel unverified</span>
              <span className="text-[15px] font-semibold text-[#0F172A] tabular-nums ml-auto">{data.outreach.contacted - data.outreach.channelVerified}</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-2">
              A verified channel means a WhatsApp or Instagram was confirmed by hand. It does not show that a message was sent.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
