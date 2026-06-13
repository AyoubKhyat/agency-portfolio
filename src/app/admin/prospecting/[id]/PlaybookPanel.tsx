"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Send, Check, Loader2, BookOpen, Copy, ChevronDown, ChevronUp, ExternalLink, Sparkles, ClipboardList, X, AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";
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

type MessageVariants = {
  whatsapp_short: string;
  whatsapp_long: string;
  instagram_short: string;
  instagram_long: string;
  rationale: string;
};

type AuditFinding = { observation: string; opportunity: string; recommendation: string };
type AuditResult = { recommendations: AuditFinding[]; conversation_opener: string };

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

const TONES = [
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "FRIENDLY", label: "Friendly" },
  { value: "DIRECT", label: "Direct" },
  { value: "DARIJA_LIGHT", label: "Darija light" },
  { value: "FRENCH_BUSINESS", label: "French business" },
  { value: "ENGLISH", label: "English" },
];

const OBJECTIVES = [
  { value: "GET_REPLY", label: "Get reply" },
  { value: "BOOK_MEETING", label: "Book meeting" },
  { value: "SEND_AUDIT", label: "Send audit" },
  { value: "RECONNECT", label: "Reconnect" },
  { value: "FOLLOW_UP", label: "Follow up" },
];

const FEEDBACK_CHIPS = [
  { value: "TOO_GENERIC", label: "Too generic" },
  { value: "TOO_LONG", label: "Too long" },
  { value: "TOO_SALESY", label: "Too salesy" },
  { value: "MAKE_WARMER", label: "Make it warmer" },
  { value: "MAKE_SHORTER", label: "Make it shorter" },
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

  // AI feature state
  const [generating, setGenerating] = useState<null | "message" | "audit" | "regenerate">(null);
  const [generation, setGeneration] = useState<{ variants: MessageVariants; tone: string; objective: string } | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [tone, setTone] = useState<string>("FRIENDLY");
  const [objective, setObjective] = useState<string>("GET_REPLY");

  // Tracks which variant letter (A/B/C/D) the user picked for logging
  const [pendingVariantLabel, setPendingVariantLabel] = useState<string | null>(null);
  const [pendingTone, setPendingTone] = useState<string | null>(null);
  const [pendingObjective, setPendingObjective] = useState<string | null>(null);

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
          variantLabel: pendingVariantLabel,
          tone: pendingTone,
          objective: pendingObjective,
        }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [{ ...msg, template: templates.find((t) => t.id === selectedTemplate) ? { name: templates.find((t) => t.id === selectedTemplate)!.name, key: templates.find((t) => t.id === selectedTemplate)!.key } : null }, ...prev]);
        setBody("");
        setSelectedTemplate("");
        setShowLogger(false);
        setPendingVariantLabel(null);
        setPendingTone(null);
        setPendingObjective(null);
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

  async function generateMessage(opts?: { feedback?: string; previousAttempt?: string }) {
    if (generating) return;
    setGenerating(opts?.feedback ? "regenerate" : "message");
    setAiError(null);
    try {
      const res = await fetch(`/api/admin/prospecting/${prospect.id}/generate-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: tone === "ENGLISH" ? "en" : "fr",
          tone,
          objective,
          feedback: opts?.feedback ?? null,
          previousAttempt: opts?.previousAttempt ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.message || data.error || `Failed (${res.status})`);
        return;
      }
      setGeneration({ variants: data.variants, tone: data.tone, objective: data.objective });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  }

  async function generateAudit() {
    if (generating) return;
    setGenerating("audit");
    setAiError(null);
    try {
      const res = await fetch(`/api/admin/prospecting/${prospect.id}/generate-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "fr" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.message || data.error || `Failed (${res.status})`);
        return;
      }
      setAuditResult(data.audit);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  }

  function useVariant(text: string, ch: string, variantLabel: string | null = null, srcTone: string | null = null, srcObjective: string | null = null) {
    setBody(text);
    setChannel(ch);
    setShowLogger(true);
    setGeneration(null); // close modal
    setPendingVariantLabel(variantLabel);
    setPendingTone(srcTone);
    setPendingObjective(srcObjective);
    setQualityOverride(false);
    setTimeout(() => document.querySelector('textarea[placeholder*="Paste"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
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

      {/* AI controls — tone + objective selectors */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={!!generating}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--os-border)] bg-white text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          >
            {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">Objective</label>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={!!generating}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--os-border)] bg-white text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
          >
            {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* AI actions */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={() => generateMessage()}
          disabled={!!generating}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium border border-purple-200 bg-purple-50/60 text-[#7C3AED] hover:bg-purple-100/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {generating === "message" || generating === "regenerate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating === "message" ? "Generating..." : generating === "regenerate" ? "Regenerating..." : "Generate Outreach Message"}
        </button>
        <button
          onClick={generateAudit}
          disabled={!!generating}
          className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium border border-purple-200 bg-purple-50/60 text-[#7C3AED] hover:bg-purple-100/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {generating === "audit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
          {generating === "audit" ? "Auditing..." : "Generate Quick Audit"}
        </button>
      </div>

      {aiError && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-[12px] text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">{aiError}</span>
          <button onClick={() => setAiError(null)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

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

            {(pendingVariantLabel || pendingTone) && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <span className="text-[#94A3B8]">Tracking as:</span>
                {pendingVariantLabel && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-100 text-[#7C3AED] font-bold">{pendingVariantLabel}</span>
                )}
                {pendingTone && <span className="text-[#475569]">{TONES.find((t) => t.value === pendingTone)?.label}</span>}
                {pendingObjective && <span className="text-[#94A3B8]">· {OBJECTIVES.find((o) => o.value === pendingObjective)?.label}</span>}
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

      {generation && (
        <MessageVariantsModal
          generation={generation}
          regenerating={generating === "regenerate"}
          onClose={() => setGeneration(null)}
          onUse={(text, ch, label) => useVariant(text, ch, label, generation.tone, generation.objective)}
          onRegenerate={(feedback, previousAttempt) => generateMessage({ feedback, previousAttempt })}
        />
      )}

      {auditResult && (
        <AuditModal
          audit={auditResult}
          onClose={() => setAuditResult(null)}
          onUseOpener={(text) => useVariant(text, "WHATSAPP")}
        />
      )}
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

/* ------------------------- AI: Message variants modal ------------------------- */
function MessageVariantsModal({
  generation,
  regenerating,
  onClose,
  onUse,
  onRegenerate,
}: {
  generation: { variants: MessageVariants; tone: string; objective: string };
  regenerating: boolean;
  onClose: () => void;
  onUse: (text: string, channel: string, label: string) => void;
  onRegenerate: (feedback: string, previousAttempt: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const { variants } = generation;

  // A=ws_short, B=ws_long, C=ig_short, D=ig_long — fixed mapping for A/B testing
  const variantList: Array<{ label: string; key: string; surface: string; channel: string; text: string }> = [
    { label: "A", key: "ws", surface: "WhatsApp · short", channel: "WHATSAPP", text: variants.whatsapp_short },
    { label: "B", key: "wl", surface: "WhatsApp · long", channel: "WHATSAPP", text: variants.whatsapp_long },
    { label: "C", key: "is", surface: "Instagram · short", channel: "INSTAGRAM", text: variants.instagram_short },
    { label: "D", key: "il", surface: "Instagram · long", channel: "INSTAGRAM", text: variants.instagram_long },
  ];

  function regenerate(feedback: string) {
    // Use variant B (WhatsApp long) as the "previous attempt" reference — it's the canonical long-form
    onRegenerate(feedback, variants.whatsapp_long);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--os-border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8B00FF]" />
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A]">Personalized messages</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mt-0.5">
                <span>Tone: {TONES.find((t) => t.value === generation.tone)?.label}</span>
                <span>·</span>
                <span>Objective: {OBJECTIVES.find((o) => o.value === generation.objective)?.label}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto">
          <div className="text-[12px] text-[#64748B] italic border-l-2 border-purple-200 pl-3 py-1">
            {variants.rationale}
          </div>

          {/* Regenerate row */}
          <div className="rounded-xl border border-[var(--os-border)] bg-gray-50/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#64748B] font-medium mb-2">
              <RefreshCw className={cn("w-3 h-3", regenerating && "animate-spin")} />
              Not quite right? Regenerate with feedback
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => regenerate(chip.value)}
                  disabled={regenerating}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-purple-200 bg-white text-[#7C3AED] hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {variantList.map((v) => (
              <div key={v.key} className="rounded-xl border border-[var(--os-border)] bg-white p-3 hover:border-purple-200 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[11px] font-bold">{v.label}</span>
                    <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-medium">{v.surface}</span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] tabular-nums">{v.text.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <p className="text-[12.5px] text-[#0F172A] whitespace-pre-wrap leading-relaxed mb-3">{v.text}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copy(v.text, v.key)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#475569] hover:text-[#0F172A] px-2 py-1 rounded hover:bg-gray-50"
                  >
                    {copied === v.key ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copied === v.key ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => onUse(v.text, v.channel, v.label)}
                    className="inline-flex items-center gap-1 text-[11px] text-white bg-gradient-to-r from-[#8B00FF] to-[#C026D3] px-2.5 py-1 rounded font-medium hover:shadow-md"
                  >
                    Use {v.label} &amp; log
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- AI: Audit modal ------------------------- */
function AuditModal({ audit, onClose, onUseOpener }: { audit: AuditResult; onClose: () => void; onUseOpener: (text: string) => void }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const text = audit.recommendations.map((r, i) =>
      `${i + 1}. ${r.observation}\n   ${r.opportunity}\n   → ${r.recommendation}`
    ).join("\n\n") + "\n\n" + audit.conversation_opener;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--os-border)]">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#8B00FF]" />
            <h2 className="text-lg font-semibold text-[#0F172A]">Quick audit · 3 recommendations</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto">
          <div className="space-y-3">
            {audit.recommendations.map((rec, i) => (
              <div key={i} className="rounded-xl border border-[var(--os-border)] bg-white p-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-[20px] font-bold text-[#8B00FF] tabular-nums leading-none">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium mb-0.5">Observation</div>
                      <p className="text-[13px] text-[#0F172A]">{rec.observation}</p>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium mb-0.5">Opportunity</div>
                      <p className="text-[13px] text-[#475569]">{rec.opportunity}</p>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium mb-0.5">Recommendation</div>
                      <p className="text-[13px] text-[#0F172A] font-medium">{rec.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/40 to-violet-50/40 p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#8B00FF] font-bold mb-2">Suggested conversation opener</div>
            <p className="text-[13px] text-[#0F172A] whitespace-pre-wrap leading-relaxed mb-3">{audit.conversation_opener}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUseOpener(audit.conversation_opener)}
                className="inline-flex items-center gap-1.5 text-[12px] text-white bg-gradient-to-r from-[#8B00FF] to-[#C026D3] px-3 py-1.5 rounded-lg font-medium hover:shadow-md"
              >
                <Send className="w-3 h-3" />
                Use as outreach
              </button>
              <button
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 text-[12px] text-[#475569] hover:text-[#0F172A] px-3 py-1.5 rounded-lg hover:bg-white"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy full audit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
