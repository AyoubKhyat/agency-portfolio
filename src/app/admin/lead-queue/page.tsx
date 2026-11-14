"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronRight, Compass, EyeOff, RefreshCw, Search, Users } from "lucide-react";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { KIND_STYLE, NextActionCard, type CardAction } from "@/components/admin/lead-queue/next-action-card";
import { ProspectDrawer } from "@/components/admin/prospect-drawer";
import { ScheduleMeetingModal } from "@/components/admin/schedule-meeting-modal";
import { SendConfirm } from "@/components/admin/send-confirm";
import { recordConfirmedSend, type NextFollowUp } from "@/lib/lead-actions";
import { addDays, type LeadQueue, type QueueGroup, type QueueItem, type SendChannel } from "@/lib/next-action";
import { cn } from "@/lib/utils";

type Filter = "all" | QueueGroup;

const FIND_NEW = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white bg-gradient-to-r from-[#8B00FF] to-[#2f5bff] shadow-md shadow-purple-500/20 hover:opacity-90 transition-opacity";

const dateLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function Skeleton() {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5" aria-label="Loading your queue">
      <div className="os-skeleton h-80 rounded-2xl" />
      <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}</div>
    </div>
  );
}

function EmptyQueue({ filter, done }: { filter: Filter; done: number }) {
  const copy: Record<Filter, string> = {
    all: done > 0 ? "That's everything for now." : "Nothing needs action right now.",
    replies: "No replies recorded. If someone answered on WhatsApp or Instagram, mark it on their card.",
    enquiries: "No new enquiries.",
    verify: "No old replies left to check.",
    followUps: "No follow-ups need a decision.",
    ready: "No prospects are ready to contact. They need a confirmed WhatsApp or Instagram.",
  };
  return (
    <section className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] px-6 py-14 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#8B00FF] to-[#2f5bff] flex items-center justify-center shadow-lg shadow-purple-500/25">
        <CheckCircle2 className="w-7 h-7 text-white" />
      </div>
      <p className="mt-5 text-[18px] font-semibold text-[var(--os-text)]">{filter === "all" ? "You're clear" : "Nothing here"}</p>
      <p className="mt-1.5 text-[14px] text-[var(--os-text-muted)] max-w-md mx-auto">{copy[filter]}</p>
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        <Link href="/admin/discovery" className={FIND_NEW}><Compass className="w-4 h-4" /> Find new leads</Link>
        <Link href="/admin/prospecting" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold border border-[var(--os-border)] text-[var(--os-text)] hover:bg-[var(--os-hover)]">
          <Users className="w-4 h-4" /> All prospects
        </Link>
      </div>
    </section>
  );
}

function UpNext({ items, onPick }: { items: QueueItem[]; onPick: (key: string) => void }) {
  return (
    <aside aria-label="Up next">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--os-text-muted)] mb-3 px-1">Up next</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--os-border)] px-4 py-6 text-center text-[13px] text-[var(--os-text-muted)]">Nothing after this one.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.key}>
              <button
                onClick={() => onPick(item.key)}
                className="w-full flex items-center gap-3 rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)] px-3.5 py-3 text-left transition-all hover:border-[var(--os-border-hover)] hover:bg-[var(--os-hover)]"
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", KIND_STYLE[item.kind].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-[var(--os-text)] truncate">{item.name}</span>
                  <span className="block text-[12px] text-[var(--os-text-muted)] truncate">{item.detail}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--os-text-muted)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** What the queue leaves out, and why, so an empty list can be trusted. */
function NotListed({ notes }: { notes: LeadQueue["notes"] }) {
  const rows = [
    notes.hiddenOldDates > 0 && { href: "/admin/prospecting?due=overdue", text: `${notes.hiddenOldDates} old follow-up date${notes.hiddenOldDates === 1 ? "" : "s"} ignored: no confirmed send backs them.` },
    notes.toSendNoChannel > 0 && { href: "/admin/prospecting?status=A_ENVOYER", text: `${notes.toSendNoChannel} prospect${notes.toSendNoChannel === 1 ? "" : "s"} to contact have no confirmed WhatsApp or Instagram.` },
    notes.recentlySent > 0 && { href: "/admin/prospecting", text: `${notes.recentlySent} recent send${notes.recentlySent === 1 ? "" : "s"} still waiting for an answer.` },
    notes.scheduled > 0 && { href: "/admin/prospecting", text: `${notes.scheduled} follow-up${notes.scheduled === 1 ? " is" : "s are"} scheduled for later.` },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <section className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface-2)] p-5">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--os-text)]"><EyeOff className="w-4 h-4 text-[var(--os-text-muted)]" /> Not in this list</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.text}>
            <Link href={r.href} className="group flex items-start gap-2 text-[13px] leading-relaxed text-[var(--os-text-muted)] hover:text-[var(--os-text)]">
              <ArrowRight className="w-3.5 h-3.5 mt-1 shrink-0" /> {r.text}
            </Link>
          </li>
        ))}
        <li className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--os-text-muted)]">
          <ArrowRight className="w-3.5 h-3.5 mt-1 shrink-0" />
          Replies on WhatsApp or Instagram only show here once someone marks them. This list can&apos;t see your messages.
        </li>
      </ul>
    </section>
  );
}

/** Reports the URL's `view` to the page whenever it changes (a menu click keeps the page mounted). */
function ViewFromUrl({ onView }: { onView: (view: string | null) => void }) {
  const view = useSearchParams().get("view");
  useEffect(() => {
    const t = window.setTimeout(() => onView(view), 0);
    return () => window.clearTimeout(t);
  }, [view, onView]);
  return null;
}

export default function LeadQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<LeadQueue | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [meetingFor, setMeetingFor] = useState<QueueItem | null>(null);
  const [sending, setSending] = useState<{ key: string; channel: SendChannel; error?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/lead-queue");
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) { setFailed(true); return; }
      setQueue(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [router]);

  // The menu links Contact (no view) and Follow Up (?view=followUps) to this same page, so the
  // filter follows the URL on every visit, not only the first one.
  const onView = useCallback((view: string | null) => {
    setFilter(view === "replies" || view === "enquiries" || view === "verify" || view === "followUps" || view === "ready" ? view : "all");
    setPickedKey(null);
  }, []);

  useEffect(() => {
    fetch("/api/admin/lead-queue")
      .then(async (res) => {
        if (res.status === 401) { router.push("/admin/login"); return; }
        if (!res.ok) { setFailed(true); return; }
        setQueue(await res.json());
      })
      .catch(() => setFailed(true));
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const items = useMemo(() => {
    const live = (queue?.items ?? []).filter((i) => !done.includes(i.key) && (filter === "all" || i.group === filter));
    // Skipping lasts for this visit only. Nothing is saved.
    return [...live.filter((i) => !skipped.includes(i.key)), ...live.filter((i) => skipped.includes(i.key))];
  }, [queue, done, filter, skipped]);

  const current = items.find((i) => i.key === pickedKey) ?? items[0];
  const position = current ? items.indexOf(current) + 1 : 0;
  const total = (queue?.counts.all ?? 0);
  const left = (queue?.items ?? []).filter((i) => !done.includes(i.key));
  const count = (group: QueueGroup) => left.filter((i) => i.group === group).length;

  function finish(item: QueueItem, text: string, bad = false) {
    setDone((d) => [...d, item.key]);
    setPickedKey(null);
    setSending(null);
    setToast({ text, bad });
    void load();
  }

  async function patch(url: string, body: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) setToast({ text: "That didn't save. Nothing changed.", bad: true });
      return res.ok;
    } catch {
      setToast({ text: "That didn't save. Nothing changed.", bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function act(item: QueueItem, action: CardAction) {
    if (action === "skip") {
      setSkipped((s) => [...s.filter((k) => k !== item.key), item.key]);
      setPickedKey(null);
      return;
    }
    if (action === "details") { setDrawerId(item.id); return; }
    if (action === "meeting") { setMeetingFor(item); return; }

    const prospect = `/api/admin/prospecting/${item.id}`;
    const later = (days: number) => ({ followUpDate: addDays(queue!.today, days), actionType: "FOLLOW_UP" });
    const steps: Partial<Record<CardAction, [string, unknown, string]>> = {
      later3: [prospect, later(3), "Back in 3 days"],
      later7: [prospect, later(7), "Back in 7 days"],
      won: [prospect, { status: "CONVERTI", actionType: "STATUS_CONVERTI" }, "Marked as won"],
      lost: [prospect, { status: "LOST", actionType: "STATUS_LOST" }, "Lead closed"],
      replied: [prospect, { status: "REPONDU", actionType: "MARKED_REPLIED" }, "Marked as replied"],
      not_reply: [prospect, { actionType: "REPLY_REVIEWED", details: "Reviewed in the queue: not a reply" }, "Noted: not a reply"],
      stop: [prospect, { followUpDate: null, actionType: "NO_MORE_FOLLOW_UP" }, "No more follow-ups"],
      enquiry_contacted: [`/api/admin/leads/${item.id}`, { status: "CONTACTED" }, "Enquiry marked as answered"],
      enquiry_test: [`/api/admin/leads/${item.id}`, { status: "TEST" }, "Marked as internal test"],
    };
    const step = steps[action];
    if (step && await patch(step[0], step[1])) {
      if (action === "replied") { setPickedKey(null); setToast({ text: step[2] }); await load(); return; }
      finish(item, step[2]);
    }
  }

  async function confirmSend(item: QueueItem, channel: SendChannel, next?: NextFollowUp) {
    const first = item.kind === "ready";
    const result = await recordConfirmedSend(fetch.bind(window), first
      ? { kind: "first", prospectId: item.id, channel, today: queue!.today }
      : { kind: "follow_up", prospectId: item.id, channel, today: queue!.today, step: item.nextStep, next: next ?? 3 });
    if (result.ok) {
      finish(item, first ? "Send recorded. Follow-up in 3 days." : next === "stop" ? "Send recorded. No more follow-ups." : `Send recorded. Back in ${next ?? 3} days.`);
    } else if (result.recorded) {
      finish(item, result.error, true);
    } else {
      setSending({ key: item.key, channel, error: result.error });
    }
  }

  const armed = sending && current && sending.key === current.key ? sending : null;

  return (
    <div>
      <Suspense fallback={null}><ViewFromUrl onView={onView} /></Suspense>
      <header className="flex items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          {queue && <p className="text-[13px] text-[var(--os-text-muted)]">{dateLabel(queue.today)}</p>}
          <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-[var(--os-text)]">Command Center</h1>
        </div>
        <Link href="/admin/discovery" aria-label="Find new leads" className={cn(FIND_NEW, "shrink-0 max-sm:px-3 max-sm:py-2 max-sm:text-[13px]")}>
          <Search className="w-4 h-4" /> <span>Find new<span className="max-sm:hidden"> leads</span></span>
        </Link>
      </header>

      {failed && !queue ? (
        <section role="alert" className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] px-6 py-12 text-center">
          <p className="text-[16px] font-semibold text-[var(--os-text)]">Couldn&apos;t load your queue</p>
          <p className="mt-1.5 text-[14px] text-[var(--os-text-muted)]">This doesn&apos;t mean there&apos;s nothing to do. Your prospects are safe.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <button onClick={() => void load()} className={FIND_NEW}><RefreshCw className="w-4 h-4" /> Try again</button>
            <Link href="/admin/prospecting" className="inline-flex items-center rounded-xl px-4 py-2.5 text-[14px] font-semibold border border-[var(--os-border)] text-[var(--os-text)]">All prospects</Link>
          </div>
        </section>
      ) : !queue ? (
        <Skeleton />
      ) : (
        <>
          <div className="mb-5">
            <FilterTabs
              size="md"
              active={filter}
              onChange={(v) => { setFilter(v as Filter); setPickedKey(null); }}
              items={[
                { value: "all", label: "All", count: left.length },
                { value: "replies", label: "Replies", count: count("replies") },
                { value: "enquiries", label: "Enquiries", count: count("enquiries") },
                ...(count("verify") > 0 ? [{ value: "verify", label: "To verify", count: count("verify") }] : []),
                { value: "followUps", label: "Follow-ups", count: count("followUps") },
                { value: "ready", label: "Ready", count: count("ready") },
              ]}
            />
            {done.length > 0 && total > 0 && (
              <div className="mt-3 flex items-center gap-3" aria-label={`${done.length} done this visit`}>
                <div className="h-1.5 flex-1 rounded-full bg-[var(--os-border)] overflow-hidden">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-[#8B00FF] to-[#2f5bff]" animate={{ width: `${Math.min(100, (done.length / (done.length + left.length)) * 100)}%` }} />
                </div>
                <span className="text-[12px] tabular-nums text-[var(--os-text-muted)]">{done.length} done</span>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
            <div className="space-y-5 min-w-0">
              {current ? (
                <NextActionCard
                  key={current.key}
                  item={current}
                  position={position}
                  total={items.length}
                  busy={busy}
                  onAct={(a) => void act(current, a)}
                  onOpened={(channel) => setSending({ key: current.key, channel })}
                  confirm={armed ? (
                    <SendConfirm
                      channel={armed.channel}
                      askNext={current.kind !== "ready"}
                      allowStop={current.group === "followUps"}
                      error={armed.error}
                      onConfirm={(next) => confirmSend(current, armed.channel, next)}
                      onCancel={() => setSending(null)}
                    />
                  ) : undefined}
                />
              ) : (
                <EmptyQueue filter={filter} done={done.length} />
              )}
              <div className="hidden lg:block"><NotListed notes={queue.notes} /></div>
            </div>
            {current && <UpNext items={items.filter((i) => i.key !== current.key)} onPick={setPickedKey} />}
            <div className="lg:hidden"><NotListed notes={queue.notes} /></div>
          </div>
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
              "fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-6 z-50 max-w-[90vw] rounded-xl px-4 py-2.5 text-[13px] font-semibold shadow-xl",
              toast.bad ? "bg-red-600 text-white" : "bg-[#292438] text-[#f5f5f7]",
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <ProspectDrawer prospectId={drawerId} onClose={() => { setDrawerId(null); void load(); }} onUpdate={() => {}} />
      {meetingFor && (
        <ScheduleMeetingModal
          open
          context={{ kind: "prospect", prospectId: meetingFor.id, label: meetingFor.name }}
          onClose={() => setMeetingFor(null)}
          onCreated={() => { const item = meetingFor; setMeetingFor(null); finish(item, "Meeting booked"); }}
        />
      )}
    </div>
  );
}
