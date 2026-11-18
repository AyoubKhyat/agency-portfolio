"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ExternalLink, Loader2, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { SECTORS } from "@/lib/discovery-providers";
import { cn } from "@/lib/utils";
import { groupIssues, issueCopy } from "@/lib/lead-issue-copy";
import { dayLabel, nextDay } from "@/lib/daily-leads-day";
import type { TodayLead, TodayLeadsView, TodayRun } from "@/lib/daily-leads-store";

type View = TodayLeadsView & { canRun: boolean };
type ImportState = { busy?: boolean; prospectId?: string; skipped?: string; error?: string };

const sectorLabel = (key: string) => SECTORS.find((s) => s.key === key)?.label ?? key;
const CHANNEL: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", EMAIL: "Email", FACEBOOK: "Facebook" };
/** "site.ma/contact": where a contact link was found, short enough for a phone. */
const pagePath = (url: string) => { try { const u = new URL(url); return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, ""); } catch { return url; } };
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** Sites that present themselves as a different business: nothing is attached to them, a person decides. */
function IdentityReviewList({ view }: { view: View }) {
  const items = view.rounds.flatMap((r) => r.stats?.identityReview ?? []);
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--os-text-muted)]">Held for manual review · website may belong to another business</p>
      <ul className="mt-2 space-y-2">
        {items.map((r) => (
          <li key={r.osmId} className="text-[12.5px] text-[var(--os-text)] break-words">
            <span className="font-semibold">{r.name}</span> <span className="text-[var(--os-text-muted)]">({sectorLabel(r.sector)})</span>: {r.reason}{" "}
            <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-[var(--os-purple)] underline">{host(r.website)}</a>
            {" · "}
            <a href={r.osmUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--os-purple)] underline">OSM listing</a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--os-text-muted)]">Not ranked, and no website problems or contacts were attached. If the OSM listing points to the wrong site, it can be corrected on OpenStreetMap.</p>
    </div>
  );
}

/** Why no further round today, in plain words (the next list is tomorrow, Casablanca day). */
function stopText(view: View): string {
  const tomorrow = `The next list can be prepared tomorrow, ${dayLabel(nextDay(view.day))}.`;
  const c = view.continuation;
  if (c.stopReason === "TARGET_REACHED") return `Today's target of 5 is reached. ${tomorrow}`;
  if (c.stopReason === "EXHAUSTED") return `No more businesses to check today in the Marrakech list. ${tomorrow}`;
  if (c.stopReason === "NO_ROUNDS_LEFT") return `All ${c.maxRounds} rounds used today. ${tomorrow}`;
  return `One run per day: the next one can be prepared tomorrow, ${dayLabel(nextDay(view.day))}.`;
}

/** The day's latest round completed: when, what the day has so far, and whether another round can run. */
function CompletedStatus({ view }: { view: View }) {
  const n = view.leads.length;
  const done = view.run?.completedAt;
  const c = view.continuation;
  const rounds = c.roundsUsed > 1 || c.canContinue;
  return (
    <p role="status" className="mb-3 text-[12.5px] text-[var(--os-text)]">
      <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Completed{done ? ` at ${time(done)}` : ""}</span>
      {done && <span className="text-[var(--os-text-muted)]"> Casablanca time</span>}
      {" · "}{n} qualified lead{n === 1 ? "" : "s"} found{rounds && ` · round ${c.roundsUsed} of ${c.maxRounds}`}
      <span className="text-[var(--os-text-muted)]">
        {" · "}{c.canContinue
          ? `Fewer than 5: up to 12 more websites can be checked (round ${c.roundsUsed + 1} of ${c.maxRounds}), with the same rules.`
          : stopText(view)}
      </span>
    </p>
  );
}

const rejectedWeak = (s: TodayRun["stats"]) => (s?.rejected ? s.rejected.seoOnly + s.rejected.uncertainOnly : 0);

/** One line per round that saved its counts; "Round n:" only once the day has more than one. */
function StatsLines({ view }: { view: View }) {
  const withStats = view.rounds.filter((r) => r.stats);
  return <>{withStats.map((r) => <StatsLine key={r.round} run={r} label={view.rounds.length > 1 ? `Round ${r.round}: ` : ""} />)}</>;
}

function StatsLine({ run, label }: { run: TodayRun; label: string }) {
  const s = run.stats;
  if (!s) return null;
  const read = s.outcomes.COMPLETE ?? 0;
  const notRead = s.checked - read;
  return (
    <p className="text-[12px] text-[var(--os-text-muted)] mt-3">
      {label}{s.sectors.map(sectorLabel).join(", ")} · {s.checked} website{s.checked === 1 ? "" : "s"} checked, {read} read fully
      {notRead > 0 && <>, {notRead} couldn&apos;t be read completely (never counted as problems)</>}
      {s.skipped.inCrm + s.skipped.possibleDuplicate > 0 && <> · {s.skipped.inCrm + s.skipped.possibleDuplicate} already in the CRM or possible duplicates</>}
      {s.skipped.shownBefore > 0 && <> · {s.skipped.shownBefore} shown on an earlier day</>}
      {(s.skipped.checkedToday ?? 0) > 0 && <> · {s.skipped.checkedToday} already checked in an earlier round today</>}
      {rejectedWeak(s) > 0 && <> · {rejectedWeak(s)} left out as weak (SEO-only or unconfirmed problems)</>}
      {(s.rejected?.competitor ?? 0) > 0 && <> · {s.rejected!.competitor} agenc{s.rejected!.competitor === 1 ? "y" : "ies"} like ours skipped</>}
      {s.stoppedEarly && <> · stopped early at the time limit</>}
      {s.sectorErrors.length > 0 && <> · {s.sectorErrors.length} sector{s.sectorErrors.length === 1 ? "" : "s"} couldn&apos;t be searched</>}
      {s.exhausted && <> · every sector searched to the end</>}
    </p>
  );
}

/** Customer-facing issues as titled rows; minor technical/SEO ones as compact chips (full rows once opened). */
function IssueList({ findings, open }: { findings: TodayLead["findings"]; open: boolean }) {
  const { customer, technical } = groupIssues(findings);
  const shown = open ? customer : customer.slice(0, 2);
  const hidden = customer.length - shown.length;
  const row = (x: (typeof customer)[number], tone: "customer" | "technical") => (
    <li key={x.finding.id} className="flex gap-2.5">
      <span aria-hidden className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", tone === "customer" ? "bg-amber-500" : "bg-[var(--os-text-muted)]")} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--os-text)] leading-snug">
          {x.copy.title}
          {x.finding.evidence === "UNCERTAIN" && <span className="ml-2 rounded-full border border-amber-500/40 px-1.5 py-px text-[10.5px] font-medium text-amber-700 dark:text-amber-300">Unconfirmed</span>}
        </p>
        {x.finding.note && <p className="text-[12px] text-[var(--os-text-muted)] leading-relaxed italic">{x.finding.note}</p>}
        {x.copy.explanation && <p className="text-[12.5px] text-[var(--os-text-muted)] leading-relaxed">{x.copy.explanation}</p>}
        {x.copy.impact && <p className="text-[12px] text-[var(--os-text-muted)] leading-relaxed"><span className="font-medium">Possible impact:</span> {x.copy.impact}</p>}
      </div>
    </li>
  );
  return (
    <div className="mt-3 space-y-3">
      {customer.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1.5">What a customer would notice</p>
          <ul className="space-y-2">{shown.map((x) => row(x, "customer"))}</ul>
          {hidden > 0 && <p className="mt-1 text-[12px] text-[var(--os-text-muted)]">+{hidden} more in Review evidence</p>}
        </div>
      )}
      {technical.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--os-text-muted)] mb-1.5">Minor technical / SEO</p>
          {open ? (
            <ul className="space-y-2">{technical.map((x) => row(x, "technical"))}</ul>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {technical.map((x) => (
                <li key={x.finding.id} className="text-[12px] rounded-lg border border-[var(--os-border)] px-2 py-0.5 text-[var(--os-text-muted)]">{x.copy.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, state, onImport }: { lead: TodayLead; state: ImportState; onImport: () => void }) {
  const [open, setOpen] = useState(false);
  const prospectId = lead.importedProspectId ?? state.prospectId;
  const site = lead.finalUrl || lead.website;
  return (
    <li className="rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4" data-lead={lead.osmId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--os-text)] break-words">{lead.name}</p>
          <p className="text-[12px] text-[var(--os-text-muted)]">{sectorLabel(lead.sector)} · Marrakech</p>
        </div>
        <span className={cn(
          "text-[11px] font-medium rounded-full px-2.5 py-1 border shrink-0",
          lead.kind === "WEBSITE" ? "border-amber-300/60 text-amber-700 dark:text-amber-300" : "border-sky-300/60 text-sky-700 dark:text-sky-300",
        )}>
          {lead.kind === "WEBSITE" ? `${lead.findings.length} website problem${lead.findings.length === 1 ? "" : "s"} found` : "No website listed in OpenStreetMap"}
        </span>
      </div>

      {lead.kind === "WEBSITE" && lead.identity?.status === "UNVERIFIED" && (
        <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-300">Website identity unverified: {lead.identity.reason} Check the site is theirs before using its problems or contacts.</p>
      )}
      {lead.kind === "WEBSITE" ? (
        <IssueList findings={lead.findings} open={open} />
      ) : (
        <p className="mt-3 text-[13px] text-[var(--os-text)] leading-relaxed">
          The OpenStreetMap listing has no website, only the contact link{lead.contacts.length === 1 ? "" : "s"} below. That doesn&apos;t prove the business has no site: check before you mention it.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {site && <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--os-purple)] hover:underline"><ExternalLink className="w-3 h-3" /> {host(site)}</a>}
        <a href={lead.osmUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--os-purple)] hover:underline"><MapPin className="w-3 h-3" /> OpenStreetMap listing</a>
        {lead.contacts.map((c) => (
          <span key={c.channel + c.link} className="inline-flex flex-wrap items-center gap-x-1 text-[var(--os-text-muted)] break-all">
            <a href={c.link} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--os-text)]">
              {CHANNEL[c.channel]}{c.value ? ` ${c.value}` : ""}
            </a>
            <span className="text-amber-700 dark:text-amber-300">
              (unverified, {c.source === "OSM_TAG" ? "from the OSM tag" : <>found on <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{pagePath(c.sourceUrl)}</a></>})
            </span>
          </span>
        ))}
        {lead.whatsappConfidence === "CONFLICT" && <span className="text-red-600">Different WhatsApp numbers found: check which is current</span>}
        {lead.contacts.length === 0 && <span className="text-[var(--os-text-muted)]">No WhatsApp, Instagram or email link found on the site</span>}
      </div>

      {open && lead.kind === "WEBSITE" && (
        <div className="mt-3 rounded-xl bg-[var(--os-hover)] p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-[var(--os-text-muted)]">What was seen, and where</p>
          {lead.findings.map((f) => (
            <div key={f.id} className="text-[12px] text-[var(--os-text)] break-words">
              <span className="font-semibold">{issueCopy(f).title}:</span> {f.sentence}
              <span className="text-[var(--os-text-muted)]"> — observed: {f.observed} · <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{host(f.sourceUrl)}</a></span>
            </div>
          ))}
          <p className="text-[11px] text-[var(--os-text-muted)]">Checked {time(lead.checkedAt)} (Casablanca)</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {lead.kind === "WEBSITE" && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-medium border border-[var(--os-border)] text-[var(--os-text)] hover:bg-[var(--os-hover)]">
            Review evidence <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
        {prospectId ? (
          <Link href={`/admin/prospecting/${prospectId}`} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 hover:bg-[var(--os-hover)]">
            Imported · open prospect <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button type="button" onClick={onImport} disabled={state.busy}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-white bg-gradient-to-r from-[#8B00FF] to-[#2f5bff] disabled:opacity-60">
            {state.busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Import to prospects
          </button>
        )}
        {state.skipped && <span role="status" className="text-[12px] text-amber-700 dark:text-amber-300">Not imported: {state.skipped}</span>}
        {state.error && <span role="alert" className="text-[12px] text-red-600">{state.error}</span>}
      </div>
      {prospectId && <p className="mt-2 text-[12px] text-[var(--os-text-muted)]">On the prospect page: check the contact, then draft the first message. Nothing is sent for you.</p>}
    </li>
  );
}

/** Today's leads from the Daily Lead Agent: review, then import by hand. Nothing here contacts anyone. */
export function TodaysLeads() {
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [imports, setImports] = useState<Record<string, ImportState>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/daily-leads", { cache: "no-store" });
      if (!res.ok) { setFailed(true); return; }
      setView(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  // While a run is in progress (and not stale), look again every 15 s so the card shows when it finishes or fails.
  // An interval, so one failed check doesn't stop the updates; cleared when the run ends, goes stale or the card unmounts.
  const inProgress = view?.run?.status === "RUNNING" && !view.run.stale;
  useEffect(() => {
    if (!inProgress) return;
    const t = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(t);
  }, [inProgress, load]);

  // run: round 1, or a retry/takeover of the day's latest round. continue: the next round of the day on screen.
  async function run(action: "run" | "continue" = "run") {
    setRunning(true); setRunError(null);
    try {
      const payload = action === "continue" ? { action, day: view?.day } : { action };
      const res = await fetch("/api/admin/daily-leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => null);
      if (!res.ok) setRunError(body?.error ?? "The run failed.");
      else if (body?.result === "ALREADY_RUNNING") setRunError("It's already being prepared. Check again in a few minutes.");
      else if (body?.result === "DAY_CHANGED") setRunError("Midnight has passed in Casablanca: this is a new day, so nothing more was checked for yesterday.");
    } catch {
      setRunError("The run failed.");
    }
    setRunning(false);
    await load();
  }

  async function importLead(lead: TodayLead) {
    setImports((m) => ({ ...m, [lead.resultId]: { busy: true } }));
    let next: ImportState;
    try {
      const res = await fetch("/api/admin/daily-leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "import", resultId: lead.resultId }) });
      const body = await res.json().catch(() => null);
      next = res.ok && body?.prospectId ? { prospectId: body.prospectId } : res.status === 409 ? { skipped: body?.skipped ?? "already in the CRM" } : { error: body?.error ?? "Import failed" };
    } catch {
      next = { error: "Import failed" };
    }
    setImports((m) => ({ ...m, [lead.resultId]: next }));
  }

  const continueButton = () => view?.canRun && view.continuation.canContinue && (
    <button type="button" onClick={() => void run("continue")} disabled={running}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold border border-[var(--os-border)] text-[var(--os-text)] hover:bg-[var(--os-hover)] disabled:opacity-60">
      {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{" "}
      {running ? "Checking… (up to 5 minutes)" : `Continue: check up to 12 more websites (round ${view.continuation.roundsUsed + 1} of ${view.continuation.maxRounds})`}
    </button>
  );

  const runButton = (label: string) => view?.canRun && (
    <button type="button" onClick={() => void run()} disabled={running}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold border border-[var(--os-border)] text-[var(--os-text)] hover:bg-[var(--os-hover)] disabled:opacity-60">
      {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} {running ? "Preparing… (up to 5 minutes)" : label}
    </button>
  );

  const ownerOnly = view && !view.canRun && <p className="text-[12px] text-[var(--os-text-muted)] mt-2">An owner or admin can start it.</p>;
  const box = "rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-5";
  let body: React.ReactNode;
  if (failed && !view) {
    body = <div className={box} role="alert"><p className="text-[14px] text-[var(--os-text)]">Couldn&apos;t load today&apos;s leads.</p><button type="button" onClick={() => void load()} className="mt-2 text-[13px] text-[var(--os-purple)] underline">Try again</button></div>;
  } else if (!view) {
    body = <div className={cn(box, "os-skeleton h-24")} aria-busy="true" />;
  } else if (!view.run) {
    body = (
      <div className={box}>
        <p className="text-[14px] text-[var(--os-text)]">Not prepared yet today.</p>
        <p className="text-[12px] text-[var(--os-text-muted)] mt-1">When the daily schedule is on, the list is prepared once a day between {time(`${view.day}T06:00:00Z`)} and {time(`${view.day}T06:59:00Z`)} Casablanca time.</p>
        <div className="mt-3">{runButton("Prepare today's leads now")}</div>
        {ownerOnly}
      </div>
    );
  } else if (view.run.round > 1) {
    // A later round: today's leads so far stay on screen whatever the round is doing.
    const r = view.run;
    const status = r.status === "COMPLETED" ? <CompletedStatus view={view} />
      : r.status === "RUNNING" ? (
        <div role="status" className="mb-3 text-[12.5px] text-[var(--os-text)]">
          <p className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Round {r.round} of {view.continuation.maxRounds} being prepared since {time(r.startedAt)} Casablanca time…</p>
          {r.stale
            ? <><p className="text-[12px] text-[var(--os-text-muted)] mt-1">This is taking longer than it should; the round probably stopped.</p><div className="mt-2">{runButton("Start this round again")}</div>{ownerOnly}</>
            : <p className="text-[12px] text-[var(--os-text-muted)] mt-1">Usually done within 5 minutes. This updates by itself.</p>}
        </div>
      ) : (
        <div role="alert" className="mb-3 text-[12.5px] text-[var(--os-text)]">
          <p>Round {r.round} couldn&apos;t be completed: {r.error ?? "Unknown error."}{r.completedAt ? ` (stopped at ${time(r.completedAt)} Casablanca time)` : ""} The leads below are kept.</p>
          <div className="mt-2">{runButton(`Try round ${r.round} again`)}</div>
          {ownerOnly}
        </div>
      );
    body = (
      <>
        {status}
        {view.leads.length > 0 ? (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {view.leads.map((l) => <LeadCard key={l.resultId} lead={l} state={imports[l.resultId] ?? {}} onImport={() => void importLead(l)} />)}
          </ul>
        ) : r.status === "COMPLETED" && <p className="text-[14px] text-[var(--os-text)]">No business met the bar today.</p>}
        {r.status === "COMPLETED" && <div className="mt-3">{continueButton()}</div>}
        <StatsLines view={view} />
        <IdentityReviewList view={view} />
      </>
    );
  } else if (view.run.status === "RUNNING") {
    body = (
      <div className={box} role="status">
        <p className="text-[14px] text-[var(--os-text)] inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Being prepared since {time(view.run.startedAt)} Casablanca time…</p>
        {view.run.stale
          ? <><p className="text-[12px] text-[var(--os-text-muted)] mt-1">This is taking longer than it should; the run probably stopped.</p><div className="mt-3">{runButton("Start again")}</div>{ownerOnly}</>
          : <p className="text-[12px] text-[var(--os-text-muted)] mt-1">Usually done within 5 minutes. This updates by itself.</p>}
      </div>
    );
  } else if (view.run.status === "FAILED") {
    body = (
      <div className={box} role="alert">
        <p className="text-[14px] text-[var(--os-text)]">Couldn&apos;t prepare today&apos;s leads.</p>
        <p className="text-[13px] text-[var(--os-text-muted)] mt-1">{view.run.error ?? "Unknown error."}{view.run.completedAt ? ` (stopped at ${time(view.run.completedAt)} Casablanca time)` : ""}</p>
        <div className="mt-3">{runButton("Try again")}</div>
        {ownerOnly}
      </div>
    );
  } else if (view.leads.length === 0) {
    body = (
      <div className={box}>
        <CompletedStatus view={view} />
        <p className="text-[14px] text-[var(--os-text)]">No business met the bar today.</p>
        <p className="text-[12px] text-[var(--os-text-muted)] mt-1">A lead needs a website read completely with a problem a customer would notice, or no website in OpenStreetMap but an explicit WhatsApp or Instagram tag. Nothing was padded.</p>
        <div className="mt-3">{continueButton()}</div>
        <StatsLines view={view} />
        <IdentityReviewList view={view} />
      </div>
    );
  } else {
    body = (
      <>
        <CompletedStatus view={view} />
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {view.leads.map((l) => <LeadCard key={l.resultId} lead={l} state={imports[l.resultId] ?? {}} onImport={() => void importLead(l)} />)}
        </ul>
        <div className="mt-3">{continueButton()}</div>
        <StatsLines view={view} />
        <IdentityReviewList view={view} />
      </>
    );
  }

  return (
    <section aria-labelledby="todays-leads" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <h2 id="todays-leads" className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-[0.14em] inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Today&apos;s leads{view?.run && (view.run.status === "COMPLETED" || view.leads.length > 0) ? ` · ${view.leads.length}` : ""}
        </h2>
        <p className="text-[11px] text-[var(--os-text-muted)]">Rule-based, no AI · contacts unverified · nothing is sent automatically</p>
      </div>
      {body}
      {runError && <p role="alert" className="mt-2 text-[12px] text-red-600">{runError}</p>}
      <p className="mt-2 text-[11px] text-[var(--os-text-muted)]">Business data © OpenStreetMap contributors (ODbL).</p>
    </section>
  );
}
