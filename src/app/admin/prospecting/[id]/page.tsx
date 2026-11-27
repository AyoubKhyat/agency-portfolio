"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlinePhone } from "react-icons/hi2";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import AvatarChip from "@/components/AvatarChip";
import { PlaybookPanel } from "./PlaybookPanel";
import { ContactCheck } from "@/components/admin/contact-check";
import { evidenceForSaved, sourceText, type ContactEvidence } from "@/lib/contact-evidence";
import { OutreachDraftPanel } from "@/components/admin/outreach-draft-panel";
import { CONTACT_CHECK_LABELS, lastContactCheck, type ContactCheckStatus } from "@/lib/contact-check";
import {
  CONFIRMED_SEND_SINCE, REPLY_LABELS, VISIBLE_SEND_LABELS, contactSummary, detailActionHref, displayStageOf, getDisplayGroupByKey,
  showsSendEvidence, type RowSummary, type VisibleSendEvidence,
} from "@/lib/prospect-groups";

// The detailed status control (Advanced). Same values and PATCH as before.
const STATUSES = ["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"];
const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "To Send", ENVOYE: "Sent", REPONDU: "Replied", PAS_DE_WHATSAPP: "No WhatsApp", CONVERTI: "Converted",
  MEETING: "Meeting", PROPOSAL_SENT: "Proposal sent", NEGOTIATION: "Negotiation", CLIENT: "Client", LOST: "Lost", PERDU: "Lost (old)", REFUSE: "Refused (old)",
};
const PRIORITY_LABELS: Record<number, string> = { 1: "Instagram sans site", 2: "Sans site", 3: "A un site" };
const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect", ASSIGNED: "assigned prospect", SENT_WHATSAPP: "sent WhatsApp", SENT_INSTAGRAM: "sent Instagram DM",
  FOLLOW_UP: "sent follow-up", MARKED_REPLIED: "marked as replied", MARKED_NO_WHATSAPP: "marked no WhatsApp",
  STATUS_ENVOYE: "changed status to Sent", STATUS_REPONDU: "marked as replied", STATUS_CONVERTI: "converted to lead",
  NOTE_ADDED: "added a note", UPDATED: "updated details",
  REPLY_SNOOZED: "chose a date to come back to the reply", REPLY_REVIEWED: "checked a possible old reply", NO_MORE_FOLLOW_UP: "stopped follow-ups",
  ...CONTACT_CHECK_LABELS,
};
const REASON_LABELS: Record<string, string> = {
  INTERESTED: "Interested", MEETING_REQUESTED: "Wants a meeting", PROPOSAL_REQUESTED: "Wants a proposal", LATER: "Asked to call later",
  NOT_INTERESTED: "Not interested", HAS_PROVIDER: "Has a provider", TOO_EXPENSIVE: "Too expensive", NO_BUDGET: "No budget",
};

type Note = { id: string; content: string; createdAt: string };
type Activity = { id: string; userId: string; userName: string; actionType: string; previousStatus: string | null; newStatus: string | null; details: string | null; createdAt: string };
type Owner = { id: string; fullName: string; avatarInitials: string };
type TeamUser = { id: string; fullName: string; avatarInitials: string };
type SentBy = { id: string; fullName: string; avatarInitials: string } | null;
type Message = { id: string; channel: string; body: string; sentAt: string; replied: boolean; repliedAt: string | null; replyReason: string | null };
type Prospect = {
  id: string; name: string; phone: string; whatsappLink: string; sector: string; neighborhood: string; instagram: string;
  hasWebsite: boolean; website?: string; whatsappStatus: string; instagramStatus: string;
  priority: number; status: string; sentAt: string | null; createdAt: string; owner: Owner | null;
  sentByUser: SentBy; sentByName: string | null;
  contactedByName: string | null; contactedAt: string | null; lastActionByName: string | null; lastActionAt: string | null;
  notes: Note[]; activities: Activity[];
  score?: number | null; scoreLabel?: "HIGH" | "MEDIUM" | "LOW" | null;
  /** Read-only extras from the GET route (prospect-groups rules). Absent if they couldn't be worked out. */
  summary?: RowSummary | null; sendEvidence?: VisibleSendEvidence; lastConfirmedSendDay?: string | null;
  /** Public contact evidence from the Today lead this prospect was imported from (null: none). */
  contactEvidence?: ContactEvidence | null;
};

const fmt = (d: string, withTime = false) =>
  new Date(d).toLocaleDateString("fr-FR", withTime ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });

const card = "bg-[var(--os-surface)] rounded-2xl border border-gray-100 os-dark:border-[var(--os-border)] p-5 mb-4 scroll-mt-20";
const h2 = "text-[15px] font-semibold text-gray-900 os-dark:text-[var(--os-text)]";
const label = "text-[11px] text-gray-400 os-dark:text-[var(--os-text-faint)] uppercase tracking-wide mb-1";

export default function ProspectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);

  useEffect(() => {
    fetch(`/api/admin/prospecting/${id}`).then((r) => {
      if (r.status === 401) { router.push("/admin/login"); return null; }
      if (r.status === 404) { router.push("/admin/prospecting"); return null; }
      return r.json();
    }).then((data) => { if (data) setProspect(data); setLoading(false); });
    fetch(`/api/admin/prospecting/${id}/outreach`).then((r) => (r.ok ? r.json() : [])).then(setMessages).catch(() => setMessages([]));
    fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).then((users) => setTeamUsers(users.filter((u: { isActive: boolean }) => u.isActive))).catch(() => {});
  }, [id, router]);

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/admin/prospecting/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus, actionType: `STATUS_${newStatus}` }) });
    if (res.ok) { const updated = await res.json(); setProspect((prev) => prev ? { ...prev, status: newStatus, sentAt: updated.sentAt } : prev); refreshData(); }
  }

  async function handleOwnerChange(userId: string) {
    const value = userId === "UNASSIGN" ? null : userId;
    await fetch(`/api/admin/prospecting/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerUserId: value }) });
    const owner = value ? teamUsers.find((u) => u.id === value) || null : null;
    setProspect((prev) => prev ? { ...prev, owner } : prev);
    refreshData();
  }

  async function handleConvertToLead() {
    if (!prospect || !confirm(`Convert "${prospect.name}" to a lead?`)) return;
    const res = await fetch("/api/admin/prospecting/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectId: prospect.id }) });
    if (res.ok) { const data = await res.json(); router.push(`/admin/leads/${data.leadId}`); }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/prospecting/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: noteText }) });
    if (res.ok) { const note = await res.json(); setProspect((prev) => prev ? { ...prev, notes: [note, ...prev.notes] } : prev); setNoteText(""); refreshData(); }
    setSaving(false);
  }

  async function handleContactCheck(field: "whatsappStatus" | "instagramStatus", value: ContactCheckStatus) {
    const res = await fetch(`/api/admin/prospecting/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    if (res.ok) await refreshData();
    else alert("The check wasn't saved. Try again.");
  }

  async function refreshData() {
    const [res, msgs] = await Promise.all([fetch(`/api/admin/prospecting/${id}`), fetch(`/api/admin/prospecting/${id}/outreach`)]);
    if (res.ok) { const data = await res.json(); setProspect(data); }
    if (msgs.ok) setMessages(await msgs.json());
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[var(--os-border)] border-t-[var(--os-text-muted)] rounded-full animate-spin" /></div>;
  if (!prospect) return null;

  const summary = prospect.summary ?? null;
  const group = getDisplayGroupByKey(summary?.group);
  const stage = displayStageOf({ status: prospect.status, messageReplied: summary?.replyState === "CONFIRMED" });
  const action = summary?.nextAction ?? null;
  const actionHref = action?.actionable ? detailActionHref(action.key) : null;
  const evidence = prospect.sendEvidence ?? "NOT_CONTACTED";
  const told = contactSummary({ sendEvidence: evidence, replyState: summary?.replyState ?? "NONE", lastConfirmedSendDay: prospect.lastConfirmedSendDay, group: summary?.group });
  const ig = prospect.instagram.replace(/^@/, "");
  // Evidence saved with a Today import: where each contact was published. Shown beside the checks, never a check.
  const ev = prospect.contactEvidence ?? null;
  const otherFound = (ev?.items ?? []).filter((i) => i.channel === "EMAIL" || i.channel === "FACEBOOK");
  const statusOptions = STATUSES.includes(prospect.status) ? STATUSES : [prospect.status, ...STATUSES];

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/prospecting" className="inline-flex items-center gap-2 text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)] hover:text-gray-600 os-dark:hover:text-[var(--os-text-muted)] transition-colors mb-5">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to prospects
      </Link>

      {/* 1-3: who they are, have we contacted them, what to do next */}
      <section className={card} data-testid="overview">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 os-dark:text-[var(--os-text)] break-words">{prospect.name}</h1>
            <p className="mt-1 text-[13px] text-gray-500 os-dark:text-[var(--os-text-soft)]">
              {[prospect.sector, prospect.neighborhood].filter(Boolean).join(" · ")}
              {" · "}{prospect.hasWebsite ? "Has a website" : "No website"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap" title={`Detailed status: ${STATUS_LABELS[prospect.status] ?? prospect.status}`}>
            {group && <span data-testid="group-badge" className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-violet-50 os-dark:bg-violet-500/10 text-violet-700 os-dark:text-violet-300 border border-violet-100 os-dark:border-violet-500/30">{group.label}</span>}
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-50 os-dark:bg-[var(--os-surface-2)] text-gray-600 os-dark:text-[var(--os-text-muted)] border border-gray-200 os-dark:border-[var(--os-border)]">{stage?.label ?? prospect.status}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-1 text-[13px]" data-testid="contact-summary">
          <p className="text-gray-700 os-dark:text-[var(--os-text-muted)]"><span className="text-gray-400 os-dark:text-[var(--os-text-faint)]">Contacted: </span>{told.contacted}</p>
          {told.reply && <p className="text-gray-700 os-dark:text-[var(--os-text-muted)]"><span className="text-gray-400 os-dark:text-[var(--os-text-faint)]">Reply: </span>{told.reply}</p>}
        </div>

        <div className="mt-4 rounded-xl bg-[var(--os-surface-2)] border border-[var(--os-border)] p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="next-step">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--os-text-muted)] font-semibold">Next step</p>
            <p className="text-[15px] font-semibold text-gray-900 os-dark:text-[var(--os-text)]">{action?.label ?? "Open the details below"}</p>
            {action?.hint && <p className="text-[12.5px] text-gray-500 os-dark:text-[var(--os-text-soft)] mt-0.5">{action.hint}</p>}
          </div>
          {actionHref && (
            actionHref.startsWith("#")
              ? <a href={actionHref} className="shrink-0 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold os-btn-primary">{action!.label} →</a>
              : <Link href={actionHref} className="shrink-0 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold os-btn-primary">{action!.label} →</Link>
          )}
        </div>
      </section>

      {/* Contact details. A channel opens only once someone confirmed it by hand. */}
      <section id="contact" className={card}>
        <h2 className={`${h2} mb-3`}>Contact</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {prospect.phone && (
            <a href={`tel:${prospect.phone}`} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 os-dark:bg-[var(--os-surface-2)] border border-gray-200 os-dark:border-[var(--os-border)] rounded-xl text-[13px] font-medium text-gray-600 os-dark:text-[var(--os-text-muted)] hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)] transition-colors">
              <HiOutlinePhone className="w-4 h-4" /> {prospect.phone}
            </a>
          )}
          {prospect.whatsappStatus === "VERIFIED" && prospect.whatsappLink && (
            <a href={prospect.whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-green-50 os-dark:bg-green-500/10 border border-green-200 os-dark:border-green-500/30 rounded-xl text-[13px] font-medium text-green-700 os-dark:text-green-300 hover:bg-green-100 os-dark:hover:bg-green-500/15 transition-colors">
              <FaWhatsapp className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {prospect.instagram && prospect.instagramStatus === "VERIFIED" && (
            <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 os-dark:bg-purple-500/10 border border-purple-200 os-dark:border-purple-500/30 rounded-xl text-[13px] font-medium text-purple-700 os-dark:text-purple-300 hover:bg-purple-100 os-dark:hover:bg-purple-500/15 transition-colors">
              <FaInstagram className="w-4 h-4" /> @{ig}
            </a>
          )}
          {!prospect.phone && !prospect.instagram && <p className="text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)]">No phone or Instagram saved.</p>}
        </div>
        {/* A person opens each contact and records what they saw. Nothing is checked automatically. */}
        <p className={`${label} mb-2`}>Contact checks</p>
        <div className="grid gap-2">
          <ContactCheck channel="WHATSAPP" value={prospect.whatsappLink} phone={prospect.phone} status={prospect.whatsappStatus}
            lastCheck={lastContactCheck(prospect.activities, "WHATSAPP")} onSet={(s) => handleContactCheck("whatsappStatus", s)}
            evidence={ev ? { ...evidenceForSaved(ev, "WHATSAPP", prospect.whatsappLink), confidence: ev.whatsappConfidence, checkedAt: ev.checkedAt } : null} />
          <ContactCheck channel="INSTAGRAM" value={prospect.instagram} status={prospect.instagramStatus}
            lastCheck={lastContactCheck(prospect.activities, "INSTAGRAM")} onSet={(s) => handleContactCheck("instagramStatus", s)}
            evidence={ev ? { ...evidenceForSaved(ev, "INSTAGRAM", prospect.instagram), checkedAt: ev.checkedAt } : null} />
        </div>
        {otherFound.length > 0 && (
          <div className="mt-2 text-[11px] text-gray-500 os-dark:text-[var(--os-text-soft)]" data-evidence="OTHER">
            <p className="font-medium text-gray-600 os-dark:text-[var(--os-text-muted)]">Also published (no check exists for these; nothing was verified)</p>
            <ul className="mt-0.5 space-y-0.5">
              {otherFound.map((i) => (
                <li key={i.channel + i.link} className="break-all">{i.channel === "EMAIL" ? "E-mail" : "Facebook"} {i.value || i.link}, {sourceText(i)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4">
          <p className={`${label} mb-2`}>Owner</p>
          <div className="flex flex-wrap gap-1.5">
            {teamUsers.map((u) => (
              <AvatarChip key={u.id} initials={u.avatarInitials} name={u.fullName} showName={false} size="md" onClick={() => handleOwnerChange(u.id)} active={prospect.owner?.id === u.id} />
            ))}
          </div>
        </div>
      </section>

      {/* First message: written, opened and confirmed in the existing panel ("did you send it?"). */}
      <div id="first-message" className="scroll-mt-20">
        <OutreachDraftPanel prospect={prospect} onRecorded={refreshData} />
      </div>

      {/* Conversation history: saved messages only. A record before 20 Aug 2026 is not proof of a send. */}
      <section id="conversation" className={card}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className={h2}>Conversation</h2>
          {showsSendEvidence(summary?.group) && evidence !== "NOT_CONTACTED" && (
            <span title={VISIBLE_SEND_LABELS[evidence].title} className="text-[11px] px-2 py-0.5 rounded-md border bg-gray-50 os-dark:bg-[var(--os-surface-2)] text-gray-600 os-dark:text-[var(--os-text-muted)] border-gray-200 os-dark:border-[var(--os-border)]">{VISIBLE_SEND_LABELS[evidence].label}</span>
          )}
        </div>
        {summary?.replyState === "POSSIBLE_OLD" && (
          <p className="mb-3 text-[12.5px] rounded-lg bg-slate-50 os-dark:bg-[var(--os-surface-2)] border border-slate-200 os-dark:border-[var(--os-border)] text-slate-600 os-dark:text-[var(--os-text-muted)] px-3 py-2" title={REPLY_LABELS.POSSIBLE_OLD.title}>{REPLY_LABELS.POSSIBLE_OLD.title}</p>
        )}
        {messages === null ? <p className="text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)]">Loading…</p> : messages.length === 0 ? (
          <p className="text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)]">No messages saved yet.</p>
        ) : (
          <ul className="space-y-2.5" data-testid="messages">
            {messages.map((m) => {
              const confirmed = new Date(m.sentAt).getTime() >= CONFIRMED_SEND_SINCE.getTime();
              return (
                <li key={m.id} className="p-3 bg-gray-50 os-dark:bg-[var(--os-surface-2)] rounded-xl">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 os-dark:text-[var(--os-text-soft)]">
                    <span className="font-semibold text-gray-700 os-dark:text-[var(--os-text-muted)]">{m.channel === "WHATSAPP" ? "WhatsApp" : m.channel === "INSTAGRAM" ? "Instagram" : m.channel}</span>
                    <span>{fmt(m.sentAt, true)}</span>
                    <span className={confirmed ? "text-blue-700 os-dark:text-blue-300" : "text-amber-700 os-dark:text-amber-300"}>{confirmed ? "Confirmed as sent" : "Older record, not confirmed"}</span>
                    {m.replied && <span className="text-emerald-700 os-dark:text-emerald-300 font-medium">Replied{m.replyReason ? `: ${REASON_LABELS[m.replyReason] ?? m.replyReason}` : ""}</span>}
                  </div>
                  <p className="mt-1 text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)] whitespace-pre-wrap line-clamp-4">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}
        {prospect.status === "REPONDU" && (
          <button onClick={handleConvertToLead} className="w-full mt-4 py-3 os-btn-primary rounded-2xl text-[13px] font-semibold transition-all">
            Convert to Lead →
          </button>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Notes */}
        <section id="notes" className="bg-[var(--os-surface)] rounded-2xl border border-gray-100 os-dark:border-[var(--os-border)] p-5 scroll-mt-20">
          <h2 className={`${h2} mb-4`}>Notes</h2>
          <form onSubmit={handleAddNote} className="mb-4">
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." rows={3} className="w-full px-4 py-3 bg-gray-50 os-dark:bg-[var(--os-surface-2)] border border-gray-200 os-dark:border-[var(--os-border)] rounded-xl text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)] placeholder:text-gray-400 os-dark:placeholder:text-[var(--os-text-faint)] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all mb-2 resize-none" />
            <button type="submit" disabled={saving || !noteText.trim()} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-40">
              {saving ? "Saving..." : "Add Note"}
            </button>
          </form>
          {prospect.notes.length === 0 ? <p className="text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)]">No notes yet.</p> : (
            <div className="space-y-2.5">
              {prospect.notes.map((note) => (
                <div key={note.id} className="p-3 bg-gray-50 os-dark:bg-[var(--os-surface-2)] rounded-xl">
                  <p className="text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)] whitespace-pre-wrap">{note.content}</p>
                  <p className="text-[11px] text-gray-400 os-dark:text-[var(--os-text-faint)] mt-1.5">{fmt(note.createdAt, true)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activity timeline (unchanged) */}
        <section className="bg-[var(--os-surface)] rounded-2xl border border-gray-100 os-dark:border-[var(--os-border)] p-5">
          <h2 className={`${h2} mb-4`}>Activity</h2>
          {(!prospect.activities || prospect.activities.length === 0) ? <p className="text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)]">No activity yet.</p> : (
            <div className="space-y-0 border-l-2 border-gray-100 os-dark:border-[var(--os-border)] ml-2">
              {prospect.activities.map((a) => (
                <div key={a.id} className="relative pl-5 pb-4">
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-violet-400" />
                  <p className="text-[13px] text-gray-600 os-dark:text-[var(--os-text-muted)]"><span className="font-medium text-gray-800 os-dark:text-[var(--os-text)]">{a.userName}</span> {ACTION_LABELS[a.actionType] ?? a.actionType}</p>
                  {a.details && a.actionType === "NOTE_ADDED" && <p className="text-[11px] text-gray-400 os-dark:text-[var(--os-text-faint)] mt-0.5 truncate">&ldquo;{a.details}&rdquo;</p>}
                  <p className="text-[10px] text-gray-400 os-dark:text-[var(--os-text-faint)] mt-0.5">{fmt(a.createdAt, true)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sales playbook and score (unchanged), folded away. */}
      <details className="mb-4 rounded-2xl border border-gray-100 os-dark:border-[var(--os-border)] bg-[var(--os-surface)]">
        <summary className="cursor-pointer select-none px-5 py-3 text-[13px] font-semibold text-gray-700 os-dark:text-[var(--os-text-muted)]">Sales playbook and score</summary>
        <div className="px-2 pb-2">
          <PlaybookPanel
            prospect={{
              id: prospect.id,
              name: prospect.name,
              sector: prospect.sector,
              neighborhood: prospect.neighborhood,
              instagram: prospect.instagram,
              whatsappLink: prospect.whatsappLink,
              hasWebsite: prospect.hasWebsite,
              score: prospect.score,
              scoreLabel: prospect.scoreLabel,
            }}
            onScoreUpdated={(score, label) => setProspect((prev) => prev ? { ...prev, score, scoreLabel: label as "HIGH" | "MEDIUM" | "LOW" } : prev)}
          />
        </div>
      </details>

      {/* Advanced: the detailed status and record-keeping fields. Opens itself when the next step points here. */}
      <details id="advanced" className="mb-8 rounded-2xl border border-gray-100 os-dark:border-[var(--os-border)] bg-[var(--os-surface)] scroll-mt-20" open={actionHref === "#advanced" || undefined}>
        <summary className="cursor-pointer select-none px-5 py-3 text-[13px] font-semibold text-gray-700 os-dark:text-[var(--os-text-muted)]">Advanced</summary>
        <div className="px-5 pb-5 space-y-4">
          <div>
            <p className={label}>Detailed status</p>
            <p className="text-[12px] text-gray-400 os-dark:text-[var(--os-text-faint)] mb-2">Changes the stored status. Sending a message updates it for you; change it here only to correct it.</p>
            <select value={prospect.status} onChange={(e) => handleStatusChange(e.target.value)} className="px-3 py-2 bg-gray-50 os-dark:bg-[var(--os-surface-2)] border border-gray-200 os-dark:border-[var(--os-border)] rounded-xl text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 cursor-pointer">
              {statusOptions.map((s) => <option key={s} value={s} disabled={!STATUSES.includes(s)}>{STATUS_LABELS[s] ?? s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><p className={label}>Priority</p><p className="text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)]">{PRIORITY_LABELS[prospect.priority] ?? prospect.priority}</p></div>
            <div><p className={label}>Added</p><p className="text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)]">{fmt(prospect.createdAt)}</p></div>
            <div><p className={label}>Marked sent</p><p className="text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)]" title="The stored send date. Not proof that a message was sent.">{prospect.sentAt ? fmt(prospect.sentAt, true) : "—"}</p></div>
            <div><p className={label}>Sent by</p>{prospect.sentByUser ? <AvatarChip initials={prospect.sentByUser.avatarInitials} name={prospect.sentByUser.fullName} size="sm" /> : <p className="text-[13px] text-gray-400 os-dark:text-[var(--os-text-faint)]">—</p>}</div>
            <div><p className={label}>First contact</p><p className="text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)]">{prospect.contactedByName ? `${prospect.contactedByName}${prospect.contactedAt ? `, ${fmt(prospect.contactedAt)}` : ""}` : "—"}</p></div>
            <div><p className={label}>Last action</p><p className="text-[13px] text-gray-700 os-dark:text-[var(--os-text-muted)]">{prospect.lastActionByName ? `${prospect.lastActionByName}${prospect.lastActionAt ? `, ${fmt(prospect.lastActionAt, true)}` : ""}` : "—"}</p></div>
          </div>
          <Link href={`/admin/prospecting/${prospect.id}/edit`} className="inline-flex text-[13px] text-violet-600 os-dark:text-violet-400 hover:underline">Edit details</Link>
        </div>
      </details>
    </div>
  );
}
