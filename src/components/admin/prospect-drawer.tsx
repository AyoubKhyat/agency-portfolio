"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Phone,
  Globe,
  MapPin,
  MessageCircle,
  FileText,
  Calendar,
  User,
  Send,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
  Trophy,
  UserPlus,
  Activity,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { Badge } from "@/components/admin/badge";
import { ProposalBuilder } from "@/components/admin/proposal-builder";
import { Input, FormButton } from "@/components/admin/form";
import { MentionTextarea, HighlightedMentions } from "@/components/admin/mention-textarea";
import { ScheduleMeetingModal } from "@/components/admin/schedule-meeting-modal";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROSPECT_SEGMENTS, SEGMENT_LABELS, SEGMENT_HINTS, SEGMENT_TOKENS, calcRelationshipStrength, type ProspectSegment } from "@/lib/prospect-segments";

const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "To Send",
  ENVOYE: "Sent",
  REPONDU: "Replied",
  PAS_DE_WHATSAPP: "No WhatsApp",
  CONVERTI: "Converted",
};

const STATUS_BADGE: Record<string, string> = {
  A_ENVOYER: "blue",
  ENVOYE: "amber",
  REPONDU: "green",
  PAS_DE_WHATSAPP: "red",
  CONVERTI: "purple",
};

const STATUSES = ["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"];

const PRIORITY_LABELS: Record<number, string> = { 1: "IG no site", 2: "No site", 3: "Has site" };

const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect",
  ASSIGNED: "assigned prospect",
  SENT_WHATSAPP: "sent WhatsApp",
  SENT_INSTAGRAM: "sent Instagram DM",
  FOLLOW_UP: "sent follow-up",
  MARKED_REPLIED: "marked as replied",
  MARKED_NO_WHATSAPP: "marked no WhatsApp",
  STATUS_ENVOYE: "changed status to Sent",
  STATUS_REPONDU: "marked as replied",
  STATUS_A_ENVOYER: "reset to To Send",
  STATUS_CONVERTI: "converted to lead",
  STATUS_PAS_DE_WHATSAPP: "marked no WhatsApp",
  SEGMENT_CHANGED: "changed segment",
  NOTE_ADDED: "added a note",
  UPDATED: "updated details",
  BACKFILL_OWNERSHIP: "was attributed to",
  MEETING_BOOKED: "booked a meeting",
  PROPOSAL_SENT: "sent a proposal",
  PROPOSAL_ACCEPTED: "proposal accepted",
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  SENT_WHATSAPP: { bg: "bg-emerald-50", text: "text-emerald-600" },
  SENT_INSTAGRAM: { bg: "bg-pink-50", text: "text-pink-600" },
  FOLLOW_UP: { bg: "bg-sky-50", text: "text-sky-600" },
  MARKED_REPLIED: { bg: "bg-emerald-50", text: "text-emerald-600" },
  STATUS_REPONDU: { bg: "bg-emerald-50", text: "text-emerald-600" },
  ASSIGNED: { bg: "bg-violet-50", text: "text-violet-600" },
  CREATED: { bg: "bg-slate-100", text: "text-slate-600" },
  STATUS_CONVERTI: { bg: "bg-amber-50", text: "text-amber-600" },
  NOTE_ADDED: { bg: "bg-sky-50", text: "text-sky-600" },
  SEGMENT_CHANGED: { bg: "bg-indigo-50", text: "text-indigo-600" },
  MEETING_BOOKED: { bg: "bg-cyan-50", text: "text-cyan-600" },
  PROPOSAL_SENT: { bg: "bg-indigo-50", text: "text-indigo-600" },
  PROPOSAL_ACCEPTED: { bg: "bg-amber-50", text: "text-amber-600" },
  default: { bg: "bg-slate-100", text: "text-slate-500" },
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  SENT_WHATSAPP: MessageCircle,
  SENT_INSTAGRAM: MessageCircle,
  FOLLOW_UP: Send,
  MARKED_REPLIED: CheckCircle,
  ASSIGNED: UserPlus,
  CREATED: Plus,
  STATUS_CONVERTI: Trophy,
  NOTE_ADDED: FileText,
  SEGMENT_CHANGED: Activity,
  MEETING_BOOKED: CalendarIcon,
  PROPOSAL_SENT: FileText,
  PROPOSAL_ACCEPTED: Trophy,
  default: Activity,
};

type Note = {
  id: string;
  content: string;
  authorName: string | null;
  createdAt: string;
};

type ActivityItem = {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  previousStatus: string | null;
  newStatus: string | null;
  details: string | null;
  createdAt: string;
};

type FullProspect = {
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
  segment: ProspectSegment;
  sentAt: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string | null;
  sentByUserId: string | null;
  sentByName: string | null;
  contactedByUserId: string | null;
  contactedByName: string | null;
  contactedAt: string | null;
  lastActionByUserId: string | null;
  lastActionByName: string | null;
  lastActionAt: string | null;
  owner?: { id: string; fullName: string; avatarInitials: string } | null;
  sentByUser?: { id: string; fullName: string; avatarInitials: string } | null;
  notes: Note[];
  activities: ActivityItem[];
};

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
  segment: ProspectSegment;
  sentAt: string | null;
  createdAt: string;
  ownerUserId: string | null;
  sentByName: string | null;
  lastActionByName: string | null;
  lastActionAt: string | null;
  owner?: { id: string; fullName: string; avatarInitials: string } | null;
  notes: { id: string; content: string; createdAt: string }[];
};

type ProspectDrawerProps = {
  prospectId: string | null;
  onClose: () => void;
  onUpdate: (prospect: Prospect) => void;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getFollowUpStatus(followUpDate: string | null): {
  label: string;
  color: string;
} {
  if (!followUpDate) return { label: "No follow-up set", color: "text-[#94A3B8]" };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(followUpDate);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, color: "text-red-600" };
  if (diffDays === 0) return { label: "Due today", color: "text-amber-600" };
  if (diffDays <= 3) return { label: `In ${diffDays} day${diffDays > 1 ? "s" : ""}`, color: "text-blue-600" };
  return { label: `In ${diffDays} days`, color: "text-[#475569]" };
}

function SectionHeader({
  title,
  icon,
  open,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full py-2.5 text-left group"
    >
      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]">
        {icon}
      </div>
      <span className="text-[13px] font-semibold text-[#0F172A] flex-1">{title}</span>
      {open ? (
        <ChevronDown className="w-4 h-4 text-[#94A3B8] group-hover:text-[#475569] transition-colors" />
      ) : (
        <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#475569] transition-colors" />
      )}
    </button>
  );
}

export function ProspectDrawer({ prospectId, onClose, onUpdate }: ProspectDrawerProps) {
  const [prospect, setProspect] = useState<FullProspect | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProposalBuilder, setShowProposalBuilder] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [proposals, setProposals] = useState<{ id: string; status: string; amount: number; currency: string; packageName: string | null; createdAt: string }[]>([]);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [sections, setSections] = useState({
    overview: false,
    assignment: false,
    followUp: false,
    notes: true,
    timeline: true,
  });
  const statusRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchProspect = useCallback(async (id: string) => {
    setLoading(true);
    const [prospectRes, proposalsRes] = await Promise.all([
      fetch(`/api/admin/prospecting/${id}`),
      fetch(`/api/admin/proposals?prospectId=${id}`),
    ]);
    if (prospectRes.ok) setProspect(await prospectRes.json());
    if (proposalsRes.ok) setProposals(await proposalsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (prospectId) {
      fetchProspect(prospectId);
      setNoteText("");
      setShowNoteInput(false);
      setShowStatusDropdown(false);
    } else {
      setProspect(null);
    }
  }, [prospectId, fetchProspect]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (prospectId) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [prospectId, onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    if (showStatusDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showStatusDropdown]);

  useEffect(() => {
    if (showNoteInput && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [showNoteInput]);

  function emitUpdate(updated: FullProspect) {
    onUpdate({
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      whatsappLink: updated.whatsappLink,
      sector: updated.sector,
      neighborhood: updated.neighborhood,
      instagram: updated.instagram,
      hasWebsite: updated.hasWebsite,
      priority: updated.priority,
      status: updated.status,
      segment: updated.segment,
      sentAt: updated.sentAt,
      createdAt: updated.createdAt,
      ownerUserId: updated.ownerUserId,
      sentByName: updated.sentByName,
      lastActionByName: updated.lastActionByName,
      lastActionAt: updated.lastActionAt,
      owner: updated.owner,
      notes: updated.notes.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt })),
    });
  }

  async function handleStatusChange(newStatus: string) {
    if (!prospect) return;
    setShowStatusDropdown(false);
    const res = await fetch(`/api/admin/prospecting/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, actionType: `STATUS_${newStatus}` }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProspect(updated);
      emitUpdate(updated);
    }
  }

  async function handleSegmentChange(newSegment: ProspectSegment) {
    if (!prospect || prospect.segment === newSegment) return;
    const res = await fetch(`/api/admin/prospecting/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment: newSegment }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProspect(updated);
      emitUpdate(updated);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!prospect || !noteText.trim()) return;
    setSavingNote(true);
    const res = await fetch(`/api/admin/prospecting/${prospect.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText }),
    });
    if (res.ok) {
      setNoteText("");
      setShowNoteInput(false);
      const refreshRes = await fetch(`/api/admin/prospecting/${prospect.id}`);
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json();
        setProspect(refreshed);
        emitUpdate(refreshed);
      }
    }
    setSavingNote(false);
  }

  async function handleFollowUpChange(date: string) {
    if (!prospect) return;
    const res = await fetch(`/api/admin/prospecting/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpDate: date || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProspect(updated);
      emitUpdate(updated);
    }
  }

  function handleCopyPhone() {
    if (!prospect?.phone) return;
    navigator.clipboard.writeText(prospect.phone).catch(() => {});
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 2000);
  }

  function toggleSection(key: keyof typeof sections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const followUpStatus = prospect ? getFollowUpStatus(prospect.followUpDate) : null;

  return (
    <>
    <AnimatePresence>
      {prospectId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l border-[#E5E7EB] shadow-2xl z-50 flex flex-col"
          >
            {loading || !prospect ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-7 h-7 text-[#8B00FF] animate-spin" />
                  <p className="text-[13px] text-[#64748B] font-medium">Loading prospect...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Relationship Card — the premium summary at the top of the drawer */}
                {(() => {
                  const tokens = SEGMENT_TOKENS[prospect.segment];
                  const strength = calcRelationshipStrength({ segment: prospect.segment, status: prospect.status, lastActionAt: prospect.lastActionAt });
                  const potentialRevenue = proposals.reduce((sum, p) => p.status !== "REJECTED" ? sum + p.amount : sum, 0);
                  const currency = proposals[0]?.currency ?? "MAD";
                  const followUpLabel = getFollowUpStatus(prospect.followUpDate).label;
                  return (
                    <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#E5E7EB]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium border", tokens.chipBg, tokens.chipText, tokens.chipBorder)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", tokens.dot)} />
                              {SEGMENT_LABELS[prospect.segment]}
                            </span>
                            <Badge
                              variant={STATUS_BADGE[prospect.status] as "blue" | "amber" | "green" | "red" | "purple"}
                              size="sm"
                              dot
                            >
                              {STATUS_LABELS[prospect.status]}
                            </Badge>
                          </div>
                          <h2 className="mt-2 text-[19px] font-semibold text-[#0F172A] tracking-tight truncate">{prospect.name}</h2>
                          <p className="text-[12px] text-[#64748B] mt-0.5">
                            {prospect.sector}
                            {prospect.neighborhood && <span className="text-[#CBD5E1]"> · </span>}
                            {prospect.neighborhood}
                          </p>
                        </div>
                        <button
                          onClick={onClose}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
                          aria-label="Close"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Metric grid — 5 signals, muted tone-on-tone */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#F1F5F9] px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8] font-medium">Strength</div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div className={cn("h-full rounded-full", tokens.dot)} style={{ width: `${strength}%` }} />
                            </div>
                            <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums">{strength}</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-[#F1F5F9] px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8] font-medium">Stage</div>
                          <div className="mt-1 text-[13px] text-[#0F172A] font-medium">{STATUS_LABELS[prospect.status] ?? prospect.status}</div>
                        </div>
                        <div className="rounded-lg border border-[#F1F5F9] px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8] font-medium">Last activity</div>
                          <div className="mt-1 text-[13px] text-[#0F172A] font-medium">{prospect.lastActionAt ? relativeTime(prospect.lastActionAt) : <span className="text-[#94A3B8]">Never</span>}</div>
                        </div>
                        <div className="rounded-lg border border-[#F1F5F9] px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8] font-medium">Next follow-up</div>
                          <div className="mt-1 text-[13px] text-[#0F172A] font-medium">{prospect.followUpDate ? followUpLabel : <span className="text-[#94A3B8]">None</span>}</div>
                        </div>
                        <div className="rounded-lg border border-[#F1F5F9] px-2.5 py-2 col-span-2">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8] font-medium">Potential revenue</div>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-[15px] font-semibold text-[#0F172A] tabular-nums">
                              {potentialRevenue > 0 ? potentialRevenue.toLocaleString() : "—"}
                            </span>
                            {potentialRevenue > 0 && <span className="text-[11px] text-[#94A3B8]">{currency}</span>}
                            {proposals.length > 0 && (
                              <span className="ml-auto text-[10.5px] text-[#94A3B8]">
                                {proposals.length} proposal{proposals.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Segment picker — sits below the card, kept close for quick re-triage */}
                      <div className="mt-4">
                        <label htmlFor={`segment-${prospect.id}`} className="block text-[10px] uppercase tracking-[0.14em] text-[#94A3B8] font-medium mb-1.5">
                          Segment
                        </label>
                        <select
                          id={`segment-${prospect.id}`}
                          value={prospect.segment}
                          onChange={(e) => handleSegmentChange(e.target.value as ProspectSegment)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/10 focus:border-[#CBD5E1] transition-all"
                        >
                          {PROSPECT_SEGMENTS.map((s) => (
                            <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10.5px] text-[#94A3B8] leading-snug">
                          {SEGMENT_HINTS[prospect.segment]}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="shrink-0 px-5 py-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={prospect.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      title="WhatsApp"
                    >
                      <FaWhatsapp className="w-4 h-4" />
                    </a>
                    {prospect.instagram && (
                      <a
                        href={`https://ig.me/m/${prospect.instagram.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                        title="Instagram DM"
                      >
                        <FaInstagram className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={handleCopyPhone}
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-xl transition-colors",
                        phoneCopied
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                      )}
                      title={phoneCopied ? "Copied!" : "Copy phone"}
                    >
                      {phoneCopied ? <CheckCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setShowNoteInput(!showNoteInput);
                        setShowStatusDropdown(false);
                      }}
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-xl transition-colors",
                        showNoteInput
                          ? "bg-gradient-to-r from-[#8B00FF]/15 to-[#C026D3]/15 text-[#8B00FF]"
                          : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                      )}
                      title="Add note"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowScheduleMeeting(true)}
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="Schedule meeting"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowProposalBuilder(true)}
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition-colors"
                      title="Create proposal"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <div ref={statusRef} className="relative">
                      <button
                        onClick={() => {
                          setShowStatusDropdown(!showStatusDropdown);
                          setShowNoteInput(false);
                        }}
                        className={cn(
                          "flex items-center justify-center w-9 h-9 rounded-xl transition-colors",
                          showStatusDropdown
                            ? "bg-gradient-to-r from-[#8B00FF]/15 to-[#C026D3]/15 text-[#8B00FF]"
                            : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                        )}
                        title="Change status"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      {showStatusDropdown && (
                        <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 z-10">
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(s)}
                              className={cn(
                                "w-full px-3 py-2 text-left text-[13px] transition-colors flex items-center gap-2",
                                prospect.status === s
                                  ? "bg-[#F8FAFC] text-[#8B00FF] font-medium"
                                  : "text-[#475569] hover:bg-[#F8FAFC]"
                              )}
                            >
                              {prospect.status === s && (
                                <CheckCircle className="w-3.5 h-3.5 text-[#8B00FF]" />
                              )}
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="px-5 py-4 space-y-1">
                    <SectionHeader
                      title="Overview"
                      icon={<Globe className="w-3.5 h-3.5" />}
                      open={sections.overview}
                      onToggle={() => toggleSection("overview")}
                    />
                    {sections.overview && (
                      <div className="pb-3 space-y-2.5 pl-8">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Sector</p>
                            <p className="text-[13px] text-[#0F172A] font-medium">{prospect.sector}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">City</p>
                            <p className="text-[13px] text-[#0F172A]">
                              {prospect.neighborhood || <span className="text-[#94A3B8]">--</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Phone</p>
                            <p className="text-[13px] text-[#0F172A]">{prospect.phone || <span className="text-[#94A3B8]">--</span>}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">WhatsApp</p>
                            <a
                              href={prospect.whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] text-green-600 hover:text-green-700 transition-colors truncate block"
                            >
                              Open link
                            </a>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Instagram</p>
                            {prospect.instagram ? (
                              <a
                                href={`https://instagram.com/${prospect.instagram.replace(/^@/, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] text-purple-600 hover:text-purple-700 transition-colors"
                              >
                                @{prospect.instagram.replace(/^@/, "")}
                              </a>
                            ) : (
                              <span className="text-[13px] text-[#94A3B8]">--</span>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Website</p>
                            <p className="text-[13px] font-medium">
                              {prospect.hasWebsite ? (
                                <span className="text-emerald-600">Yes</span>
                              ) : (
                                <span className="text-red-500">No</span>
                              )}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Priority</p>
                            <p className="text-[13px] text-[#0F172A] font-medium">{PRIORITY_LABELS[prospect.priority] || `P${prospect.priority}`}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-[#F1F5F9]" />

                    <SectionHeader
                      title="Assignment"
                      icon={<User className="w-3.5 h-3.5" />}
                      open={sections.assignment}
                      onToggle={() => toggleSection("assignment")}
                    />
                    {sections.assignment && (
                      <div className="pb-3 space-y-3 pl-8">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-[#64748B]">Owner</p>
                          {prospect.owner ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[10px] font-bold">
                                {prospect.owner.avatarInitials}
                              </span>
                              <span className="text-[13px] font-medium text-[#0F172A]">{prospect.owner.fullName}</span>
                            </div>
                          ) : (
                            <span className="text-[13px] text-[#94A3B8] italic">Unassigned</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-[#64748B]">Sent By</p>
                          {prospect.sentByUser ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[10px] font-bold">
                                {prospect.sentByUser.avatarInitials}
                              </span>
                              <span className="text-[13px] font-medium text-[#0F172A]">{prospect.sentByUser.fullName}</span>
                            </div>
                          ) : (
                            <span className="text-[13px] text-[#94A3B8]">{prospect.sentByName || "Not sent yet"}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-[#64748B]">First Contact</p>
                          <div className="text-right">
                            {prospect.contactedByName ? (
                              <>
                                <p className="text-[13px] font-medium text-[#0F172A]">{prospect.contactedByName}</p>
                                {prospect.contactedAt && (
                                  <p className="text-[11px] text-[#94A3B8]">{relativeTime(prospect.contactedAt)}</p>
                                )}
                              </>
                            ) : (
                              <span className="text-[13px] text-[#94A3B8]">Not yet</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-[#64748B]">Last Action</p>
                          <div className="text-right">
                            {prospect.lastActionByName ? (
                              <>
                                <p className="text-[13px] font-medium text-[#0F172A]">{prospect.lastActionByName}</p>
                                {prospect.lastActionAt && (
                                  <p className="text-[11px] text-[#94A3B8]">{relativeTime(prospect.lastActionAt)}</p>
                                )}
                              </>
                            ) : (
                              <span className="text-[13px] text-[#94A3B8]">None</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-[#F1F5F9]" />

                    <SectionHeader
                      title="Follow-up"
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      open={sections.followUp}
                      onToggle={() => toggleSection("followUp")}
                    />
                    {sections.followUp && (
                      <div className="pb-3 pl-8 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={prospect.followUpDate ? prospect.followUpDate.split("T")[0] : ""}
                            onChange={(e) => handleFollowUpChange(e.target.value)}
                            className="h-10 text-[13px]"
                          />
                          {prospect.followUpDate && (
                            <button
                              type="button"
                              onClick={() => handleFollowUpChange("")}
                              className="p-2 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                              title="Clear follow-up"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {followUpStatus && (
                          <div className="flex items-center gap-2">
                            {followUpStatus.color === "text-red-600" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                            )}
                            <span className={cn("text-[12px] font-medium", followUpStatus.color)}>
                              {followUpStatus.label}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {proposals.length > 0 && (
                      <>
                        <div className="border-t border-[#F1F5F9]" />
                        <div className="px-5 py-3">
                          <h4 className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Proposals</h4>
                          <div className="space-y-2">
                            {proposals.map((p) => (
                              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                                <div>
                                  <span className="text-[13px] font-medium text-[#0F172A]">{p.packageName || "Custom"}</span>
                                  <span className="text-[13px] text-[#64748B] ml-2">{p.amount.toLocaleString()} {p.currency}</span>
                                </div>
                                <Badge variant={p.status === "ACCEPTED" ? "green" : p.status === "SENT" ? "blue" : p.status === "REJECTED" ? "red" : "default"} size="sm">{p.status}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="border-t border-[#F1F5F9]" />

                    <SectionHeader
                      title="Notes"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      open={sections.notes}
                      onToggle={() => toggleSection("notes")}
                    />
                    {sections.notes && (
                      <div className="pb-3 pl-8 space-y-3">
                        {showNoteInput && (
                          <form onSubmit={handleAddNote} className="space-y-2.5">
                            <MentionTextarea
                              ref={noteInputRef}
                              value={noteText}
                              onChange={setNoteText}
                              placeholder="Write a note... type @ to mention a teammate."
                              rows={3}
                              className="text-[13px] min-h-[80px]"
                            />
                            <div className="flex items-center gap-2">
                              <FormButton
                                type="submit"
                                size="sm"
                                variant="primary"
                                disabled={!noteText.trim()}
                                loading={savingNote}
                                icon={!savingNote ? <Send className="w-3.5 h-3.5" /> : undefined}
                              >
                                {savingNote ? "Saving..." : "Save note"}
                              </FormButton>
                              <FormButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                              >
                                Cancel
                              </FormButton>
                            </div>
                          </form>
                        )}
                        {!showNoteInput && (
                          <button
                            onClick={() => setShowNoteInput(true)}
                            className="flex items-center gap-1.5 text-[12px] text-[#8B00FF] hover:text-[#7600D6] font-medium transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add note
                          </button>
                        )}
                        {prospect.notes.length === 0 ? (
                          <p className="text-[13px] text-[#94A3B8]">No notes yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {prospect.notes.map((note) => (
                              <div key={note.id} className="p-3 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg">
                                <HighlightedMentions
                                  text={note.content}
                                  className="text-[13px] text-[#475569] whitespace-pre-wrap leading-relaxed block"
                                />
                                <div className="flex items-center gap-2 mt-1.5">
                                  {note.authorName && (
                                    <span className="text-[11px] font-medium text-[#475569]">{note.authorName}</span>
                                  )}
                                  <span className="text-[11px] text-[#94A3B8]">{relativeTime(note.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border-t border-[#F1F5F9]" />

                    <SectionHeader
                      title="Timeline"
                      icon={<Clock className="w-3.5 h-3.5" />}
                      open={sections.timeline}
                      onToggle={() => toggleSection("timeline")}
                    />
                    {sections.timeline && (() => {
                      // Unified timeline — activities + proposals + creation event, sorted newest first.
                      // Reuses existing data (no schema change, no new fetch).
                      type TimelineEvent = {
                        id: string;
                        at: string;
                        kind: string;         // maps to ACTION_ICONS / ACTION_COLORS
                        actor: string | null;
                        label: string;
                        detail?: string;
                      };
                      const events: TimelineEvent[] = [];
                      for (const a of prospect.activities ?? []) {
                        events.push({
                          id: `a-${a.id}`,
                          at: a.createdAt,
                          kind: a.actionType,
                          actor: a.userName,
                          label: ACTION_LABELS[a.actionType] ?? a.actionType.replace(/_/g, " ").toLowerCase(),
                          detail: a.details ?? undefined,
                        });
                      }
                      for (const pr of proposals) {
                        events.push({
                          id: `p-${pr.id}`,
                          at: pr.createdAt,
                          kind: pr.status === "ACCEPTED" ? "PROPOSAL_ACCEPTED" : "PROPOSAL_SENT",
                          actor: null,
                          label: pr.status === "ACCEPTED" ? "proposal accepted" : "proposal sent",
                          detail: `${pr.packageName ?? "Custom"} · ${pr.amount.toLocaleString()} ${pr.currency}`,
                        });
                      }
                      events.push({
                        id: "created",
                        at: prospect.createdAt,
                        kind: "CREATED",
                        actor: null,
                        label: "created",
                      });
                      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

                      if (events.length === 0) {
                        return <div className="pb-3 pl-8"><p className="text-[13px] text-[#94A3B8]">No activity yet.</p></div>;
                      }
                      return (
                        <div className="pb-3 pl-8">
                          <div className="relative">
                            {events.map((e, idx) => {
                              const colors = ACTION_COLORS[e.kind] || ACTION_COLORS.default;
                              const IconComponent = ACTION_ICONS[e.kind] || ACTION_ICONS.default;
                              const isLast = idx === events.length - 1;
                              return (
                                <div key={e.id} className="flex gap-3 pb-3.5 relative">
                                  {!isLast && (
                                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[#F1F5F9]" />
                                  )}
                                  <div
                                    className={cn(
                                      "flex items-center justify-center w-[22px] h-[22px] rounded-full shrink-0 border border-white shadow-[0_0_0_1px_rgba(226,232,240,0.9)]",
                                      colors.bg,
                                      colors.text,
                                    )}
                                  >
                                    <IconComponent className="w-3 h-3" />
                                  </div>
                                  <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <p className="text-[12.5px] text-[#0F172A] leading-snug">
                                        {e.actor && <span className="font-semibold">{e.actor}</span>}
                                        {e.actor && " "}
                                        <span className="text-[#475569]">{e.label}</span>
                                      </p>
                                      <span className="text-[10.5px] text-[#94A3B8] tabular-nums ml-auto">{relativeTime(e.at)}</span>
                                    </div>
                                    {e.detail && (
                                      <p className={cn("text-[11.5px] mt-0.5 leading-snug", e.kind === "NOTE_ADDED" ? "text-[#64748B] italic" : "text-[#64748B]")}>
                                        {e.kind === "NOTE_ADDED" ? `“${e.detail}”` : e.detail}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
    {showProposalBuilder && prospect && (
      <ProposalBuilder
        prospectId={prospect.id}
        prospectName={prospect.name}
        sector={prospect.sector}
        onClose={() => setShowProposalBuilder(false)}
        onCreated={() => { fetchProspect(prospect.id); }}
      />
    )}
    {prospect && (
      <ScheduleMeetingModal
        open={showScheduleMeeting}
        onClose={() => setShowScheduleMeeting(false)}
        onCreated={() => { setShowScheduleMeeting(false); fetchProspect(prospect.id); }}
        context={{ kind: "prospect", prospectId: prospect.id, label: prospect.name }}
      />
    )}
    </>
  );
}
