"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlineChatBubbleLeft, HiOutlinePhone } from "react-icons/hi2";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import AvatarChip from "@/components/AvatarChip";

const STATUSES = ["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"];
const STATUS_LABELS: Record<string, string> = { A_ENVOYER: "To Send", ENVOYE: "Sent", REPONDU: "Replied", PAS_DE_WHATSAPP: "No WhatsApp", CONVERTI: "Converted" };
const STATUS_COLORS: Record<string, string> = {
  A_ENVOYER: "bg-blue-50 text-blue-600 border-blue-100",
  ENVOYE: "bg-amber-50 text-amber-600 border-amber-100",
  REPONDU: "bg-emerald-50 text-emerald-600 border-emerald-100",
  PAS_DE_WHATSAPP: "bg-red-50 text-red-500 border-red-100",
  CONVERTI: "bg-violet-50 text-violet-600 border-violet-100",
};
const PRIORITY_LABELS: Record<number, string> = { 1: "Instagram sans site", 2: "Sans site", 3: "A un site" };
const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect", ASSIGNED: "assigned prospect", SENT_WHATSAPP: "sent WhatsApp", SENT_INSTAGRAM: "sent Instagram DM",
  FOLLOW_UP: "sent follow-up", MARKED_REPLIED: "marked as replied", MARKED_NO_WHATSAPP: "marked no WhatsApp",
  STATUS_ENVOYE: "changed status to Sent", STATUS_REPONDU: "marked as replied", STATUS_CONVERTI: "converted to lead",
  NOTE_ADDED: "added a note", UPDATED: "updated details",
};

type Note = { id: string; content: string; createdAt: string };
type Activity = { id: string; userId: string; userName: string; actionType: string; previousStatus: string | null; newStatus: string | null; details: string | null; createdAt: string };
type Owner = { id: string; fullName: string; avatarInitials: string };
type TeamUser = { id: string; fullName: string; avatarInitials: string };
type SentBy = { id: string; fullName: string; avatarInitials: string } | null;
type Prospect = {
  id: string; name: string; phone: string; whatsappLink: string; sector: string; neighborhood: string; instagram: string;
  hasWebsite: boolean; priority: number; status: string; sentAt: string | null; createdAt: string; owner: Owner | null;
  sentByUser: SentBy; sentByName: string | null;
  contactedByName: string | null; contactedAt: string | null; lastActionByName: string | null; lastActionAt: string | null;
  notes: Note[]; activities: Activity[];
};

export default function ProspectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
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

  async function refreshData() {
    const res = await fetch(`/api/admin/prospecting/${id}`);
    if (res.ok) { const data = await res.json(); setProspect(data); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>;
  if (!prospect) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/prospecting" className="inline-flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{prospect.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[12px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">{prospect.sector}</span>
              {prospect.neighborhood && <span className="text-[12px] text-gray-400">{prospect.neighborhood}</span>}
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase border ${STATUS_COLORS[prospect.status]}`}>
                {STATUS_LABELS[prospect.status]}
              </span>
            </div>
          </div>
          <select value={prospect.status} onChange={(e) => handleStatusChange(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 cursor-pointer">
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        {/* Contact actions */}
        <div className="flex gap-2 mb-5">
          {prospect.phone && (
            <a href={`tel:${prospect.phone}`} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <HiOutlinePhone className="w-4 h-4" /> {prospect.phone}
            </a>
          )}
          <a href={prospect.whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-[13px] font-medium text-green-700 hover:bg-green-100 transition-colors">
            <FaWhatsapp className="w-4 h-4" /> WhatsApp
          </a>
          {prospect.instagram && (
            <a href={`https://instagram.com/${prospect.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-[13px] font-medium text-purple-700 hover:bg-purple-100 transition-colors">
              <FaInstagram className="w-4 h-4" /> @{prospect.instagram.replace(/^@/, "")}
            </a>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Priority</p>
            <p className="text-[13px] text-gray-700 font-medium">{PRIORITY_LABELS[prospect.priority]}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Website</p>
            <p className="text-[13px] font-medium">{prospect.hasWebsite ? <span className="text-emerald-600">Yes</span> : <span className="text-red-500">No</span>}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Sent</p>
            <p className="text-[13px] text-gray-700">{prospect.sentAt ? new Date(prospect.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Added</p>
            <p className="text-[13px] text-gray-700">{new Date(prospect.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </div>
        </div>
      </div>

      {/* Owner + Contact info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-3">Owner</p>
          <div className="flex gap-1.5">
            {teamUsers.map((u) => (
              <AvatarChip key={u.id} initials={u.avatarInitials} name={u.fullName} showName={false} size="md" onClick={() => handleOwnerChange(u.id)} active={prospect.owner?.id === u.id} />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Sent By</p>
          {prospect.sentByUser ? (
            <div className="flex items-center gap-2">
              <AvatarChip initials={prospect.sentByUser.avatarInitials} name={prospect.sentByUser.fullName} size="sm" />
            </div>
          ) : <p className="text-[13px] text-gray-400">Not sent yet</p>}
          {prospect.sentAt && <p className="text-[11px] text-gray-400 mt-1">{new Date(prospect.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">First Contact</p>
          {prospect.contactedByName ? (
            <><p className="text-[13px] font-medium text-gray-800">{prospect.contactedByName}</p><p className="text-[11px] text-gray-400">{prospect.contactedAt && new Date(prospect.contactedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</p></>
          ) : <p className="text-[13px] text-gray-400">Not yet</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Last Action</p>
          {prospect.lastActionByName ? (
            <><p className="text-[13px] font-medium text-gray-800">{prospect.lastActionByName}</p><p className="text-[11px] text-gray-400">{prospect.lastActionAt && new Date(prospect.lastActionAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p></>
          ) : <p className="text-[13px] text-gray-400">None</p>}
        </div>
      </div>

      {/* Convert button */}
      {prospect.status === "REPONDU" && (
        <button onClick={handleConvertToLead} className="w-full mb-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl text-[13px] font-semibold shadow-sm shadow-violet-200 hover:shadow-md hover:shadow-violet-200 transition-all">
          Convert to Lead →
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Notes</h2>
          <form onSubmit={handleAddNote} className="mb-4">
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." rows={3} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all mb-2 resize-none" />
            <button type="submit" disabled={saving || !noteText.trim()} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-40">
              {saving ? "Saving..." : "Add Note"}
            </button>
          </form>
          {prospect.notes.length === 0 ? <p className="text-[13px] text-gray-400">No notes yet.</p> : (
            <div className="space-y-2.5">
              {prospect.notes.map((note) => (
                <div key={note.id} className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  <p className="text-[11px] text-gray-400 mt-1.5">{new Date(note.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Activity</h2>
          {(!prospect.activities || prospect.activities.length === 0) ? <p className="text-[13px] text-gray-400">No activity yet.</p> : (
            <div className="space-y-0 border-l-2 border-gray-100 ml-2">
              {prospect.activities.map((a) => (
                <div key={a.id} className="relative pl-5 pb-4">
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-violet-400" />
                  <p className="text-[13px] text-gray-600"><span className="font-medium text-gray-800">{a.userName}</span> {ACTION_LABELS[a.actionType] ?? a.actionType}</p>
                  {a.details && a.actionType === "NOTE_ADDED" && <p className="text-[11px] text-gray-400 mt-0.5 truncate">&ldquo;{a.details}&rdquo;</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
