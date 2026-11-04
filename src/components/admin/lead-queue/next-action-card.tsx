"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight, CalendarPlus, CheckCircle2, Clock, Info, Mail, MessageSquareReply, Phone, ShieldQuestion, SkipForward, Sparkles, Trophy, UserRound, XCircle,
} from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { whatsappUrl, type ChannelOption, type QueueItem, type QueueKind, type SendChannel } from "@/lib/next-action";
import { cn } from "@/lib/utils";

export const KIND_STYLE: Record<QueueKind, { label: string; dot: string; chip: string }> = {
  reply:              { label: "Reply",        dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-600" },
  reply_review:       { label: "Possible old reply", dot: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-600" },
  enquiry:            { label: "New enquiry",  dot: "bg-blue-500",    chip: "bg-blue-500/10 text-blue-500" },
  follow_up_overdue:  { label: "Overdue",      dot: "bg-red-500",     chip: "bg-red-500/10 text-red-500" },
  follow_up_today:    { label: "Due today",    dot: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-600" },
  follow_up_decision: { label: "Follow-up",    dot: "bg-[#8B00FF]",   chip: "bg-[var(--os-purple-subtle)] text-[var(--os-purple)]" },
  ready:              { label: "Ready",        dot: "bg-[#2f5bff]",   chip: "bg-blue-500/10 text-blue-500" },
};

export type CardAction =
  | "skip" | "details" | "meeting" | "later3" | "later7" | "won" | "lost" | "replied"
  | "not_reply" | "stop" | "enquiry_contacted" | "enquiry_test";

type Props = {
  item: QueueItem;
  position: number;
  total: number;
  busy: boolean;
  onAct: (action: CardAction) => void;
  /** A channel link was clicked: arm the "did you send it?" step. */
  onOpened: (channel: SendChannel) => void;
  /** Replaces the action buttons while a send waits for confirmation. */
  confirm?: React.ReactNode;
};

const primary = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold shadow-sm transition-all active:scale-[0.98] max-sm:w-full";
const quiet = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--os-text-muted)] border border-[var(--os-border)] bg-[var(--os-surface)] hover:bg-[var(--os-hover)] hover:text-[var(--os-text)] transition-colors disabled:opacity-50";

function ChannelButton({ option, onOpened }: { option: ChannelOption; onOpened: (c: SendChannel) => void }) {
  const wa = option.channel === "WHATSAPP";
  const Icon = wa ? FaWhatsapp : FaInstagram;
  return (
    <a
      href={option.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpened(option.channel)}
      className={cn(primary, "text-white", wa ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:opacity-90")}
    >
      <Icon className="w-4 h-4" /> Open {wa ? "WhatsApp" : "Instagram"}
    </a>
  );
}

/** Asks twice, because this closes a prospect. */
function LostButton({ busy, label, onConfirm }: { busy: boolean; label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={cn(quiet, armed && "border-red-500/50 text-red-500 hover:text-red-500")}
    >
      <XCircle className="w-4 h-4" /> {armed ? "Yes, close this lead" : label}
    </button>
  );
}

function Contact({ item, onOpened, onAct }: Pick<Props, "item" | "onOpened" | "onAct">) {
  const trusted = item.channels.filter((c) => c.trusted);
  if (trusted.length > 0) {
    return <>{trusted.map((c) => <ChannelButton key={c.channel} option={c} onOpened={onOpened} />)}</>;
  }
  if (item.channels.length > 0) {
    return (
      <button onClick={() => onAct("details")} className={cn(primary, "border border-dashed border-amber-500/60 text-[var(--os-text)] hover:bg-[var(--os-hover)]")}>
        <ShieldQuestion className="w-4 h-4 text-amber-500" /> Confirm a channel first
      </button>
    );
  }
  return (
    <button onClick={() => onAct("details")} className={cn(primary, "border border-dashed border-[var(--os-border-hover)] text-[var(--os-text)] hover:bg-[var(--os-hover)]")}>
      <UserRound className="w-4 h-4" /> No channel saved. Open details
    </button>
  );
}

function EnquiryActions({ item, busy, onAct }: Pick<Props, "item" | "busy" | "onAct">) {
  const e = item.enquiry!;
  const wa = whatsappUrl({ phone: e.phone });
  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${e.subject}`)}`} className={cn(primary, "text-white bg-gradient-to-r from-[#8B00FF] to-[#2f5bff] hover:opacity-90")}>
          <Mail className="w-4 h-4" /> Reply by email
        </a>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(primary, "text-white bg-emerald-600 hover:bg-emerald-700")}>
            <FaWhatsapp className="w-4 h-4" /> WhatsApp
          </a>
        )}
        {e.phone && (
          <a href={`tel:${e.phone}`} className={cn(primary, "border border-[var(--os-border)] text-[var(--os-text)] hover:bg-[var(--os-hover)]")}>
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button disabled={busy} onClick={() => onAct("enquiry_contacted")} className={quiet}><CheckCircle2 className="w-4 h-4" /> I&apos;ve answered</button>
        <button disabled={busy} onClick={() => onAct("enquiry_test")} className={cn(quiet, e.fromTeamEmail && "border-amber-500/50")}>Mark as internal test</button>
        <Link href={`/admin/leads/${item.id}`} className={quiet}><ArrowUpRight className="w-4 h-4" /> Open enquiry</Link>
      </div>
    </>
  );
}

function SecondaryActions({ item, busy, onAct }: Pick<Props, "item" | "busy" | "onAct">) {
  const later = (
    <>
      <button disabled={busy} onClick={() => onAct("later3")} className={quiet}><Clock className="w-4 h-4" /> In 3 days</button>
      <button disabled={busy} onClick={() => onAct("later7")} className={quiet}><Clock className="w-4 h-4" /> In 7 days</button>
    </>
  );
  switch (item.kind) {
    case "reply":
      return (
        <>
          <button disabled={busy} onClick={() => onAct("meeting")} className={quiet}><CalendarPlus className="w-4 h-4" /> Book meeting</button>
          {later}
          <button disabled={busy} onClick={() => onAct("won")} className={quiet}><Trophy className="w-4 h-4" /> Won</button>
          <LostButton busy={busy} label="Lost" onConfirm={() => onAct("lost")} />
        </>
      );
    case "reply_review":
      return (
        <>
          <button disabled={busy} onClick={() => onAct("replied")} className={quiet}><MessageSquareReply className="w-4 h-4" /> Yes, they replied</button>
          <button disabled={busy} onClick={() => onAct("not_reply")} className={quiet}><XCircle className="w-4 h-4" /> Not a reply</button>
          {later}
        </>
      );
    case "ready":
      return null;
    default:
      return (
        <>
          <button disabled={busy} onClick={() => onAct("replied")} className={quiet}><MessageSquareReply className="w-4 h-4" /> They replied</button>
          {later}
          {item.kind === "follow_up_decision" && <button disabled={busy} onClick={() => onAct("stop")} className={quiet}>No more follow-ups</button>}
          <LostButton busy={busy} label="Not interested" onConfirm={() => onAct("lost")} />
        </>
      );
  }
}

/** The one thing to do now. Everything about it fits on this card. */
export function NextActionCard({ item, position, total, busy, onAct, onOpened, confirm }: Props) {
  const style = KIND_STYLE[item.kind];
  return (
    <motion.section
      key={item.key}
      aria-label="Next action"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] shadow-lg shadow-purple-900/[0.05]"
    >
      <div className="h-1 bg-gradient-to-r from-[#a259ff] via-[#6d3cf5] to-[#2f5bff]" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--os-purple-glow)] blur-3xl pointer-events-none" />
      <div className="relative p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--os-purple)]">
            <Sparkles className="w-3.5 h-3.5" /> Next action
          </span>
          <span className="text-[12px] tabular-nums text-[var(--os-text-muted)]">{position} of {total}</span>
        </div>

        <h2 className="mt-4 text-[24px] sm:text-[30px] leading-[1.15] font-semibold tracking-tight text-[var(--os-text)] break-words">{item.action}</h2>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", style.chip)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} /> {style.label}
          </span>
          <span className="text-[13px] text-[var(--os-text-muted)]">{item.detail}</span>
          {item.meta && <span className="text-[13px] text-[var(--os-text-dim)] truncate max-w-full">· {item.meta}</span>}
        </div>

        <p className="flex items-start gap-2 mt-4 text-[14px] leading-relaxed text-[var(--os-text-muted)]">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-[var(--os-text-muted)]" /> {item.why}
        </p>

        {item.enquiry?.message && (
          <blockquote className="mt-4 rounded-xl border-l-2 border-[var(--os-purple)] bg-[var(--os-surface-2)] px-4 py-3 text-[14px] leading-relaxed text-[var(--os-text)] break-words">
            {item.enquiry.message}
          </blockquote>
        )}

        <div className="mt-6">
          {confirm ?? (
            item.enquiry ? (
              <EnquiryActions item={item} busy={busy} onAct={onAct} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2.5"><Contact item={item} onOpened={onOpened} onAct={onAct} /></div>
                <div className="flex flex-wrap gap-2 mt-4 empty:hidden"><SecondaryActions item={item} busy={busy} onAct={onAct} /></div>
              </>
            )
          )}
        </div>

        {!confirm && (
          <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--os-border)]">
            {item.enquiry ? <span /> : (
              <button onClick={() => onAct("details")} className="text-[13px] font-medium text-[var(--os-text-muted)] hover:text-[var(--os-text)] inline-flex items-center gap-1.5">
                <UserRound className="w-4 h-4" /> Details and notes
              </button>
            )}
            <button onClick={() => onAct("skip")} className="text-[13px] font-medium text-[var(--os-text-muted)] hover:text-[var(--os-text)] inline-flex items-center gap-1.5">
              Skip for now <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}
