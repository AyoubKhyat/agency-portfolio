"use client";

import { useState } from "react";
import { Loader2, Search, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SECTORS } from "@/lib/discovery-providers";
import { rankTop } from "@/lib/batch-rank";
import type { AuditedCandidate, BatchCandidate, SearchSummary, Confidence } from "@/lib/batch-discovery";

const AUDIT_CHUNK = 3;
const card = "rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5";
const small = "text-[12px] text-[var(--os-text-dim)]";

const CONFIDENCE: Record<Confidence, string> = {
  HIGH: "High: OpenStreetMap and the website give the same number",
  MEDIUM: "Medium: one source only",
  CONFLICT: "Low: the sources give different numbers, none used",
  NONE: "None: no WhatsApp link found (a phone number is not a WhatsApp)",
};

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

type ImportState = { status: "idle" | "busy" | "done" | "skipped" | "error"; message?: string };

function ResultCard({ a, rank }: { a: AuditedCandidate; rank: number }) {
  const [imp, setImp] = useState<ImportState>({ status: "idle" });
  const c = a.candidate;

  /** The import route rechecks duplicates against the CRM as it is now, and saves contacts UNVERIFIED. */
  async function importOne() {
    setImp({ status: "busy" });
    try {
      const res = await fetch("/api/admin/prospect-discovery/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: [{ ...c, whatsapp: a.whatsapp.link || null }] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setImp({ status: "error", message: data?.error ?? "The import failed." });
      else if (data?.imported === 1) setImp({ status: "done", message: "Imported. Its contacts are UNVERIFIED until a person opens and checks them." });
      else setImp({ status: "skipped", message: `Not imported: ${data?.skippedDetails?.[0]?.reason ?? "already in the CRM"}` });
    } catch {
      setImp({ status: "error", message: "The import failed." });
    }
  }

  return (
    <li className={card}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[12px] font-semibold text-[var(--os-purple)]">#{rank}</span>
        <span className="text-[15px] font-semibold text-[var(--os-text)]">{c.name}</span>
        {c.neighborhood && <span className={small}>{c.neighborhood}</span>}
      </div>
      <p className={`${small} break-all mt-1`}>Website: {a.finalUrl ?? c.website}</p>

      <p className="text-[12px] font-medium text-[var(--os-text)] mt-3">What a customer would notice</p>
      <ul className="mt-1 space-y-1.5">
        {a.findings.map((f) => (
          <li key={f.id} className="text-[13px] text-[var(--os-text-muted)]">
            {f.sentence}
            <span className={`block ${small}`}>{f.check}: seen &quot;{f.observed}&quot; · <span className="break-all">{f.sourceUrl}</span> · <span className="whitespace-nowrap">read {when(f.fetchedAt)}</span></span>
          </li>
        ))}
      </ul>
      {a.otherProblems.length > 0 && <p className={`${small} mt-1`}>Also {a.otherProblems.length} minor technical {a.otherProblems.length === 1 ? "issue" : "issues"} ({a.otherProblems.map((p) => p.check).join(", ")}).</p>}

      <p className="text-[12px] font-medium text-[var(--os-text)] mt-3">WhatsApp · <span className="text-amber-700">UNVERIFIED</span></p>
      <p className={small}>{a.whatsapp.link ? `${a.whatsapp.link} · ` : ""}{CONFIDENCE[a.whatsapp.confidence]}</p>
      {a.whatsapp.sources.map((s) => (
        <p key={`${s.kind}${s.url}${s.link}`} className={`${small} break-all`}>{s.kind === "OSM_TAG" ? "OpenStreetMap tag" : "Linked on the website"}: {s.link} · {s.url}</p>
      ))}
      {c.phone && <p className={small}>Phone (not checked for WhatsApp): {c.phone}</p>}

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {c.mapsUrl && (
          <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--os-purple)] hover:underline inline-flex items-center gap-1">
            OpenStreetMap source <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button type="button" onClick={importOne} disabled={imp.status === "busy" || imp.status === "done"}
          className="px-3 py-1.5 rounded-lg border border-[var(--os-border)] text-[12px] font-medium text-[var(--os-text)] hover:bg-[var(--os-hover)] disabled:opacity-50">
          {imp.status === "busy" ? "Importing…" : imp.status === "done" ? "Imported" : "Import as prospect"}
        </button>
        {imp.message && <span className={`text-[12px] ${imp.status === "done" ? "text-emerald-700" : imp.status === "error" ? "text-red-600" : "text-amber-700"}`}>{imp.message}</span>}
      </div>
    </li>
  );
}

export default function BatchDiscoveryPage() {
  const [sector, setSector] = useState(SECTORS[0].key);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [audited, setAudited] = useState<AuditedCandidate[]>([]);
  const [failedChunks, setFailedChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function post(body: object) {
    const res = await fetch("/api/admin/batch-discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "That step failed.");
    return data;
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSummary(null); setAudited([]); setFailedChunks(0);
    try {
      setBusy("Searching OpenStreetMap…");
      const s: SearchSummary = await post({ action: "search", sector });
      setSummary(s);
      // Small steps, one after another: each request checks at most three sites.
      for (let i = 0; i < s.candidates.length; i += AUDIT_CHUNK) {
        const chunk: BatchCandidate[] = s.candidates.slice(i, i + AUDIT_CHUNK);
        setBusy(`Checking websites ${i + 1}–${i + chunk.length} of ${s.candidates.length}…`);
        try {
          const { audited: got } = await post({ action: "audit", candidates: chunk });
          setAudited((prev) => [...prev, ...got]);
        } catch {
          setFailedChunks((n) => n + 1); // keep going: partial results beat none
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The search failed.");
    } finally {
      setBusy(null);
    }
  }

  const top = rankTop(audited);
  const notRead = audited.filter((a) => a.outcome !== "COMPLETE").length;
  const linked = audited.filter((a) => a.inCrm).length;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Find businesses" subtitle="Marrakech businesses from OpenStreetMap, not yet in the CRM, ranked by website problems a customer would notice. Nothing is saved until you import one." />

      <form onSubmit={run} className={`${card} flex flex-col sm:flex-row gap-2 mb-4`}>
        <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector"
          className="flex-1 rounded-lg border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-2 text-[14px] text-[var(--os-text)]">
          {SECTORS.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.category})</option>)}
        </select>
        <button type="submit" disabled={!!busy} className="px-4 py-2 rounded-lg bg-[var(--os-purple)] text-white text-[13px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Find in Marrakech
        </button>
      </form>

      {busy && <p className={`${small} mb-3`}>{busy}</p>}
      {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}

      {summary && (
        <div className={`${card} mb-4`}>
          {summary.sourceError && <p className="text-[13px] text-amber-700 mb-2">{summary.sourceError}</p>}
          <p className="text-[13px] text-[var(--os-text)]">
            {summary.found} found · {summary.skipped.noWebsite} without a website · {summary.skipped.inCrm} already in the CRM
            {summary.skipped.possibleDuplicate > 0 && ` · ${summary.skipped.possibleDuplicate} possible duplicates`}
            {summary.skipped.sameSiteInBatch > 0 && ` · ${summary.skipped.sameSiteInBatch} sharing a website`}
            {summary.skipped.overLimit > 0 && ` · ${summary.skipped.overLimit} over the limit of 10`}
            {" "}· {summary.candidates.length} websites to check
          </p>
          {audited.length > 0 && (
            <p className={`${small} mt-1`}>
              {audited.length} checked · {notRead} couldn&apos;t be read (robots.txt, error or too little content) · {linked} linked to the CRM
              {failedChunks > 0 && ` · ${failedChunks} step${failedChunks === 1 ? "" : "s"} failed, results are partial`}
            </p>
          )}
        </div>
      )}

      {!busy && summary && audited.length > 0 && top.length === 0 && (
        <p className={`${small} mb-4`}>None of the websites checked had a problem a customer would notice.</p>
      )}
      {top.length > 0 && (
        <ol className="space-y-3 mb-4">
          {top.map((a, i) => <ResultCard key={a.candidate.sourceId} a={a} rank={i + 1} />)}
        </ol>
      )}

      <p className={`${small} mb-8`}>
        Business data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>, available under the Open Database Licence.
        Websites are read with the safe website check, which follows each site&apos;s robots.txt. Contacts are never verified here.
      </p>
    </div>
  );
}
