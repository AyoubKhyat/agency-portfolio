"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/20 text-blue-400",
  CONTACTED: "bg-yellow-500/20 text-yellow-400",
  QUALIFIED: "bg-green-500/20 text-green-400",
  CLOSED: "bg-gray-500/20 text-gray-400",
};

type Note = { id: string; content: string; createdAt: string };
type Lead = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  notes: Note[];
};

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/leads/${id}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 404) { router.push("/admin/leads"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setLead(data); setLoading(false); });
  }, [id, router]);

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/leads/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText }),
    });
    if (res.ok) {
      const note = await res.json();
      setLead((prev) => (prev ? { ...prev, notes: [note, ...prev.notes] } : prev));
      setNoteText("");
    }
    setSaving(false);
  }

  if (loading) return <div className="text-gray-500 animate-pulse">Loading...</div>;
  if (!lead) return null;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/leads" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">{lead.fullName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Lead info */}
      <div className="border border-white/10 rounded-xl p-6 space-y-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
            <a href={`mailto:${lead.email}`} className="text-sm text-violet-400 hover:text-violet-300">{lead.email}</a>
          </div>
          {lead.phone && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
              <a href={`tel:${lead.phone}`} className="text-sm text-gray-200">{lead.phone}</a>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm text-gray-200">{lead.subject}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Message</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{lead.message}</p>
        </div>
      </div>

      {/* Notes */}
      <div>
        <h2 className="text-lg font-medium text-gray-200 mb-4">Notes</h2>

        <form onSubmit={handleAddNote} className="mb-6">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500 transition-colors mb-2"
          />
          <button
            type="submit"
            disabled={saving || !noteText.trim()}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Note"}
          </button>
        </form>

        {lead.notes.length === 0 ? (
          <p className="text-gray-600 text-sm">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {lead.notes.map((note) => (
              <div key={note.id} className="border border-white/5 rounded-lg p-4">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-gray-600 mt-2">
                  {new Date(note.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
