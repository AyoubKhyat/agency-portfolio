"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import type { NextFollowUp } from "@/lib/lead-actions";
import type { SendChannel } from "@/lib/next-action";
import { cn } from "@/lib/utils";

type Props = {
  channel: SendChannel;
  /** Names the channel in the question when it is not WhatsApp or Instagram, such as email. */
  channelLabel?: string;
  /** Who this is about, when the panel isn't already on their card. */
  name?: string;
  /** After "Yes, sent", ask what happens next instead of recording straight away. */
  askNext?: boolean;
  /** Offer "no more follow-ups" among the choices. */
  allowStop?: boolean;
  error?: string | null;
  onConfirm: (next?: NextFollowUp) => void | Promise<void>;
  onCancel: () => void;
  className?: string;
};

const button = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50";
const ghost = `${button} border border-[var(--os-border)] bg-[var(--os-surface)] text-[var(--os-text)] hover:bg-[var(--os-hover)]`;

/**
 * The only control that can record a send. Opening WhatsApp or Instagram proves
 * nothing: a popup can be blocked, a number can be wrong, or you can change your
 * mind. Cancelling writes nothing. Give it a `key` per prospect wherever one panel
 * can move between prospects, so an earlier "Yes, sent" never carries over.
 */
export function SendConfirm({ channel, channelLabel, name, askNext, allowStop = true, error, onConfirm, onCancel, className }: Props) {
  const [askingNext, setAskingNext] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref flips immediately, so two clicks in the same tick cannot record twice.
  const used = useRef(false);
  const label = channelLabel ?? (channel === "WHATSAPP" ? "WhatsApp" : "Instagram");

  async function record(next?: NextFollowUp) {
    if (used.current) return;
    used.current = true;
    setBusy(true);
    try {
      await onConfirm(next);
    } finally {
      used.current = false;
      setBusy(false);
    }
  }

  return (
    <div role="group" aria-label="Confirm send" className={cn("rounded-xl border border-amber-500/40 bg-amber-500/10 p-3", className)}>
      <p className="flex items-start gap-2 text-[13px] font-semibold text-[var(--os-text)]">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        {askingNext ? "When should it come back?" : `${label} opened. Did you send the message${name ? ` to ${name}` : ""}?`}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {askingNext ? (
          <>
            <button disabled={busy} onClick={() => record(3)} className={ghost}>In 3 days</button>
            <button disabled={busy} onClick={() => record(7)} className={ghost}>In 7 days</button>
            {allowStop && <button disabled={busy} onClick={() => record("stop")} className={ghost}>No more follow-ups</button>}
          </>
        ) : (
          <button
            disabled={busy}
            onClick={() => (askNext ? setAskingNext(true) : record())}
            className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {busy ? "Saving" : "Yes, sent"}
          </button>
        )}
        <button disabled={busy} onClick={onCancel} className={ghost}>
          <X className="w-4 h-4" /> Not sent
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
