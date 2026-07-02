"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Sparkles, Globe, Phone, Mail, AtSign, ExternalLink,
  CheckCircle2, AlertTriangle, ArrowUpRight, Loader2, Zap, Wand2,
  MessageCircle, MailPlus, X, Copy, Check,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SEGMENT_LABELS, SEGMENT_TOKENS, type ProspectSegment } from "@/lib/prospect-segments";
import type { DiscoveryResultDTO } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Luxury hotels in Nice",
  "Web agencies in Lyon",
  "Architecture studios in Paris",
  "Premium restaurants in Marrakech",
];

type SearchState =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | { kind: "results"; query: string; results: DiscoveryResultDTO[] }
  | { kind: "error"; query: string; message: string };

type PreviewModal =
  | null
  | { kind: "email"; result: DiscoveryResultDTO; subject: string; body: string }
  | { kind: "whatsapp"; result: DiscoveryResultDTO; body: string };

export default function DiscoveryPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [preview, setPreview] = useState<PreviewModal>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    setState({ kind: "loading", query: trimmed });
    try {
      const res = await fetch("/api/admin/discovery/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: { results: DiscoveryResultDTO[] } = await res.json();
      setState({ kind: "results", query: trimmed, results: data.results });
    } catch (err) {
      setState({ kind: "error", query: trimmed, message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  function handleExample(ex: string) {
    setQuery(ex);
    runSearch(ex);
  }

  function handleImported(id: string, prospectId: string) {
    if (state.kind !== "results") return;
    setState({
      ...state,
      results: state.results.map((r) => (r.id === id ? { ...r, importedProspectId: prospectId } : r)),
    });
  }

  const hotCount = state.kind === "results" ? state.results.filter((r) => r.opportunityScore >= 70).length : 0;
  const newCount = state.kind === "results" ? state.results.filter((r) => r.duplicate.status === "NEW").length : 0;
  const dupCount = state.kind === "results" ? state.results.filter((r) => r.duplicate.status !== "NEW").length : 0;

  return (
    <div>
      <PageHeader
        title="AI Business Development"
        subtitle="Describe an ideal client — the agent finds, audits, scores and pre-qualifies them."
      />

      {/* Search bar */}
      <motion.form
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        onSubmit={handleSubmit}
        className="relative"
      >
        <div className="relative rounded-2xl border border-[var(--os-border)] bg-white shadow-sm hover:shadow-md hover:border-purple-200 transition-all focus-within:border-purple-300 focus-within:shadow-md">
          <div className="pl-5 pr-3 py-4 flex items-center gap-3">
            <Search className="w-5 h-5 text-[#8B00FF] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe your ideal client — e.g. Luxury hotels in Nice"
              className="flex-1 bg-transparent text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
            />
            <button
              type="submit"
              disabled={state.kind === "loading" || query.trim().length < 3}
              className={cn(
                "px-4 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-1.5",
                query.trim().length < 3 || state.kind === "loading"
                  ? "bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed"
                  : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-500/30"
              )}
            >
              {state.kind === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Discover
                </>
              )}
            </button>
          </div>
        </div>

        {/* Example chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[11px] text-[var(--os-text-muted)] font-medium px-1 pt-1.5">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => handleExample(ex)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium border border-[var(--os-border)] bg-white text-[#475569] hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 transition-all"
            >
              {ex}
            </button>
          ))}
        </div>
      </motion.form>

      {/* Results header */}
      <AnimatePresence mode="wait">
        {state.kind === "results" && state.results.length > 0 && (
          <motion.div
            key="header"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="mt-8 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <div className="text-[13px] text-[var(--os-text-muted)]">Results for</div>
              <div className="text-[15px] font-semibold text-[var(--os-text)]">&ldquo;{state.query}&rdquo;</div>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-medium">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{state.results.length} found</span>
              {hotCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {hotCount} hot
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{newCount} new</span>
              {dupCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{dupCount} in DB</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {state.kind === "loading" && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-[var(--os-border)] bg-white p-6 space-y-4">
              <div className="h-5 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
              <div className="flex gap-2 pt-2">
                <div className="h-8 bg-slate-100 rounded-lg w-24" />
                <div className="h-8 bg-slate-100 rounded-lg w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {state.kind === "error" && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <div className="font-semibold text-red-800 text-[14px]">Discovery failed</div>
              <div className="text-red-700 text-[13px] mt-1">{state.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state (idle) */}
      {state.kind === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 mb-4">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-[15px] font-semibold text-[var(--os-text)]">Ready to find your next clients</div>
          <p className="text-[13px] text-[var(--os-text-muted)] mt-1.5 max-w-md mx-auto">
            The AI Business Development Agent will search, audit, score and pre-qualify each business — then let you import the good ones into Relationships in one click.
          </p>
        </motion.div>
      )}

      {/* Results grid */}
      {state.kind === "results" && state.results.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {state.results.map((r, i) => (
            <ResultCard
              key={r.id}
              result={r}
              delay={i * 0.03}
              onImported={handleImported}
              onPreview={setPreview}
            />
          ))}
        </div>
      )}

      {state.kind === "results" && state.results.length === 0 && (
        <div className="mt-12 text-center">
          <div className="text-[14px] text-[var(--os-text-muted)]">No businesses matched that query. Try a broader term.</div>
        </div>
      )}

      {/* Preview modal */}
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/* ─────────────────────────── Result card ─────────────────────────── */

function ResultCard({
  result,
  delay,
  onImported,
  onPreview,
}: {
  result: DiscoveryResultDTO;
  delay: number;
  onImported: (id: string, prospectId: string) => void;
  onPreview: (m: PreviewModal) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<null | "email" | "whatsapp">(null);
  const dup = result.duplicate;
  const seg = result.suggestedSegment as ProspectSegment;
  const segTok = SEGMENT_TOKENS[seg];
  const opp = result.opportunityScore;
  const conf = result.confidenceScore;
  const oppLabel = opp >= 70 ? "HOT" : opp >= 45 ? "WARM" : "COLD";
  const oppColor =
    opp >= 70 ? "text-orange-600 bg-orange-50 border-orange-100" :
    opp >= 45 ? "text-amber-700 bg-amber-50 border-amber-100" :
    "text-slate-600 bg-slate-50 border-slate-200";

  const isImported = Boolean(result.importedProspectId);
  const isDuplicate = dup.status === "EXISTS";

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveryResultId: result.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onImported(result.id, data.prospectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handlePreview(channel: "email" | "whatsapp") {
    setPreviewLoading(channel);
    try {
      const res = await fetch("/api/admin/discovery/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveryResultId: result.id, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      if (channel === "email") onPreview({ kind: "email", result, subject: data.subject, body: data.body });
      else onPreview({ kind: "whatsapp", result, body: data.body });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(null);
    }
  }

  const canPreviewEmail = result.validity.email;
  const canPreviewWhatsapp = result.validity.whatsapp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={cn(
        "group relative rounded-2xl border bg-white overflow-hidden transition-all",
        isDuplicate
          ? "border-amber-200/70 bg-amber-50/30"
          : "border-[var(--os-border)] hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/[0.04]"
      )}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold text-[#0F172A] truncate">{result.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--os-text-muted)]">
              <span className="font-medium text-[#475569]">{result.sector || "Business"}</span>
              {(result.city || result.country) && (
                <>
                  <span>·</span>
                  <span>{[result.city, result.country].filter(Boolean).join(", ")}</span>
                </>
              )}
            </div>
          </div>

          {/* Opportunity badge */}
          <div className={cn("shrink-0 flex flex-col items-center rounded-xl border px-3 py-2 min-w-[68px]", oppColor)}>
            <div className="text-[18px] font-bold leading-none">{opp}</div>
            <div className="text-[9px] font-bold tracking-wider uppercase mt-1">{oppLabel}</div>
          </div>
        </div>

        {/* AI Summary */}
        {result.aiSummary && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#475569]">
            {result.aiSummary}
          </p>
        )}

        {/* Suggested offer */}
        {result.suggestedOffer && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-purple-50/70 border border-purple-100 p-3">
            <Wand2 className="w-3.5 h-3.5 text-purple-600 mt-0.5 shrink-0" />
            <div className="text-[12.5px] text-purple-900 leading-relaxed">
              <span className="font-semibold">Suggested offer — </span>
              {result.suggestedOffer}
            </div>
          </div>
        )}

        {/* Contact strip — only valid fields render as click-throughs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {result.validity.website && result.website && (
            <ContactChip icon={Globe} href={result.website} label={hostOnly(result.website)} />
          )}
          {result.validity.phone && result.phone && (
            <ContactChip icon={Phone} href={`tel:${result.phone.replace(/\s+/g, "")}`} label={result.phone} />
          )}
          {result.validity.email && result.email && (
            <ContactChip icon={Mail} href={`mailto:${result.email}`} label={result.email} />
          )}
          {result.validity.instagram && result.instagram && (
            <ContactChip icon={AtSign} href={result.instagramUrl} label={`@${result.instagram}`} />
          )}
        </div>

        {/* Preview outreach — always available when the corresponding channel is valid */}
        {(canPreviewEmail || canPreviewWhatsapp) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canPreviewEmail && (
              <PreviewButton
                icon={MailPlus}
                label="Preview email"
                loading={previewLoading === "email"}
                onClick={() => handlePreview("email")}
              />
            )}
            {canPreviewWhatsapp && (
              <PreviewButton
                icon={MessageCircle}
                label="Preview WhatsApp"
                loading={previewLoading === "whatsapp"}
                onClick={() => handlePreview("whatsapp")}
              />
            )}
          </div>
        )}

        {/* Segment + confidence + source */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full border font-semibold", segTok.chipBg, segTok.chipText, segTok.chipBorder)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", segTok.dot)} />
            {SEGMENT_LABELS[seg]}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600 font-semibold">
            Conf {conf}
          </span>
          {result.validity.sourceUrl && result.sourceUrl && (
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Source
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="min-w-0">
            {dup.status === "EXISTS" && (
              <div className="flex items-center gap-1.5 text-[12px] text-amber-800 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Already exists — {dup.reason}
              </div>
            )}
            {dup.status === "POSSIBLE" && (
              <div className="flex items-center gap-1.5 text-[12px] text-slate-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Possible match — {dup.reason}
              </div>
            )}
            {dup.status === "NEW" && !isImported && (
              <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                New — ready to import
              </div>
            )}
            {isImported && (
              <div className="flex items-center gap-1.5 text-[12px] text-purple-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Imported
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDuplicate && dup.prospectId && (
              <Link
                href={`/admin/prospecting/${dup.prospectId}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-amber-800 bg-white border border-amber-200 hover:bg-amber-50 transition-colors"
              >
                Open Relationship
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {isImported && result.importedProspectId && (
              <Link
                href={`/admin/prospecting/${result.importedProspectId}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 transition-colors"
              >
                Open Relationship
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {!isDuplicate && !isImported && (
              <button
                onClick={handleImport}
                disabled={importing}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold transition-all",
                  importing
                    ? "bg-purple-100 text-purple-500 cursor-wait"
                    : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm hover:shadow-md"
                )}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing
                  </>
                ) : (
                  <>
                    Import
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── Chips + preview UI ─────────────────────────── */

function ContactChip({
  icon: Icon,
  href,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="min-w-0">
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] max-w-[220px] bg-slate-50 text-slate-700 border border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors">
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    </a>
  );
}

function PreviewButton({
  icon: Icon,
  label,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-all",
        loading
          ? "bg-slate-50 text-slate-400 border-slate-200 cursor-wait"
          : "bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50"
      )}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}

function PreviewModal({
  preview,
  onClose,
}: {
  preview: PreviewModal;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"subject" | "body" | "message" | null>(null);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, onClose]);

  async function copy(key: "subject" | "body" | "message", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch { /* ignore */ }
  }

  return (
    <AnimatePresence>
      {preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-[var(--os-border)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                {preview.kind === "email" ? (
                  <MailPlus className="w-4 h-4 text-purple-600 shrink-0" />
                ) : (
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#0F172A]">
                    {preview.kind === "email" ? "Email preview" : "WhatsApp preview"}
                  </div>
                  <div className="text-[11.5px] text-[var(--os-text-muted)] truncate">
                    Draft for {preview.result.name}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
              {preview.kind === "email" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Subject</div>
                      <button
                        onClick={() => copy("subject", preview.subject)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-700 transition-colors"
                      >
                        {copied === "subject" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === "subject" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-[#0F172A] font-medium">
                      {preview.subject}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Body</div>
                      <button
                        onClick={() => copy("body", preview.body)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-700 transition-colors"
                      >
                        {copied === "body" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === "body" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[#0F172A] whitespace-pre-wrap font-sans">
{preview.body}
                    </pre>
                  </div>
                </>
              )}

              {preview.kind === "whatsapp" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Message</div>
                    <button
                      onClick={() => copy("message", preview.body)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-700 transition-colors"
                    >
                      {copied === "message" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === "message" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-3 text-[13px] leading-relaxed text-[#0F172A] whitespace-pre-wrap">
                    {preview.body}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="text-[11px] text-[var(--os-text-muted)]">
                Preview only — nothing is sent from here.
              </div>
              {preview.kind === "whatsapp" && preview.result.whatsappUrl && (
                <a
                  href={`${preview.result.whatsappUrl}${preview.result.whatsappUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(preview.body)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Open in WhatsApp
                </a>
              )}
              {preview.kind === "email" && preview.result.email && (
                <a
                  href={`mailto:${preview.result.email}?subject=${encodeURIComponent(preview.subject)}&body=${encodeURIComponent(preview.body)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Open in mail client
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function hostOnly(url: string): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
