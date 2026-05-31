"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-600 border-blue-100",
  CONTACTED: "bg-amber-50 text-amber-600 border-amber-100",
  QUALIFIED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CLOSED: "bg-gray-100 text-gray-500 border-gray-200",
};

type Note = { id: string; content: string; createdAt: string };
type Lead = { id: string; fullName: string; email: string; phone: string | null; subject: string; message: string; status: string; createdAt: string; notes: Note[] };

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/leads/${id}`).then((r) => {
      if (r.status === 401) { router.push("/admin/login"); return null; }
      if (r.status === 404) { router.push("/admin/leads"); return null; }
      return r.json();
    }).then((data) => { if (data) setLead(data); setLoading(false); });
  }, [id, router]);

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) setLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/leads/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: noteText }) });
    if (res.ok) { const note = await res.json(); setLead((prev) => (prev ? { ...prev, notes: [note, ...prev.notes] } : prev)); setNoteText(""); }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>;
  if (!lead) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/leads" className="inline-flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{lead.fullName}</h1>
            <p className="text-[12px] text-gray-400 mt-1">{new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 cursor-pointer">
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Email</p>
            <a href={`mailto:${lead.email}`} className="text-[13px] text-violet-600 hover:text-violet-700">{lead.email}</a>
          </div>
          {lead.phone && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Phone</p>
              <a href={`tel:${lead.phone}`} className="text-[13px] text-gray-700">{lead.phone}</a>
            </div>
          )}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Subject</p>
            <p className="text-[13px] text-gray-700">{lead.subject}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Status</p>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase border ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Message</p>
          <p className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl">{lead.message}</p>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Notes</h2>
        <form onSubmit={handleAddNote} className="mb-4">
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." rows={3} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all mb-2 resize-none" />
          <button type="submit" disabled={saving || !noteText.trim()} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-40">{saving ? "Saving..." : "Add Note"}</button>
        </form>
        {lead.notes.length === 0 ? <p className="text-[13px] text-gray-400">No notes yet.</p> : (
          <div className="space-y-2.5">
            {lead.notes.map((note) => (
              <div key={note.id} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-[13px] text-gray-700 whitespace-pre-wrap">{note.content}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">{new Date(note.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
