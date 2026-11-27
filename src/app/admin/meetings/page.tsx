"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar, Plus, Phone, Video, MapPin, AlertCircle,
  CheckCircle2, XCircle, Clock, Sun, List, CalendarDays,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { ScheduleMeetingModal } from "@/components/admin/schedule-meeting-modal";
import { MeetingsCalendar } from "@/components/admin/meetings-calendar";
import { cn } from "@/lib/utils";

type Meeting = {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string | null;
  outcome: string;
  nextAction: string;
  notes: string;
  client: { id: string; companyName: string } | null;
  prospect: { id: string; name: string; sector: string } | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
};

type Scope = "today" | "tomorrow" | "week" | "upcoming" | "missed" | "mine" | "all";
type ViewMode = "list" | "calendar";

const SCOPE_DEFS: { value: Scope; label: string }[] = [
  { value: "today",    label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week",     label: "This week" },
  { value: "upcoming", label: "Upcoming" },
  { value: "missed",   label: "Missed" },
  { value: "mine",     label: "Mine" },
  { value: "all",      label: "All" },
];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, GOOGLE_MEET: Video, ZOOM: Video, WHATSAPP: FaWhatsapp, IN_PERSON: MapPin,
};
const TYPE_LABEL: Record<string, string> = {
  CALL: "Call", GOOGLE_MEET: "Google Meet", ZOOM: "Zoom", WHATSAPP: "WhatsApp", IN_PERSON: "In person",
};
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 os-dark:bg-blue-500/10 text-blue-700 os-dark:text-blue-300 border-blue-100 os-dark:border-blue-500/30",
  COMPLETED: "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border-emerald-100 os-dark:border-emerald-500/30",
  CANCELLED: "bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] text-[#6B7280] os-dark:text-[var(--os-text)] border-[var(--os-border)]",
  NO_SHOW:   "bg-red-50 os-dark:bg-red-500/10 text-red-700 os-dark:text-red-300 border-red-100 os-dark:border-red-500/30",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function fmtDayHeader(d: Date) {
  const today = startOfDay(new Date());
  const item = startOfDay(d);
  const diff = Math.round((item.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [counts, setCounts] = useState<{ today: number; tomorrow: number; week: number; upcoming: number; missed: number; mine: number; all: number } | null>(null);
  const [scope, setScope] = useState<Scope>("today");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  const load = useCallback(async (s: Scope) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/meetings?scope=${s}&limit=500`);
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (res.ok) setMeetings(await res.json());
    } catch (e) {
      console.warn("[meetings] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(scope); }, [scope, load]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/meetings?scope=today&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=tomorrow&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=week&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=upcoming&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=missed&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?scope=mine&limit=500").then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/meetings?limit=500").then((r) => r.ok ? r.json() : []),
    ]).then(([today, tomorrow, week, upcoming, missed, mine, all]) => {
      setCounts({
        today: today.length, tomorrow: tomorrow.length, week: week.length,
        upcoming: upcoming.length, missed: missed.length, mine: mine.length, all: all.length,
      });
    }).catch(() => {});
  }, [meetings.length]);

  const tabs = useMemo(() => SCOPE_DEFS.map((d) => ({
    value: d.value, label: d.label, count: counts ? counts[d.value] : undefined,
  })), [counts]);

  const grouped = useMemo(() => {
    const groups: { day: string; date: string; items: Meeting[] }[] = [];
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const d = startOfDay(new Date(m.startAt));
      const key = d.toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    Array.from(map.entries())
      .sort(([a], [b]) => (scope === "missed" ? b.localeCompare(a) : a.localeCompare(b)))
      .forEach(([key, items]) => {
        groups.push({ day: fmtDayHeader(new Date(key)), date: key, items });
      });
    return groups;
  }, [meetings, scope]);

  async function updateStatus(m: Meeting, status: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "SCHEDULED") {
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status } : x)));
    await fetch(`/api/admin/meetings/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle="Calls, demos and on-site visits across the agency"
        actions={
          <>
            {/* View toggle */}
            <div className="inline-flex items-center rounded-lg border border-[var(--os-border)] bg-[#F9FAFB] os-dark:bg-[var(--os-surface-2)] p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                  view === "list"
                    ? "bg-[var(--os-surface)] text-[var(--os-text)] shadow-sm"
                    : "text-[var(--os-text-soft)] hover:text-[var(--os-text)]"
                )}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                  view === "calendar"
                    ? "bg-[var(--os-surface)] text-[var(--os-text)] shadow-sm"
                    : "text-[var(--os-text-soft)] hover:text-[var(--os-text)]"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 os-btn-primary rounded-lg text-[13px] font-semibold transition-all"
            >
              <Plus className="w-4 h-4" /> New meeting
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={counts?.today ?? 0}    label="Today"          icon={<Sun className="w-5 h-5" />} accent index={0} />
        <StatCard value={counts?.upcoming ?? 0} label="Upcoming"       icon={<Clock className="w-5 h-5" />} index={1} />
        <StatCard value={counts?.missed ?? 0}   label="Missed"         icon={<AlertCircle className="w-5 h-5" />} index={2} />
        <StatCard value={counts?.mine ?? 0}     label="Mine this week" icon={<Calendar className="w-5 h-5" />} index={3} />
      </div>

      {view === "calendar" ? (
        <MeetingsCalendar onStatusChange={updateStatus} />
      ) : (
        <>
          <div className="mb-4">
            <FilterTabs items={tabs} active={scope} onChange={(v) => setScope(v as Scope)} />
          </div>

          {loading ? (
            <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}</div>
          ) : grouped.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-7 h-7" />}
              title="No meetings in this view"
              description="Schedule a meeting from a prospect or client to get started."
              action={
                <button
                  onClick={() => setModal(true)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[13px] font-semibold"
                >
                  <Plus className="w-4 h-4" /> New meeting
                </button>
              }
            />
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => (
                <section key={g.date}>
                  <h3 className="text-[11px] font-semibold text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] uppercase tracking-wider mb-2 px-1">{g.day}</h3>
                  <div className="bg-[var(--os-surface)] border border-[var(--os-border)] rounded-xl divide-y divide-[#F3F4F6] os-dark:divide-[var(--os-border)] overflow-hidden">
                    {g.items.map((m) => <MeetingRow key={m.id} m={m} onStatus={updateStatus} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <ScheduleMeetingModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={() => { setModal(false); load(scope); }}
        context={{ kind: "free" }}
      />
    </div>
  );
}

function MeetingRow({ m, onStatus }: { m: Meeting; onStatus: (m: Meeting, s: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "SCHEDULED") => void }) {
  const start = new Date(m.startAt);
  const TypeIcon = TYPE_ICON[m.type] ?? Phone;
  const linkedHref = m.client ? `/admin/clients/${m.client.id}` : m.prospect ? `/admin/prospecting/${m.prospect.id}` : null;
  const linkedLabel = m.client?.companyName ?? m.prospect?.name ?? "—";
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--os-surface-2)] group">
      <div className="text-center w-16 shrink-0">
        <p className="text-[14px] font-semibold text-[#111827] os-dark:text-[var(--os-text)] leading-none">{fmtTime(start)}</p>
        {m.endAt && <p className="text-[10px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] mt-1">{fmtTime(new Date(m.endAt))}</p>}
      </div>
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] text-[var(--os-text-muted)] shrink-0">
        <TypeIcon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#111827] os-dark:text-[var(--os-text)] truncate">{m.title}</p>
        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)] mt-0.5">
          {linkedHref ? (
            <Link href={linkedHref} className="hover:text-[var(--os-brand)] truncate max-w-[200px]">
              {linkedLabel}
            </Link>
          ) : (
            <span className="text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">{linkedLabel}</span>
          )}
          <span>·</span>
          <span>{TYPE_LABEL[m.type] ?? m.type}</span>
          {m.owner && (<><span>·</span><span>{m.owner.fullName}</span></>)}
        </div>
      </div>
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0", STATUS_STYLES[m.status] ?? STATUS_STYLES.SCHEDULED)}>
        {m.status.replace("_", " ")}
      </span>
      {m.status === "SCHEDULED" && (
        <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onStatus(m, "COMPLETED")} title="Mark completed" className="p-1.5 rounded-md text-emerald-600 os-dark:text-emerald-400 hover:bg-emerald-50 os-dark:hover:bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button onClick={() => onStatus(m, "NO_SHOW")} title="Mark no-show" className="p-1.5 rounded-md text-red-600 os-dark:text-red-400 hover:bg-red-50 os-dark:hover:bg-red-500/10">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
