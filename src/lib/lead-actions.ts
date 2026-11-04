/**
 * Recording a confirmed send, through the existing APIs.
 *
 * Opening WhatsApp or Instagram writes nothing. This is only called after the
 * user answers "Yes, sent". The server treats a repeat of the same send as the
 * same record, so retrying after a failure cannot create a second one.
 *
 * `request` is passed in so the order of writes can be tested without a server.
 */
import { addDays, type FollowUpStep, type SendChannel } from "./next-action";

export type RequestFn = (url: string, init: RequestInit) => Promise<{ ok: boolean; status?: number; json?: () => Promise<unknown> }>;

/** Next step after a follow-up: a date in N days, or stop. */
export type NextFollowUp = 3 | 7 | "stop";

export type ConfirmedSend = {
  prospectId: string;
  channel: SendChannel;
  /** The text used, when known. */
  body?: string;
  today: string;
} & (
  | { kind: "first" }
  | { kind: "follow_up"; step: FollowUpStep | null; next: NextFollowUp }
);

export type SendResult =
  | { ok: true }
  /** The server did not confirm the send. It may or may not have arrived, and trying again is safe. */
  | { ok: false; recorded: false; error: string }
  /** The send is recorded, but a later step failed. Do not record it again. */
  | { ok: false; recorded: true; error: string };

/** Keeps the established automatic follow-up after a confirmed first send. */
export const FIRST_SEND_FOLLOW_UP_DAYS = 3;

const UNCAPTURED_BODY: Record<SendChannel, string> = {
  WHATSAPP: "(composed manually in WhatsApp — body not captured)",
  INSTAGRAM: "(composed manually in Instagram — body not captured)",
};

const UNCONFIRMED = "Couldn't confirm this was saved. Try again: it won't be recorded twice.";

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function recordConfirmedSend(request: RequestFn, send: ConfirmedSend): Promise<SendResult> {
  const base = `/api/admin/prospecting/${send.prospectId}`;
  const actionType = send.channel === "WHATSAPP" ? "SENT_WHATSAPP" : "SENT_INSTAGRAM";

  const logged = await request(`${base}/outreach`, json("POST", {
    channel: send.channel,
    body: send.body?.trim() || UNCAPTURED_BODY[send.channel],
    templateId: null,
  })).catch(() => null);
  if (!logged?.ok) return { ok: false, recorded: false, error: UNCONFIRMED };

  const partial = (what: string): SendResult => ({ ok: false, recorded: true, error: `Send recorded, but ${what} didn't save.` });

  const status = await request(base, json("PATCH", { status: "ENVOYE", actionType })).catch(() => null);
  if (!status?.ok) return partial("the status");

  if (send.kind === "first") {
    // All prospects shows these buttons on every row. Keep a date someone planned, and don't hide a reply behind a new one.
    const after = (await status.json?.().catch(() => null)) as { followUpDate?: string | null; statusPreserved?: boolean } | null | undefined;
    if (after?.statusPreserved || (after?.followUpDate ?? "") >= send.today) return { ok: true };
    const date = addDays(send.today, FIRST_SEND_FOLLOW_UP_DAYS);
    const dated = await request(base, json("PATCH", { followUpDate: date })).catch(() => null);
    return dated?.ok ? { ok: true } : partial("the follow-up date");
  }

  if (send.step) {
    const step = await request(`${base}/sequence`, json("PATCH", { step: send.step, done: true })).catch(() => null);
    if (!step?.ok) return partial("the follow-up step");
  }

  const next = send.next === "stop"
    ? { followUpDate: null, actionType: "NO_MORE_FOLLOW_UP" }
    : { followUpDate: addDays(send.today, send.next) };
  const saved = await request(base, json("PATCH", next)).catch(() => null);
  return saved?.ok ? { ok: true } : partial("the next step");
}

/** "Today" from the browser, for pages that have no server-provided Marrakech day. */
export function browserToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
