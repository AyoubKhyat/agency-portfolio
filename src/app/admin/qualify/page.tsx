"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Search, AlertTriangle, HelpCircle, CheckCircle2, ExternalLink, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import type { QualificationResult, FoundContact, ProspectMatch } from "@/lib/prospect-qualification";

const OUTCOME_TEXT: Record<QualificationResult["outcome"], string> = {
  COMPLETE: "Page read. The results below are from the page.",
  UNVERIFIED: "The site answered, but with too little to judge it (a bot check, an empty page, or a page built by JavaScript).",
  UNREADABLE: "The site didn't answer properly, so nothing about it can be judged.",
  ROBOTS_DISALLOWED: "The site asks automated tools not to read this page, so it wasn't read.",
  ROBOTS_UNREACHABLE: "The site's robots.txt answered with an error, so the page wasn't read.",
  BLOCKED: "This address isn't allowed (not a public website), so nothing was read.",
};

const card = "rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5";
const heading = "text-[13px] font-semibold text-[var(--os-text)] mb-3 flex items-center gap-2";
const small = "text-[12px] text-[var(--os-text-dim)]";

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/** Not a clickable link: the address came from someone else's site. */
function Source({ url, fetchedAt }: { url: string; fetchedAt: string }) {
  return (
    <p className={`${small} mt-1`}>
      Source: <span className="break-all">{url}</span> · <span className="whitespace-nowrap">read {when(fetchedAt)}</span>
    </p>
  );
}

function HumanStatus({ label, value }: { label: string; value: string }) {
  const verified = value === "VERIFIED";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${verified ? "border-emerald-300 text-emerald-700" : "border-[var(--os-border)] text-[var(--os-text-dim)]"}`}>
      {label}: {verified ? "VERIFIED by a person" : value}
    </span>
  );
}

function ContactRow({ c }: { c: FoundContact }) {
  return (
    <li className="rounded-lg border border-[var(--os-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-[var(--os-text)]">{c.channel === "WHATSAPP" ? "WhatsApp" : "Instagram"}</span>
        <span className="text-[13px] text-[var(--os-text-muted)] break-all">{c.value || c.note}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-300 text-amber-700" title="The site links to it. No one has confirmed it yet.">
          FOUND_ON_SITE · not verified
        </span>
      </div>
      {c.value && c.note && <p className={small}>{c.note}</p>}
      {c.link && <p className={`${small} break-all mt-1`}>Link: {c.link}</p>}
      <Source url={c.sourceUrl} fetchedAt={c.fetchedAt} />
    </li>
  );
}

function MatchRow({ m }: { m: ProspectMatch }) {
  return (
    <li className="rounded-lg border border-[var(--os-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/prospecting/${m.prospectId}`} className="text-[13px] font-medium text-[var(--os-purple)] hover:underline inline-flex items-center gap-1">
          {m.prospectName || "(no name)"} <ExternalLink className="w-3 h-3" />
        </Link>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${m.status === "EXISTS" ? "border-red-300 text-red-600" : "border-amber-300 text-amber-700"}`}>
          {m.status === "EXISTS" ? "Already in the CRM" : "Possible match"}
        </span>
      </div>
      <p className={`${small} mt-1`}>{m.reasons.join(" · ")}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <HumanStatus label="WhatsApp" value={m.whatsappStatus} />
        <HumanStatus label="Instagram" value={m.instagramStatus} />
      </div>
    </li>
  );
}

export default function QualifyPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QualificationResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/prospect-qualification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error ?? `The check failed (${res.status})`);
      else setResult(data as QualificationResult);
    } catch {
      setError("The check failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Check a website" subtitle="Reads one public page. Nothing is sent, saved or added to the CRM." />

      <form onSubmit={run} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.ma"
          aria-label="Website address"
          className="flex-1 min-w-0 rounded-lg border border-[var(--os-border)] bg-[var(--os-surface)] px-3 py-2.5 text-[14px] text-[var(--os-text)] outline-none focus:border-[var(--os-purple)]"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--os-purple)] px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Checking…" : "Check"}
        </button>
      </form>

      {error && <p role="alert" className="text-[13px] text-red-600 mb-4">{error}</p>}

      {result && (
        <div className="space-y-4">
          <section className={card}>
            <p className="text-[14px] text-[var(--os-text)] break-all">{result.finalUrl ?? result.targetUrl}</p>
            <p className="text-[13px] text-[var(--os-text-muted)] mt-1">{OUTCOME_TEXT[result.outcome]}</p>
            <p className={`${small} mt-2`}>
              {result.problems.length} {result.problems.length === 1 ? "problem" : "problems"} ·{result.unknown.length} couldn&apos;t check · {result.passed} fine
              {result.gapScore !== null && <> · gap score {result.gapScore} ({result.fitLabel})</>}
              {" "}· {Math.round(result.durationMs / 100) / 10}s
            </p>
          </section>

          <section className={card}>
            <h2 className={heading}><AlertTriangle className="w-4 h-4 text-red-600" /> Website problems, with proof</h2>
            {result.problems.length === 0 ? (
              <p className={small}>No problems found in what was read.</p>
            ) : (
              <ul className="space-y-2.5">
                {result.problems.map((p) => (
                  <li key={p.id} className="rounded-lg border border-[var(--os-border)] p-3">
                    <p className="text-[13px] font-medium text-[var(--os-text)]">{p.check}</p>
                    <p className="text-[13px] text-[var(--os-text-muted)] break-words">Seen: {p.observed}</p>
                    <Source url={p.sourceUrl} fetchedAt={p.fetchedAt} />
                  </li>
                ))}
              </ul>
            )}
            {result.unknown.length > 0 && (
              <details className="mt-3">
                <summary className={`${small} cursor-pointer inline-flex items-center gap-1`}><HelpCircle className="w-3.5 h-3.5" /> {result.unknown.length} not decided (not problems)</summary>
                <ul className="mt-2 space-y-1.5">
                  {result.unknown.map((p) => <li key={p.id} className={small}>{p.check}: {p.observed}</li>)}
                </ul>
              </details>
            )}
          </section>

          <section className={card}>
            <h2 className={heading}><CheckCircle2 className="w-4 h-4 text-[var(--os-text-dim)]" /> WhatsApp and Instagram links on the site</h2>
            <p className={`${small} mb-3`}>
              FOUND_ON_SITE means the site links to it, nothing more. Only a person can mark a contact VERIFIED, on the prospect&apos;s page.
            </p>
            {result.contacts.length === 0 ? (
              <p className={small}>{result.outcome === "COMPLETE" || result.outcome === "UNVERIFIED" ? "None found on this page." : "The page wasn't read, so no links were looked for."}</p>
            ) : (
              <ul className="space-y-2.5">{result.contacts.map((c, i) => <ContactRow key={`${c.channel}-${i}`} c={c} />)}</ul>
            )}
          </section>

          <section className={card}>
            <h2 className={heading}><Users className="w-4 h-4 text-[var(--os-text-dim)]" /> Already in the CRM?</h2>
            {!result.duplicates.checked ? (
              <p className="text-[13px] text-amber-700">Not checked: {result.duplicates.reason}.</p>
            ) : result.duplicates.matches.length === 0 ? (
              <p className={small}>No prospect shares this site, these numbers or these Instagram accounts.</p>
            ) : (
              <ul className="space-y-2.5">{result.duplicates.matches.map((m) => <MatchRow key={m.prospectId} m={m} />)}</ul>
            )}
            <p className={`${small} mt-3`}>Only prospects are checked, not enquiries or clients.</p>
          </section>
        </div>
      )}
    </div>
  );
}
