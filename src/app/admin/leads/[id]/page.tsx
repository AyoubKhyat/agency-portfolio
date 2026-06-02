"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail, Phone, MessageSquare, StickyNote } from "lucide-react";
import { FormCard, Field, Select, FormButton } from "@/components/admin/form";
import { Badge } from "@/components/admin/badge";
import { MentionTextarea, HighlightedMentions } from "@/components/admin/mention-textarea";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];
const STATUS_VARIANT: Record<string, "blue" | "amber" | "green" | "default"> = {
  NEW: "blue",
  CONTACTED: "amber",
  QUALIFIED: "green",
  CLOSED: "default",
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
    if (res.ok) setLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" />
      </div>
    );
  }
  if (!lead) return null;

  const created = new Date(lead.createdAt);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748B] hover:text-[#8B00FF] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to leads
      </Link>

      <div>
        <h1 className="text-[24px] font-bold text-[#0F172A] tracking-tight">{lead.fullName}</h1>
        <p className="text-[13px] text-[#64748B] mt-1">
          Received {created.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <FormCard
        title="Contact"
        subtitle="How to reach this lead."
        icon={<Mail className="w-4 h-4" />}
        action={
          <div className="w-44">
            <Select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </Select>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">Email</p>
            <a href={`mailto:${lead.email}`} className="text-[14px] text-[#8B00FF] hover:underline break-all">
              {lead.email}
            </a>
          </div>
          {lead.phone && (
            <div>
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">Phone</p>
              <a href={`tel:${lead.phone}`} className="text-[14px] text-[#0F172A] hover:text-[#8B00FF] inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {lead.phone}
              </a>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">Subject</p>
            <p className="text-[14px] text-[#0F172A]">{lead.subject}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em] mb-1.5">Status</p>
            <Badge variant={STATUS_VARIANT[lead.status]} size="sm" dot>{lead.status}</Badge>
          </div>
        </div>
      </FormCard>

      <FormCard
        title="Message"
        subtitle="Original message sent through the contact form."
        icon={<MessageSquare className="w-4 h-4" />}
      >
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
          <p className="text-[14px] text-[#475569] whitespace-pre-wrap leading-relaxed">{lead.message}</p>
        </div>
      </FormCard>

      <FormCard
        title="Internal notes"
        subtitle="Only visible to the team."
        icon={<StickyNote className="w-4 h-4" />}
      >
        <form onSubmit={handleAddNote} className="space-y-3 mb-5">
          <Field label="Add a note" hint="Type @ to mention a teammate.">
            <MentionTextarea
              value={noteText}
              onChange={setNoteText}
              placeholder="Called on Tuesday — interested in the e-commerce package..."
              rows={3}
            />
          </Field>
          <FormButton type="submit" variant="primary" loading={saving} disabled={!noteText.trim()}>
            {saving ? "Saving..." : "Add note"}
          </FormButton>
        </form>

        {lead.notes.length === 0 ? (
          <p className="text-[13px] text-[#94A3B8]">No notes yet.</p>
        ) : (
          <div className="space-y-2.5">
            {lead.notes.map((note) => (
              <div key={note.id} className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <HighlightedMentions
                  text={note.content}
                  className="text-[14px] text-[#0F172A] whitespace-pre-wrap leading-relaxed block"
                />
                <p className="text-[12px] text-[#94A3B8] mt-2">
                  {new Date(note.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </FormCard>
    </div>
  );
}
