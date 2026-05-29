"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlineChatBubbleLeft } from "react-icons/hi2";

const STATUSES = ["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"];
const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "À envoyer",
  ENVOYE: "Envoyé",
  REPONDU: "Répondu",
  PAS_DE_WHATSAPP: "Pas de WhatsApp",
  CONVERTI: "Converti en lead",
};
const STATUS_COLORS: Record<string, string> = {
  A_ENVOYER: "bg-blue-500/20 text-blue-400",
  ENVOYE: "bg-yellow-500/20 text-yellow-400",
  REPONDU: "bg-green-500/20 text-green-400",
  PAS_DE_WHATSAPP: "bg-red-500/20 text-red-400",
  CONVERTI: "bg-violet-500/20 text-violet-400",
};
const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-green-500/20 text-green-400",
  2: "bg-yellow-500/20 text-yellow-400",
  3: "bg-gray-500/20 text-gray-400",
};
const PRIORITY_LABELS: Record<number, string> = {
  1: "1 — Instagram sans site",
  2: "2 — Sans site",
  3: "3 — A un site",
};

type Note = { id: string; content: string; createdAt: string };
type Prospect = {
  id: string;
  name: string;
  phone: string;
  whatsappLink: string;
  sector: string;
  neighborhood: string;
  instagram: string;
  hasWebsite: boolean;
  priority: number;
  status: string;
  sentAt: string | null;
  createdAt: string;
  notes: Note[];
};

export default function ProspectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/prospecting/${id}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 404) { router.push("/admin/prospecting"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setProspect(data); setLoading(false); });
  }, [id, router]);

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/admin/prospecting/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProspect((prev) => prev ? { ...prev, status: newStatus, sentAt: updated.sentAt } : prev);
    }
  }

  async function handleConvertToLead() {
    if (!prospect) return;
    if (!confirm(`Convert "${prospect.name}" to a lead?`)) return;
    const res = await fetch("/api/admin/prospecting/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId: prospect.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setProspect((prev) => prev ? { ...prev, status: "CONVERTI" } : prev);
      router.push(`/admin/leads/${data.leadId}`);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/prospecting/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText }),
    });
    if (res.ok) {
      const note = await res.json();
      setProspect((prev) => prev ? { ...prev, notes: [note, ...prev.notes] } : prev);
      setNoteText("");
    }
    setSaving(false);
  }

  if (loading) return <div className="text-gray-500 animate-pulse">Loading...</div>;
  if (!prospect) return null;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/prospecting" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to Prospecting
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">{prospect.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Added {new Date(prospect.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <select
          value={prospect.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-1.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[#1a1a2e] text-gray-200">{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Prospect info */}
      <div className="border border-white/10 rounded-xl p-6 space-y-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
            <a href={`tel:${prospect.phone}`} className="text-sm text-gray-200">{prospect.phone}</a>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">WhatsApp</p>
            <a
              href={prospect.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400 hover:bg-green-500/20 transition-colors"
            >
              <HiOutlineChatBubbleLeft className="w-4 h-4" />
              Open WhatsApp
            </a>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sector</p>
            <p className="text-sm text-gray-200">{prospect.sector}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Quartier</p>
            <p className="text-sm text-gray-200">{prospect.neighborhood || "—"}</p>
          </div>
          {prospect.instagram && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Instagram</p>
              <a
                href={`https://instagram.com/${prospect.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                @{prospect.instagram.replace(/^@/, "")}
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Website</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${prospect.hasWebsite ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {prospect.hasWebsite ? "OUI" : "NON"}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Priority</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[prospect.priority]}`}>
              {PRIORITY_LABELS[prospect.priority]}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[prospect.status]}`}>
              {STATUS_LABELS[prospect.status]}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date Sent</p>
            <p className="text-sm text-gray-200">
              {prospect.sentAt
                ? new Date(prospect.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Convert to Lead */}
      {prospect.status === "REPONDU" && (
        <button
          onClick={handleConvertToLead}
          className="w-full mb-8 flex items-center justify-center gap-2 px-4 py-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-400 hover:bg-violet-500/20 transition-colors font-medium text-sm"
        >
          <HiOutlineArrowLeft className="w-4 h-4 rotate-180" />
          Convert to Lead
        </button>
      )}

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

        {prospect.notes.length === 0 ? (
          <p className="text-gray-600 text-sm">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {prospect.notes.map((note) => (
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
