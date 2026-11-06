"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { GlassCard } from "@/components/admin/glass-card";
import { Toggle } from "@/components/admin/form";

type Controls = {
  enabled: boolean;
  aiEnabled: boolean;
  dailyRunCap: number;
  monthlyBudgetMicros: number;
  runsInWindow: number;
  monthSpentMicros: number;
  model: string;
  envEnabled: boolean;
  keyPresent: boolean;
};

const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** The instant kill switch and this month's usage. The API answers only the owner; anyone else sees nothing. */
export function AiControlsCard() {
  const [c, setC] = useState<Controls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-controls")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setC(data))
      .catch(() => setC(null));
  }, []);

  if (!c) return null;

  async function set(patch: Partial<Pick<Controls, "enabled" | "aiEnabled">>) {
    setError(null);
    const res = await fetch("/api/admin/ai-controls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setC((prev) => (prev ? { ...prev, ...patch } : prev));
    else setError("Couldn't change that. It is unchanged.");
  }

  return (
    <GlassCard padding="lg" className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">AI Workforce</h2>
          <p className="text-xs text-[#475569]">Website checks and reply drafts on diagnosis enquiries. Switching off takes effect at once.</p>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <Toggle checked={c.enabled} onChange={(v) => set({ enabled: v })} label="Website checks" />
        <Toggle checked={c.aiEnabled} onChange={(v) => set({ aiEnabled: v })} disabled={!c.enabled} label={`AI drafting (${c.model})`} />
      </div>
      {error && <p role="alert" className="text-xs font-medium text-red-600 mb-3">{error}</p>}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-[#94A3B8]">Runs, last 24 hours</dt><dd className="font-medium text-[#0F172A]">{c.runsInWindow} of {c.dailyRunCap}</dd></div>
        <div><dt className="text-xs text-[#94A3B8]">AI spend this month, estimated</dt><dd className="font-medium text-[#0F172A]">{usd(c.monthSpentMicros)} of {usd(c.monthlyBudgetMicros)}</dd></div>
      </dl>

      {!c.envEnabled && <p className="text-xs text-amber-700 mt-4">AI_WORKFORCE_ENABLED isn&apos;t set on this deployment, so everything stays off whatever these switches say.</p>}
      {c.envEnabled && !c.keyPresent && <p className="text-xs text-amber-700 mt-4">AI_WORKFORCE_GROQ_API_KEY isn&apos;t set on this deployment, so runs give the automatic checks only.</p>}
    </GlassCard>
  );
}
