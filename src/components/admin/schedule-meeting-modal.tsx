"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, X, Loader2, Phone, Video, MessageCircle, MapPin } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Field, Input, Select, FormButton, FormError } from "@/components/admin/form";
import { MentionTextarea } from "@/components/admin/mention-textarea";

export type MeetingType = "CALL" | "GOOGLE_MEET" | "ZOOM" | "WHATSAPP" | "IN_PERSON";

const TYPES: { value: MeetingType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "CALL",        label: "Phone call",  icon: Phone },
  { value: "GOOGLE_MEET", label: "Google Meet", icon: Video },
  { value: "ZOOM",        label: "Zoom",        icon: Video },
  { value: "WHATSAPP",    label: "WhatsApp",    icon: FaWhatsapp },
  { value: "IN_PERSON",   label: "In person",   icon: MapPin },
];

type TeamMember = { id: string; fullName: string; avatarInitials: string };

export type ScheduleContext =
  | { kind: "client";   clientId: string;   label: string }
  | { kind: "prospect"; prospectId: string; label: string }
  | { kind: "free"; defaultClientId?: string; defaultProspectId?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (meeting: { id: string }) => void;
  context: ScheduleContext;
  defaultOwnerId?: string;
};

function defaultStart() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalInput(d);
}

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleMeetingModal({ open, onClose, onCreated, context, defaultOwnerId }: Props) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Discovery call");
  const [type, setType] = useState<MeetingType>("CALL");
  const [startAt, setStartAt] = useState<string>(defaultStart());
  const [durationMin, setDurationMin] = useState<number>(30);
  const [ownerId, setOwnerId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) ? setTeam(d) : undefined)
      .catch(() => {});
    // reset state when opening fresh
    setTitle("Discovery call");
    setType("CALL");
    setStartAt(defaultStart());
    setDurationMin(30);
    setOwnerId(defaultOwnerId ?? "");
    setNotes("");
    setError(null);
  }, [open, defaultOwnerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!startAt) { setError("Start time is required."); return; }
    setSaving(true);

    const start = new Date(startAt);
    const end = new Date(start.getTime() + durationMin * 60_000);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      type,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      notes: notes.trim(),
      ownerId: ownerId || null,
    };
    if (context.kind === "client") payload.clientId = context.clientId;
    if (context.kind === "prospect") payload.prospectId = context.prospectId;
    if (context.kind === "free") {
      if (context.defaultClientId) payload.clientId = context.defaultClientId;
      if (context.defaultProspectId) payload.prospectId = context.defaultProspectId;
    }

    try {
      const res = await fetch("/api/admin/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const m = await res.json();
        onCreated(m);
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : "Could not schedule the meeting.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const subjectLabel =
    context.kind === "client"   ? `with ${context.label}` :
    context.kind === "prospect" ? `with ${context.label}` : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-[540px] max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 pt-5 pb-4 border-b border-[#E5E7EB] flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-[#111827]">Schedule meeting</h2>
                  {subjectLabel && <p className="text-[12px] text-[#6B7280] mt-0.5">{subjectLabel}</p>}
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <Field label="Title" required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Discovery call" autoFocus />
              </Field>

              <div>
                <label className="block text-[12px] font-semibold text-[#475569] uppercase tracking-[0.06em] mb-2">Type</label>
                <div className="grid grid-cols-5 gap-2">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-[11px] font-medium transition-all ${
                          active
                            ? "border-[#8B00FF] bg-[#F3E8FF] text-[#7E22CE]"
                            : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#D1D5DB] hover:bg-[#FAFAFE]"
                        }`}
                        title={t.label}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="leading-tight text-center">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Start" required>
                  <Input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </Field>
                <Field label="Duration">
                  <Select value={String(durationMin)} onChange={(e) => setDurationMin(Number(e.target.value))}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1h 30 min</option>
                    <option value="120">2 hours</option>
                  </Select>
                </Field>
              </div>

              <Field label="Owner" hint="Defaults to you.">
                <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  <option value="">Me</option>
                  {team.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Notes / agenda" hint="Optional. Type @ to mention a teammate.">
                <MentionTextarea
                  value={notes}
                  onChange={setNotes}
                  rows={3}
                  placeholder="Goals for the meeting, questions to ask..."
                />
              </Field>

              <FormError message={error} />
            </div>

            <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#F8FAFC] flex items-center gap-2">
              <FormButton type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </FormButton>
              <FormButton type="submit" variant="primary" loading={saving} className="flex-1">
                {saving ? "Scheduling..." : "Schedule meeting"}
              </FormButton>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
