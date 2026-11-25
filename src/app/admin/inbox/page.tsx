"use client";

import { useDialog } from "@/components/admin/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Inbox as InboxIcon, MessageSquare, CalendarCheck, FileSignature, Flame, Trophy,
  Loader2, X, ExternalLink, Phone as PhoneIcon, RefreshCw, AlertCircle, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { cn } from "@/lib/utils";
import { REPLY_SNOOZED } from "@/lib/next-action";

/* ---------- Types ---------- */
type InboxItem = {
  id: string; name: string; phone: string; whatsappLink: string; instagram: string;
  sector: string; city: string;
  qualityLabel: string | null; score: number | null;
  status: string;
  followUpDate: string | null;
  latestReplyAt: string | null;
  latestReplyReason: string | null;
  latestReplyBody: string | null;
  latestReplyChannel: string | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
  hasMeeting: boolean; nextMeetingAt: string | null;
  hasProposal: boolean;
  priority: number;
};

type InboxData = { items: InboxItem[]; counts: Record<string, number>; view: string };
type Stats = { unanswered: number; today: number; meetingsWaiting: number; proposalsRequested: number; hotOpportunities: number };

const REASON_BADGE: Record<string, { label: string; color: string }> = {
  MEETING_REQUESTED: { label: "Wants meeting", color: "bg-purple-100 os-dark:bg-purple-500/15 text-purple-700 os-dark:text-purple-300 border-purple-200 os-dark:border-purple-500/30" },
  PROPOSAL_REQUESTED: { label: "Wants proposal", color: "bg-indigo-100 os-dark:bg-indigo-500/15 text-indigo-700 os-dark:text-indigo-300 border-indigo-200 os-dark:border-indigo-500/30" },
  INTERESTED: { label: "Interested", color: "bg-emerald-100 os-dark:bg-emerald-500/15 text-emerald-700 os-dark:text-emerald-300 border-emerald-200 os-dark:border-emerald-500/30" },
  LATER: { label: "Call later", color: "bg-amber-100 os-dark:bg-amber-500/15 text-amber-700 os-dark:text-amber-300 border-amber-200 os-dark:border-amber-500/30" },
  NOT_INTERESTED: { label: "Not interested", color: "bg-gray-100 os-dark:bg-[var(--os-surface-2)] text-[#64748B] os-dark:text-[var(--os-text-soft)] border-gray-200 os-dark:border-[var(--os-border)]" },
  HAS_PROVIDER: { label: "Has provider", color: "bg-blue-100 os-dark:bg-blue-500/15 text-blue-700 os-dark:text-blue-300 border-blue-200 os-dark:border-blue-500/30" },
  TOO_EXPENSIVE: { label: "Too expensive", color: "bg-orange-100 os-dark:bg-orange-500/15 text-orange-700 os-dark:text-orange-300 border-orange-200 os-dark:border-orange-500/30" },
  NO_BUDGET: { label: "No budget", color: "bg-rose-100 os-dark:bg-rose-500/15 text-rose-700 os-dark:text-rose-300 border-rose-200 os-dark:border-rose-500/30" },
};

const VIEWS = [
  { value: "ALL", label: "All replies" },
  { value: "NEW", label: "New (48h)" },
  { value: "MEETING_REQUESTED", label: "Meeting requested" },
  { value: "PROPOSAL_REQUESTED", label: "Proposal requested" },
  { value: "INTERESTED", label: "Interested" },
  { value: "LATER", label: "Call later" },
  { value: "NO_BUDGET", label: "No budget" },
];

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function nextActionFor(item: InboxItem): { label: string; color: string } {
  if (item.status === "CONVERTI" || item.status === "CLIENT") return { label: "✓ Client won", color: "text-[#7C3AED] os-dark:text-[var(--os-purple)] font-semibold" };
  if (item.status === "LOST") return { label: "✗ Lost", color: "text-[#94A3B8] os-dark:text-[var(--os-text-soft)]" };
  if (item.hasMeeting && item.nextMeetingAt) return { label: `Meeting ${relativeDate(item.nextMeetingAt)}`, color: "text-purple-700 os-dark:text-purple-300 font-medium" };
  if (item.latestReplyReason === "MEETING_REQUESTED") return { label: "Book meeting", color: "text-purple-700 os-dark:text-purple-300 font-semibold" };
  if (item.latestReplyReason === "PROPOSAL_REQUESTED") return { label: "Create proposal", color: "text-indigo-700 os-dark:text-indigo-300 font-semibold" };
  if (item.hasProposal) return { label: "Follow up on proposal", color: "text-indigo-700 os-dark:text-indigo-300 font-medium" };
  if (item.latestReplyReason === "INTERESTED") return { label: "Qualify", color: "text-emerald-700 os-dark:text-emerald-300 font-medium" };
  if (item.latestReplyReason === "LATER") return { label: "Schedule callback", color: "text-amber-700 os-dark:text-amber-300 font-medium" };
  return { label: "Reply", color: "text-[#475569] os-dark:text-[var(--os-text)]" };
}

/* ============================================================ */
export default function InboxPage() {
  const [view, setView] = useState("ALL");
  const [data, setData] = useState<InboxData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [meetingFor, setMeetingFor] = useState<InboxItem | null>(null);
  const [callbackFor, setCallbackFor] = useState<InboxItem | null>(null);

  const load = useCallback(async (selectedView: string) => {
    setLoading(true);
    const [d, s] = await Promise.all([
      fetch(`/api/admin/inbox?view=${selectedView}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/inbox/stats").then((r) => r.ok ? r.json() : null),
    ]);
    if (d) setData(d);
    if (s) setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(view); }, [view, load]);

  async function patchProspect(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/prospecting/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load(view);
  }

  async function markWon(item: InboxItem) {
    await patchProspect(item.id, { status: "CONVERTI", actionType: "STATUS_CONVERTI" });
  }
  async function markLost(item: InboxItem) {
    if (!confirm(`Mark ${item.name} as lost?`)) return;
    await patchProspect(item.id, { status: "LOST", actionType: "STATUS_LOST" });
  }

  const viewTabs = useMemo(() => VIEWS.map((v) => ({
    value: v.value,
    label: v.label,
    count: data?.counts ? data.counts[v.value.toLowerCase()] ?? data.counts[v.value] ?? (v.value === "ALL" ? data.counts.all : undefined) : undefined,
  })), [data]);

  return (
    <div>
      <PageHeader
        title="Reply Inbox"
        subtitle="Triage incoming replies into meetings, proposals, and clients."
        actions={
          <button onClick={() => load(view)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--os-border)] bg-[var(--os-surface)] text-[#475569] os-dark:text-[var(--os-text)] hover:bg-gray-50 os-dark:hover:bg-[var(--os-hover)]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* Dashboard cards */}
      <StatCards stats={stats} loading={loading && !stats} />

      {/* View tabs */}
      <div className="mt-5 mb-4">
        <FilterTabs items={viewTabs} active={view} onChange={setView} size="md" scrollable />
      </div>

      {/* Inbox table */}
      {loading && !data ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-10 text-center text-[#64748B] os-dark:text-[var(--os-text-soft)]">
          <InboxIcon className="w-7 h-7 text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mx-auto mb-2" />
          <p className="text-[13px]">No replies match this view.</p>
          <p className="text-[11px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)] mt-1">Log outreach + mark replies in the prospect detail page to populate this inbox.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)] text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium">
                  <th className="text-left px-3 py-2">Prospect</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Sector</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">City</th>
                  <th className="text-left px-3 py-2">Last reply</th>
                  <th className="text-left px-3 py-2">Reason</th>
                  <th className="text-left px-3 py-2 hidden lg:table-cell">Owner</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Next action</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const reason = item.latestReplyReason ? REASON_BADGE[item.latestReplyReason] : null;
                  const next = nextActionFor(item);
                  const hasPhone = !!(item.phone && item.phone.trim());
                  const hasIG = !!(item.instagram && item.instagram.trim());
                  return (
                    <tr key={item.id} className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60 os-dark:hover:bg-[var(--os-hover)]">
                      <td className="px-3 py-2">
                        <Link href={`/admin/prospecting/${item.id}`} className="text-[13px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)] hover:text-[#7C3AED] os-dark:hover:text-[var(--os-purple)]">
                          {item.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">
                          {item.qualityLabel === "HOT" && <span className="text-rose-600 os-dark:text-rose-400 font-bold"><Flame className="w-2.5 h-2.5 inline -mt-0.5" /> HOT</span>}
                          {item.score !== null && <span>· score {item.score}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)] hidden md:table-cell">{item.sector}</td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)] hidden lg:table-cell">{item.city}</td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)]">{relativeDate(item.latestReplyAt)}</td>
                      <td className="px-3 py-2">
                        {reason
                          ? <span className={cn("text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border", reason.color)}>{reason.label}</span>
                          : <span className="text-[10px] text-[#94A3B8] os-dark:text-[var(--os-text-soft)]">untagged</span>}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#475569] os-dark:text-[var(--os-text)] hidden lg:table-cell">{item.owner?.fullName || <span className="text-[#CBD5E1] os-dark:text-[var(--os-text-faint)]">unassigned</span>}</td>
                      <td className={cn("px-3 py-2 text-[12px] hidden md:table-cell", next.color)}>{next.label}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {hasPhone && (
                            <a
                              href={item.whatsappLink || `https://wa.me/${item.phone.replace(/\D/g, "")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 hover:bg-emerald-100 os-dark:hover:bg-emerald-500/15"
                              title="Open WhatsApp"
                            ><FaWhatsapp className="w-3 h-3" /></a>
                          )}
                          {hasIG && (
                            <a
                              href={`https://instagram.com/${item.instagram.replace(/^@/, "")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium bg-purple-50 os-dark:bg-purple-500/10 text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:bg-purple-100 os-dark:hover:bg-purple-500/15"
                              title="Open Instagram"
                            ><FaInstagram className="w-3 h-3" /></a>
                          )}
                          {hasPhone && (
                            <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 hover:bg-amber-100 os-dark:hover:bg-amber-500/15" title={`Call ${item.phone}`}>
                              <PhoneIcon className="w-3 h-3" />
                            </a>
                          )}
                          <div className="w-px h-4 bg-[var(--os-border)] mx-0.5" />
                          <button onClick={() => setMeetingFor(item)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-purple-50 os-dark:bg-purple-500/10 text-purple-700 os-dark:text-purple-300 hover:bg-purple-100 os-dark:hover:bg-purple-500/15" title="Book meeting">
                            <CalendarCheck className="w-3 h-3" /> Meet
                          </button>
                          <button onClick={() => setCallbackFor(item)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 os-dark:bg-amber-500/10 text-amber-700 os-dark:text-amber-300 hover:bg-amber-100 os-dark:hover:bg-amber-500/15" title="Schedule callback">
                            <Clock className="w-3 h-3" /> Callback
                          </button>
                          <Link href={`/admin/proposals/new?prospectId=${item.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 os-dark:bg-indigo-500/10 text-indigo-700 os-dark:text-indigo-300 hover:bg-indigo-100 os-dark:hover:bg-indigo-500/15" title="Create proposal">
                            <FileSignature className="w-3 h-3" /> Proposal
                          </Link>
                          <div className="w-px h-4 bg-[var(--os-border)] mx-0.5" />
                          <button onClick={() => markWon(item)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm hover:shadow" title="Mark won">
                            <Trophy className="w-3 h-3" /> Won
                          </button>
                          <button onClick={() => markLost(item)} className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium text-[#94A3B8] os-dark:text-[var(--os-text-soft)] hover:text-rose-600 os-dark:hover:text-rose-400 hover:bg-rose-50 os-dark:hover:bg-rose-500/10" title="Mark lost">
                            <XCircle className="w-3 h-3" />
                          </button>
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

      {meetingFor && (
        <BookMeetingModal item={meetingFor} onClose={() => setMeetingFor(null)} onCreated={() => { setMeetingFor(null); load(view); }} />
      )}
      {callbackFor && (
        <CallbackModal item={callbackFor} onClose={() => setCallbackFor(null)} onSaved={() => { setCallbackFor(null); load(view); }} />
      )}
    </div>
  );
}

/* ---------- Stat cards ---------- */
function StatCards({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading || !stats) return <div className="os-skeleton h-24 rounded-2xl" />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
      <Card label="Unanswered replies" value={stats.unanswered} icon={<MessageSquare className="w-3.5 h-3.5" />} tone="rose" subtle="needs action" />
      <Card label="Replies today" value={stats.today} icon={<InboxIcon className="w-3.5 h-3.5" />} tone="emerald" subtle="fresh" />
      <Card label="Meetings to book" value={stats.meetingsWaiting} icon={<CalendarCheck className="w-3.5 h-3.5" />} tone="purple" subtle="asked for it" />
      <Card label="Proposals requested" value={stats.proposalsRequested} icon={<FileSignature className="w-3.5 h-3.5" />} tone="indigo" subtle="asked for it" />
      <Card label="Hot opportunities" value={stats.hotOpportunities} icon={<Flame className="w-3.5 h-3.5" />} tone="orange" subtle="in pipeline" highlight />
    </div>
  );
}

function Card({ label, value, icon, tone, subtle, highlight }: { label: string; value: number; icon: React.ReactNode; tone: string; subtle?: string; highlight?: boolean }) {
  const tones: Record<string, string> = {
    rose: "border-rose-200 os-dark:border-rose-500/30 bg-rose-50/40 os-dark:bg-rose-500/10 text-rose-700 os-dark:text-rose-300",
    emerald: "border-emerald-200 os-dark:border-emerald-500/30 bg-emerald-50/40 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300",
    purple: "border-purple-200 os-dark:border-purple-500/30 bg-purple-50/40 os-dark:bg-purple-500/10 text-purple-700 os-dark:text-purple-300",
    indigo: "border-indigo-200 os-dark:border-indigo-500/30 bg-indigo-50/40 os-dark:bg-indigo-500/10 text-indigo-700 os-dark:text-indigo-300",
    orange: "border-orange-200 os-dark:border-orange-500/30 bg-orange-50/40 os-dark:bg-orange-500/10 text-orange-700 os-dark:text-orange-300",
  };
  return (
    <div className={cn("rounded-xl border p-3", tones[tone] || tones.rose, highlight && "shadow-md")}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium mb-1">
        {icon} <span>{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tabular-nums text-[#0F172A] os-dark:text-[var(--os-text)]">{value}</div>
      {subtle && <div className="text-[10px] text-[#64748B] os-dark:text-[var(--os-text-soft)]">{subtle}</div>}
    </div>
  );
}

/* ---------- Book meeting modal ---------- */
function BookMeetingModal({ item, onClose, onCreated }: { item: InboxItem; onClose: () => void; onCreated: () => void }) {
  const defaultDate = new Date(Date.now() + 24 * 3600 * 1000);
  defaultDate.setMinutes(0, 0, 0);
  defaultDate.setHours(14);
  const [title, setTitle] = useState(`Discovery call with ${item.name}`);
  const [startAt, setStartAt] = useState(defaultDate.toISOString().slice(0, 16));
  const [type, setType] = useState("WHATSAPP");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, prospectId: item.id, type,
          startAt: new Date(startAt).toISOString(),
          notes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Failed (${res.status})`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Book meeting" onClose={onClose}>
    <form onSubmit={submit} className="space-y-3">
      <Field label="Title"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} required /></Field>
      <Field label="When"><input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={INPUT} required /></Field>
      <Field label="Channel">
        <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT}>
          <option value="WHATSAPP">WhatsApp call</option>
          <option value="CALL">Phone call</option>
          <option value="GOOGLE_MEET">Google Meet</option>
          <option value="ZOOM">Zoom</option>
          <option value="IN_PERSON">In person</option>
        </select>
      </Field>
      <Field label="Notes (optional)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(INPUT, "h-20 resize-none")} placeholder="What's the agenda?" />
      </Field>
      {error && <div className="text-[12px] text-red-600 os-dark:text-red-400">{error}</div>}
      <ModalButtons onClose={onClose} saving={saving} submitLabel="Book meeting" />
    </form>
  </Modal>;
}

function CallbackModal({ item, onClose, onSaved }: { item: InboxItem; onClose: () => void; onSaved: () => void }) {
  const def = new Date(Date.now() + 24 * 3600 * 1000);
  const [followUpDate, setFollowUpDate] = useState(def.toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/admin/prospecting/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // A callback date on a reply is a recorded decision, so the reply waits until then.
      body: JSON.stringify({ followUpDate, actionType: REPLY_SNOOZED }),
    });
    setSaving(false);
    onSaved();
  }

  return <Modal title="Schedule callback" onClose={onClose}>
    <form onSubmit={submit} className="space-y-3">
      <div className="text-[12px] text-[#475569] os-dark:text-[var(--os-text)]">Set a follow-up date for <span className="font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">{item.name}</span>.</div>
      <Field label="Callback date">
        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={INPUT} required />
      </Field>
      <ModalButtons onClose={onClose} saving={saving} submitLabel="Schedule" />
    </form>
  </Modal>;
}

const INPUT = "w-full px-3 py-2 rounded-lg border border-[var(--os-border)] bg-[var(--os-surface)] text-[13px] text-[#0F172A] os-dark:text-[var(--os-text)] focus:outline-none focus:ring-2 focus:ring-purple-300 os-dark:focus:ring-purple-500/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-[#64748B] os-dark:text-[var(--os-text-soft)] font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Mounted only while shown.
  const { dialogProps, titleId } = useDialog({ open: true, onClose });
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div {...dialogProps} className="relative w-full max-w-md bg-[var(--os-surface)] rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--os-border)]">
          <h2 id={titleId} className="text-[15px] font-semibold text-[#0F172A] os-dark:text-[var(--os-text)]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-[#475569] os-dark:text-[var(--os-text)] hover:text-[#0F172A] os-dark:hover:text-[var(--os-text)] hover:bg-[#F1F5F9] os-dark:hover:bg-[var(--os-hover)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalButtons({ onClose, saving, submitLabel }: { onClose: () => void; saving: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-[13px] font-medium text-[#475569] os-dark:text-[var(--os-text)] hover:bg-[#F1F5F9] os-dark:hover:bg-[var(--os-hover)]">Cancel</button>
      <button type="submit" disabled={saving} className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-white shadow-md",
        saving ? "bg-gray-400" : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:shadow-lg"
      )}>
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
