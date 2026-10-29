"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Send, Check, Loader2, BookOpen, Copy, ChevronDown, ChevronUp, ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { analyzeMessage, hasBlockingError, type Warning } from "@/lib/message-quality";

type ProspectLite = {
  id: string;
  name: string;
  sector: string;
  neighborhood: string;
  instagram: string;
  whatsappLink: string;
  hasWebsite: boolean;
  score?: number | null;
  scoreLabel?: "HIGH" | "MEDIUM" | "LOW" | null;
};

type SequenceState = {
  initial: { done: boolean; at: string | null };
  followup1: { done: boolean; at: string | null };
  followup2: { done: boolean; at: string | null };
  followup3: { done: boolean; at: string | null };
};

type Template = {
  id: string;
  key: string;
  name: string;
  channel: string;
  body: string;
  language: string;
};

type OutreachMessage = {
  id: string;
  channel: string;
  body: string;
  sentAt: string;
  sentByName: string;
  replied: boolean;
  repliedAt: string | null;
  replyReason: string | null;
  meetingBooked: boolean;
  template: { name: string; key: string } | null;
};

const REPLY_REASONS = [
  { value: "MEETING_REQUESTED", label: "Wants a meeting" },
  { value: "PROPOSAL_REQUESTED", label: "Wants a proposal" },
  { value: "INTERESTED", label: "Interested" },
  { value: "LATER", label: "Call later" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "HAS_PROVIDER", label: "Already has provider" },
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "NO_BUDGET", label: "No budget" },
];

const STEP_LABELS = {
  initial: "Day 1 — Initial contact",
  followup1: "Day 4 — First follow-up",
  followup2: "Day 10 — Second follow-up",
  followup3: "Day 20 — Final follow-up",
};

const SCORE_BADGE: Record<string, string> = {
  HIGH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-gray-50 text-gray-600 border-gray-200",
};

function renderTemplate(body: string, prospect: ProspectLite): string {
  return body
    .replace(/\{\{\s*name\s*\}\}/gi, prospect.name)
    .replace(/\{\{\s*sector\s*\}\}/gi, prospect.sector)
    .replace(/\{\{\s*city\s*\}\}/gi, prospect.neighborhood || "Marrakech")
    .replace(/\{\{\s*instagram\s*\}\}/gi, prospect.instagram || "");
}

export function PlaybookPanel({ prospect, onScoreUpdated }: { prospect: ProspectLite; onScoreUpdated?: (score: number, label: string) => void }) {
  const [sequence, setSequence] = useState<SequenceState | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [logging, setLogging] = useState(false);
  const [showLogger, setShowLogger] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("WHATSAPP");
  const [scoring, setScoring] = useState(false);

  // Quality guard
  const [qualityOverride, setQualityOverride] = useState(false);
  const qualityWarnings: Warning[] = useMemo(
    () => (body.trim() ? analyzeMessage(body, {
      name: prospect.name,
      sector: prospect.sector,
      neighborhood: prospect.neighborhood,
      instagram: prospect.instagram,
    }) : []),
    [body, prospect.name, prospect.sector, prospect.neighborhood, prospect.instagram]
  );
  const hasErrors = hasBlockingError(qualityWarnings);

  const load = useCallback(async () => {
    const [seqRes, tplRes, msgRes] = await Promise.all([
      fetch(`/api/admin/prospecting/${prospect.id}/sequence`),
      fetch("/api/admin/sales-playbook/templates"),
      fetch(`/api/admin/prospecting/${prospect.id}/outreach`),
    ]);
    if (seqRes.ok) setSequence(await seqRes.json());
    if (tplRes.ok) setTemplates(await tplRes.json());
    if (msgRes.ok) setMessages(await msgRes.json());
  }, [prospect.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleStep(step: keyof SequenceState) {
    if (!sequence) return;
    const next = !sequence[step].done;
    const res = await fetch(`/api/admin/prospecting/${prospect.id}/sequence`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, done: next }),
    });
    if (res.ok) {
      setSequence(await res.json());
      recomputeScore();
    }
  }

  function onTemplateChange(id: string) {
    setSelectedTemplate(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setBody(renderTemplate(t.body, prospect));
      setChannel(t.channel);
    }
  }

  async function handleLog() {
    if (!body.trim() || logging) return;
    if (hasErrors && !qualityOverride) return;
    setLogging(true);
    try {
      const res = await fetch(`/api/admin/prospecting/${prospect.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate || null,
          channel,
          body,
        }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [{ ...msg, template: templates.find((t) => t.id === selectedTemplate) ? { name: templates.find((t) => t.id === selectedTemplate)!.name, key: templates.find((t) => t.id === selectedTemplate)!.key } : null }, ...prev]);
        setBody("");
        setSelectedTemplate("");
        setShowLogger(false);
        setQualityOverride(false);
        load(); // refresh sequence (initial contact may be auto-set)
        recomputeScore();
      }
    } finally {
      setLogging(false);
    }
  }

  async function markReplied(messageId: string, replied: boolean, replyReason: string | null = null) {
    const res = await fetch(`/api/admin/prospecting/${prospect.id}/outreach`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, replied, replyReason }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, ...updated } : m));
      recomputeScore();
    }
  }

  async function recomputeScore() {
    if (scoring) return;
    setScoring(true);
    try {
      const res = await fetch(`/api/admin/prospecting/${prospect.id}/score`, { method: "POST" });
      if (res.ok && onScoreUpdated) {
        const data = await res.json();
        onScoreUpdated(data.score, data.scoreLabel);
      }
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#8B00FF]" />
          <h2 className="text-[15px] font-semibold text-gray-900">Sales Playbook</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {prospect.scoreLabel && (
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border",
              SCORE_BADGE[prospect.scoreLabel]
            )}>
              {prospect.scoreLabel} priority · {prospect.score ?? 0}
            </span>
          )}
          <button
            onClick={recomputeScore}
            disabled={scoring}
            className="text-[11px] text-[#8B00FF] hover:text-[#7C3AED] inline-flex items-center gap-1 disabled:opacity-50"
          >
            {scoring && <Loader2 className="w-3 h-3 animate-spin" />}
            Recompute
          </button>
          <Link href="/admin/sales-playbook" className="text-[11px] text-[#475569] hover:text-[#8B00FF] inline-flex items-center gap-1">
            Playbook
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Sequence */}
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-2">Outreach sequence</div>
        <div className="space-y-1.5">
          {sequence ? (Object.keys(STEP_LABELS) as Array<keyof SequenceState>).map((step) => {
            const s = sequence[step];
            return (
              <button
                key={step}
                onClick={() => toggleStep(step)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all border",
                  s.done
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                    : "bg-gray-50/60 border-gray-200 text-[#475569] hover:bg-gray-100/80"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                  s.done ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
                )}>
                  {s.done && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-[12.5px] font-medium flex-1">{STEP_LABELS[step]}</span>
                {s.at && (
                  <span className="text-[10.5px] text-emerald-700 font-medium tabular-nums">
                    {new Date(s.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </button>
            );
          }) : (
            <div className="os-skeleton h-32 rounded-xl" />
          )}
        </div>
      </div>

      {/* Log outreach */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium">Outreach log</div>
          <button
            onClick={() => setShowLogger((v) => !v)}
            className="text-[11px] text-[#8B00FF] hover:text-[#7C3AED] inline-flex items-center gap-1"
          >
            {showLogger ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showLogger ? "Hide" : "Log a message"}
          </button>
        </div>

        {showLogger && (
          <div className="space-y-2 mb-3 p-3 rounded-xl border border-purple-200 bg-purple-50/30">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedTemplate}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--os-border)] bg-white text-[12px] text-[#0F172A] focus:outline-none"
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                ))}
              </select>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--os-border)] bg-white text-[12px] text-[#0F172A] focus:outline-none"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="EMAIL">Email</option>
                <option value="CALL">Call</option>
              </select>
            </div>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setQualityOverride(false); }}
              className="w-full px-2.5 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[12.5px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300 h-32 font-sans resize-none"
              placeholder="Paste or write the exact message you sent..."
            />

            {/* Quality guard */}
            {qualityWarnings.length > 0 && (
              <div className={cn(
                "rounded-lg border p-2.5",
                hasErrors ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40"
              )}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldAlert className={cn("w-3.5 h-3.5", hasErrors ? "text-red-600" : "text-amber-600")} />
                  <span className={cn("text-[11px] font-semibold uppercase tracking-wider", hasErrors ? "text-red-700" : "text-amber-700")}>
                    Quality check
                  </span>
                </div>
                <ul className="space-y-1">
                  {qualityWarnings.map((w) => (
                    <li key={w.kind} className="text-[11.5px] text-[#475569] flex items-start gap-1.5">
                      <span className={cn("w-1 h-1 rounded-full mt-1.5 shrink-0", w.severity === "error" ? "bg-red-500" : "bg-amber-500")} />
                      <span><span className="font-medium text-[#0F172A]">{w.label}.</span> {w.detail}</span>
                    </li>
                  ))}
                </ul>
                {hasErrors && (
                  <label className="flex items-center gap-2 mt-2 text-[11px] text-[#64748B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qualityOverride}
                      onChange={(e) => setQualityOverride(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-300"
                    />
                    Log anyway — I know what I&apos;m doing
                  </label>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => body && navigator.clipboard.writeText(body)}
                disabled={!body}
                className="text-[11px] text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1 disabled:opacity-40"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
              <button
                onClick={handleLog}
                disabled={logging || !body.trim() || (hasErrors && !qualityOverride)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm disabled:opacity-50"
              >
                {logging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {logging ? "Logging..." : "Log as sent"}
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <p className="text-[12px] text-[#94A3B8]">No outreach logged yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.slice(0, 5).map((m) => (
              <div key={m.id} className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-medium text-[#0F172A]">{m.sentByName}</span>
                    <span className="text-[#64748B]">·</span>
                    <span className="text-[#64748B]">{m.channel.toLowerCase()}</span>
                    {m.template && (
                      <>
                        <span className="text-[#64748B]">·</span>
                        <span className="text-[#7C3AED]">{m.template.name}</span>
                      </>
                    )}
                    <span className="text-[#94A3B8]">{new Date(m.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                  </div>
                  <ReplyButton message={m} onUpdate={(replied, reason) => markReplied(m.id, replied, reason)} />
                </div>
                <p className="text-[12px] text-[#475569] whitespace-pre-wrap line-clamp-3">{m.body}</p>
              </div>
            ))}
            {messages.length > 5 && (
              <div className="text-[11px] text-[#64748B] text-center">+ {messages.length - 5} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- ReplyButton ------------------------- */
function ReplyButton({ message, onUpdate }: { message: OutreachMessage; onUpdate: (replied: boolean, reason: string | null) => void }) {
  const [open, setOpen] = useState(false);

  if (message.replied) {
    const reasonLabel = REPLY_REASONS.find((r) => r.value === message.replyReason)?.label;
    return (
      <button
        onClick={() => onUpdate(false, null)}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-50"
        title="Click to mark as not replied"
      >
        Replied{reasonLabel ? ` · ${reasonLabel}` : ""}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-[#64748B] hover:bg-emerald-50 hover:text-emerald-700"
      >
        Mark replied
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-[var(--os-border)] bg-white shadow-lg py-1">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium">Why?</div>
          {REPLY_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => { onUpdate(true, r.value); setOpen(false); }}
              className="block w-full text-left px-2 py-1 text-[12px] text-[#0F172A] hover:bg-purple-50"
            >
              {r.label}
            </button>
          ))}
          <div className="border-t border-[var(--os-border)] my-1" />
          <button
            onClick={() => { onUpdate(true, null); setOpen(false); }}
            className="block w-full text-left px-2 py-1 text-[11px] text-[#64748B] hover:bg-gray-50"
          >
            Skip (no reason)
          </button>
        </div>
      )}
    </div>
  );
}
