"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CircleHelp, Copy, ExternalLink, Sparkles, X } from "lucide-react";
import { FormButton, FormCard, Field, Input, Textarea, Select } from "@/components/admin/form";
import { SendConfirm } from "@/components/admin/send-confirm";
import { buildSendLink, whatsappDigits, type DiagnosisChannel } from "@/lib/ai-workforce/send-link";
import { analyzeMessage } from "@/lib/message-quality";

type Evidence = { id: string; check: string; status: "pass" | "fail" | "unknown"; observed: string; sourceUrl: string };
type Finding = { title: string; explanation: string; recommendation: string; evidenceIds: string[] };
type Run = {
  id: string;
  status: string;
  targetUrl: string;
  finalUrl: string | null;
  evidence: Evidence[];
  findings: Finding[] | null;
  duplicateStatus: string | null;
  duplicateReason: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  approvedSubject: string | null;
  approvedBody: string | null;
  channel: DiagnosisChannel | null;
  errorCode: string | null;
  startedByName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  sentConfirmedByName: string | null;
  createdAt: string;
};
type State = {
  eligible: boolean;
  enabled: boolean;
  aiEnabled: boolean;
  usage: { runsInWindow: number; dailyRunCap: number };
  viewer: { canAct: boolean; isOwner: boolean };
  runs: Run[];
};

const WHY: Record<string, string> = {
  AI_DISABLED: "AI drafting is off, so this run is the automatic checks only.",
  NO_API_KEY: "The AI Workforce key isn't set up, so this run is the automatic checks only.",
  REDIRECT_TOO_LONG: "This site redirects to an address too long to follow, so it wasn't read. Check it by hand.",
  BUDGET_EXHAUSTED: "This month's AI budget is used up, so this run is the automatic checks only.",
  KILL_SWITCH: "AI Workforce was switched off during this run, so no draft was written.",
  ROBOTS_DISALLOWED: "This site asks automated tools not to read this page, so it wasn't read. Check it by hand.",
  ROBOTS_UNREACHABLE: "This site's robots.txt returned an error, so the page wasn't read. Check it by hand.",
  AI_VALIDATION: "The AI's answer failed the evidence checks, so it was thrown away. Use the evidence below.",
  AI_REFUSED: "The AI declined this request, so there is no draft. Use the evidence below.",
  AI_TRUNCATED: "The AI's answer was cut off, so it was thrown away. Use the evidence below.",
  AI_ERROR: "The AI request failed, so there is no draft. Use the evidence below.",
  AI_CONNECTION: "The AI request didn't finish, so there is no draft. Use the evidence below.",
  INTERNAL: "Something went wrong during this run. Nothing was sent.",
  STALE: "This run never finished. Nothing was sent.",
};

function StatusIcon({ status }: { status: Evidence["status"] }) {
  if (status === "pass") return <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-label="Pass" />;
  if (status === "fail") return <X className="w-4 h-4 text-red-600 shrink-0" aria-label="Fail" />;
  return <CircleHelp className="w-4 h-4 text-[#94A3B8] shrink-0" aria-label="Unknown" />;
}

/** Shown on a website diagnosis enquiry. Drafts need a person's approval, and the app itself never sends. */
export function DiagnosisPanel({ leadId, email, phone, fullName, onSent }: {
  leadId: string;
  email: string;
  phone: string | null;
  fullName: string;
  onSent: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<DiagnosisChannel>("EMAIL");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/leads/${leadId}/diagnosis`);
    if (!res.ok) return;
    const data: State = await res.json();
    setState(data);
    const latest = data.runs.find((r) => r.status !== "DENIED");
    setSubject(latest?.draftSubject ?? "");
    setBody(latest?.draftBody ?? "");
    if (latest?.channel) setChannel(latest.channel);
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads this enquiry's runs once on open
    void load();
  }, [load]);

  async function start(retryOfRunId?: string) {
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}/diagnosis`, {
      method: "POST",
      ...(retryOfRunId ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retryOfRunId }) } : {}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : "Couldn't start the check.");
    }
    await load();
    setRunning(false);
  }

  async function act(run: Run, payload: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}/diagnosis/${run.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.error === "quality") setError(`Fix before approving: ${(data.detail ?? []).join(", ")}.`);
      else if (data?.error === "no_phone") setError("This enquiry has no usable phone number for WhatsApp.");
      else if (data?.error === "wrong_state") {
        // Show the current version. The confirmation closes, because it was about the old one.
        setError("This draft changed somewhere else. The latest version is shown below: check it before going on.");
        setConfirming(false);
        await load();
      } else setError("Couldn't save that.");
      return false;
    }
    await load();
    return true;
  }

  if (!state?.eligible) return null;
  const run = state.runs.find((r) => r.status !== "DENIED") ?? null;
  const { canAct, isOwner } = state.viewer;
  const capLeft = state.enabled && !running && state.usage.runsInWindow < state.usage.dailyRunCap;
  const canStart = canAct && capLeft;
  const canRetry = isOwner && capLeft && run?.status === "FAILED";
  const editable = canAct && run && ["AUDIT_ONLY", "DRAFT_READY"].includes(run.status);
  const approved = canAct && run?.status === "APPROVED";
  const warnings = editable && body ? analyzeMessage(body, { name: fullName }) : [];
  const sendLink = approved && run?.channel ? buildSendLink(run.channel, { email, phone }, run.approvedSubject ?? "", run.approvedBody ?? "") : null;
  const channelLabel = run?.channel === "WHATSAPP" ? "WhatsApp" : "Email";
  const failing = run?.evidence.filter((e) => e.status === "fail").length ?? 0;

  return (
    <FormCard
      title="Website diagnosis"
      subtitle="Automatic checks on one page, and a reply draft for you to review. Nothing is sent by the app."
      icon={<Sparkles className="w-4 h-4" />}
      action={canAct ? (
        canRetry ? (
          <FormButton variant="primary" onClick={() => start(run?.id)}>Retry failed run</FormButton>
        ) : (
          <FormButton variant="primary" disabled={!canStart} loading={running} onClick={() => start()}>
            {running ? "Checking..." : run ? "Check again" : "Run check"}
          </FormButton>
        )
      ) : undefined}
    >
      <div className="space-y-4">
        {!canAct && <p className="text-[13px] text-[#64748B]">Only the owner or an admin can run checks and approve replies.</p>}
        {!state.enabled && <p className="text-[13px] text-[#64748B]">AI Workforce is switched off.</p>}
        {state.enabled && !state.aiEnabled && <p className="text-[13px] text-[#64748B]">AI drafting is off: a run gives the automatic checks only.</p>}
        {state.enabled && (
          <p className="text-[12px] text-[#94A3B8]">{state.usage.runsInWindow} of {state.usage.dailyRunCap} runs used in the last 24 hours. One run per enquiry per 24 hours.</p>
        )}
        {error && <p role="alert" className="text-[13px] font-medium text-red-600">{error}</p>}
        {!run && state.enabled && !running && <p className="text-[13px] text-[#64748B]">No check has been run on this site yet.</p>}

        {run && (
          <>
            <p className="text-[13px] text-[#475569] break-all">
              Checked <span className="font-medium text-[#0F172A]">{run.finalUrl ?? run.targetUrl}</span> for {run.startedByName}
            </p>
            {run.status === "BLOCKED" && (
              <p role="alert" className="flex gap-2 text-[13px] text-red-700"><AlertTriangle className="w-4 h-4 shrink-0" /> This address was refused for safety and wasn&apos;t read ({run.errorCode}).</p>
            )}
            {run.errorCode && WHY[run.errorCode] && <p className="text-[13px] text-amber-700">{WHY[run.errorCode]}</p>}
            {run.duplicateStatus === "EXISTS" && (
              <p className="text-[13px] text-amber-700">Already in prospects: {run.duplicateReason}. Check before replying.</p>
            )}

            {(run.findings?.length ?? 0) > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-[0.06em]">Findings, each tied to the evidence below</p>
                {run.findings?.map((f, i) => (
                  <div key={i} className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                    <p className="text-[14px] font-semibold text-[#0F172A]">{f.title}</p>
                    <p className="text-[13px] text-[#475569] mt-1">{f.explanation}</p>
                    <p className="text-[13px] text-[#475569] mt-1"><span className="font-medium">Next step:</span> {f.recommendation}</p>
                    <p className="text-[12px] text-[#94A3B8] mt-1.5">
                      Based on: {f.evidenceIds.map((id) => run.evidence.find((e) => e.id === id)?.check ?? id).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {run.evidence.length > 0 && (
              <details className="rounded-xl border border-[#E2E8F0] p-3" open={!run.findings?.length}>
                <summary className="cursor-pointer text-[13px] font-semibold text-[#0F172A]">
                  Evidence: {run.evidence.length} checks, {failing} failed
                </summary>
                <ul className="mt-2.5 space-y-1.5">
                  {run.evidence.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-[13px]">
                      <StatusIcon status={e.status} />
                      <span className="min-w-0 break-words"><span className="font-medium text-[#0F172A]">{e.check}:</span> <span className="text-[#475569]">{e.observed}</span></span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {editable && (
              <div className="space-y-3">
                <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></Field>
                <Field label={run.draftBody ? "Reply draft: check every claim before approving" : "Your reply"}>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={5000} />
                </Field>
                {warnings.length > 0 && (
                  <ul className="text-[12px] space-y-0.5">
                    {warnings.map((w) => (
                      <li key={w.kind} className={w.severity === "error" ? "text-red-600 font-medium" : "text-amber-700"}>{w.label}{w.detail ? `: ${w.detail}` : ""}</li>
                    ))}
                  </ul>
                )}
                <Field label="Send with">
                  <Select value={channel} onChange={(e) => setChannel(e.target.value as DiagnosisChannel)}>
                    <option value="EMAIL">Email</option>
                    {whatsappDigits(phone) && <option value="WHATSAPP">WhatsApp</option>}
                  </Select>
                </Field>
                <div className="flex flex-wrap gap-2">
                  <FormButton
                    variant="primary"
                    disabled={!subject.trim() || !body.trim()}
                    onClick={() => act(run, { action: "approve", subject, body, channel })}
                  >
                    Approve this text
                  </FormButton>
                  <FormButton variant="secondary" disabled={!subject.trim() || !body.trim()} onClick={() => act(run, { action: "save", subject, body })}>Save draft</FormButton>
                  <FormButton variant="ghost" onClick={() => act(run, { action: "discard" })}>Discard</FormButton>
                </div>
              </div>
            )}

            {approved && (
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-emerald-700">Approved by {run.approvedByName}. Send this exact text yourself.</p>
                <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
                  {run.channel === "EMAIL" && <p className="text-[13px] font-semibold text-[#0F172A] mb-2">{run.approvedSubject}</p>}
                  <p className="text-[14px] text-[#475569] whitespace-pre-wrap leading-relaxed">{run.approvedBody}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sendLink ? (
                    <a
                      href={sendLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => { setConfirming(true); setConfirmError(null); }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B00FF] px-3 py-2 text-[13px] font-semibold text-white hover:opacity-90"
                    >
                      <ExternalLink className="w-4 h-4" /> Open {channelLabel}
                    </a>
                  ) : (
                    <p className="text-[13px] text-amber-700">Too long for a link: copy it, send it yourself, then confirm.</p>
                  )}
                  <FormButton
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(run.approvedBody ?? "");
                      } catch {
                        setError("Couldn't copy automatically. Select the text above and copy it yourself.");
                        return;
                      }
                      setCopied(true);
                      setConfirming(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy text"}
                  </FormButton>
                  <FormButton variant="ghost" onClick={() => act(run, { action: "save", subject: run.approvedSubject ?? "", body: run.approvedBody ?? "" })}>Edit again</FormButton>
                  <FormButton variant="ghost" onClick={() => act(run, { action: "discard" })}>Discard</FormButton>
                </div>
                {confirming && (
                  <SendConfirm
                    key={run.id}
                    channel="WHATSAPP"
                    channelLabel={channelLabel}
                    name={fullName}
                    error={confirmError}
                    onCancel={() => setConfirming(false)}
                    onConfirm={async () => {
                      const ok = await act(run, { action: "confirm_sent", approvedAt: run.approvedAt });
                      if (ok) { setConfirming(false); onSent(); }
                      else setConfirmError("Couldn't confirm this was saved. Try again: it won't be recorded twice.");
                    }}
                  />
                )}
              </div>
            )}

            {run.status === "SENT" && <p className="text-[13px] font-medium text-emerald-700">Sent by {run.sentConfirmedByName}, and added to the notes below.</p>}
            {run.status === "DISCARDED" && <p className="text-[13px] text-[#64748B]">This draft was discarded.</p>}
          </>
        )}
      </div>
    </FormCard>
  );
}
