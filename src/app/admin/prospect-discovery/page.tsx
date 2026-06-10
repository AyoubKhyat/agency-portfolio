"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Compass, Search, Sparkles, Target as TargetIcon, AlertCircle, CheckCircle2,
  ExternalLink, Loader2, X, Star, Megaphone, ChevronDown, ChevronUp, RefreshCw, Info,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

/* ---------------- Types ---------------- */
type DuplicateStatus = "EXISTS" | "POSSIBLE" | "NEW";
type SearchItem = {
  sourceId: string;
  source: "GOOGLE" | "OSM";
  name: string;
  sector: string;
  city: string;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  duplicateStatus: DuplicateStatus;
  duplicateOf: string | null;
  duplicateReason: string | null;
};

type SearchResponse = {
  provider: "GOOGLE" | "OSM";
  total: number;
  counts: { new: number; possible: number; exists: number };
  items: SearchItem[];
};

type AiSuggestion = { sector: string; reason: string; action: string };
type AiSuggestResponse = {
  aiEnabled: boolean;
  summary: string;
  suggestions: AiSuggestion[];
};

type Target = {
  userId: string;
  name: string;
  role: string;
  targetImports: number;
  targetContacts: number;
  importedToday: number;
  contactedToday: number;
  repliedToday: number;
};

type User = { id: string; fullName: string; isActive: boolean };
type Template = { id: string; name: string; channel: string; language: string };

/* ---------------- Constants ---------------- */
const CITIES = [
  { key: "MARRAKECH", label: "Marrakech" },
  { key: "CASABLANCA", label: "Casablanca" },
  { key: "RABAT", label: "Rabat" },
  { key: "AGADIR", label: "Agadir" },
];

const SECTORS = [
  { key: "CLINICS", label: "Clinics" },
  { key: "DENTISTS", label: "Dentists" },
  { key: "RIADS", label: "Riads" },
  { key: "RESTAURANTS", label: "Restaurants" },
  { key: "REAL_ESTATE", label: "Real estate agencies" },
  { key: "SCHOOLS", label: "Schools" },
  { key: "BEAUTY", label: "Beauty salons" },
  { key: "GYMS", label: "Gyms" },
  { key: "LAWYERS", label: "Lawyers" },
  { key: "ACCOUNTANTS", label: "Accountants" },
];

const NEIGHBORHOODS_BY_CITY: Record<string, string[]> = {
  MARRAKECH: ["Gueliz", "Hivernage", "Targa", "Medina", "Majorelle", "Semlalia", "Sidi Ghanem", "Daoudiate"],
  CASABLANCA: ["Maarif", "Anfa", "Gauthier", "Sidi Belyout", "Ain Diab", "Bourgogne"],
  RABAT: ["Agdal", "Hassan", "Souissi", "Hay Riad", "Yacoub El Mansour"],
  AGADIR: ["Centre Ville", "Founty", "Talborjt", "Sonaba", "Hay Mohammadi"],
};

const DUP_BADGE: Record<DuplicateStatus, string> = {
  NEW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  POSSIBLE: "bg-amber-50 text-amber-700 border-amber-200",
  EXISTS: "bg-gray-100 text-gray-600 border-gray-200",
};

/* ---------------- Page ---------------- */
export default function ProspectDiscoveryPage() {
  // Search form
  const [city, setCity] = useState("MARRAKECH");
  const [sector, setSector] = useState("DENTISTS");
  const [neighborhood, setNeighborhood] = useState("");
  const [keyword, setKeyword] = useState("");

  // Search state
  const [searching, setSearching] = useState(false);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError] = useState<{ code: string; message: string } | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; createdIds: string[] } | null>(null);

  // Side data
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Campaign modal
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Initial loads
  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).then((u: User[]) => setUsers(u.filter((x) => x.isActive))).catch(() => {});
    fetch("/api/admin/sales-playbook/templates").then((r) => r.ok ? r.json() : []).then(setTemplates).catch(() => {});
    loadTargets();
  }, []);

  const loadTargets = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/admin/prospect-discovery/targets?date=${today}`);
    if (res.ok) {
      const data = await res.json();
      setTargets(data.targets || []);
    }
  }, []);

  async function loadAiSuggestions() {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/admin/prospect-discovery/ai-suggest");
      if (res.ok) setAiSuggestions(await res.json());
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSearch() {
    if (searching) return;
    setSearching(true);
    setSearchError(null);
    setSelected(new Set());
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/prospect-discovery/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city, sector,
          neighborhood: neighborhood || null,
          keyword: keyword || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError({ code: data.error || "SEARCH_FAILED", message: data.message || `Failed (${res.status})` });
        return;
      }
      setSearchData(data);
    } catch (err) {
      setSearchError({ code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Search failed" });
    } finally {
      setSearching(false);
    }
  }

  function errorTitle(code: string): string {
    switch (code) {
      case "OSM_REJECTED": return "OpenStreetMap rejected the query";
      case "OSM_UNAVAILABLE": return "OpenStreetMap is currently unavailable";
      case "OSM_RATE_LIMITED": return "OpenStreetMap rate-limited the request";
      case "OSM_TIMEOUT": return "OpenStreetMap query timed out";
      case "NETWORK_ERROR": return "Network error";
      default: return "Search failed";
    }
  }

  function errorHint(code: string): string | null {
    switch (code) {
      case "OSM_REJECTED":
      case "OSM_TIMEOUT":
        return "Try a more specific sector or add a GOOGLE_PLACES_API_KEY env var on Vercel for richer results.";
      case "OSM_UNAVAILABLE":
        return "Try again in a minute. Both Overpass mirrors failed.";
      case "OSM_RATE_LIMITED":
        return "Wait 30-60 seconds before searching again.";
      default:
        return null;
    }
  }

  function toggleSelect(sourceId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!searchData) return;
    const selectable = searchData.items.filter((i) => i.duplicateStatus !== "EXISTS");
    if (selected.size === selectable.length) setSelected(new Set());
    else setSelected(new Set(selectable.map((i) => i.sourceId)));
  }

  async function handleImport(specificIds?: string[]) {
    if (importing || !searchData) return;
    const ids = specificIds ?? Array.from(selected);
    if (ids.length === 0) return;
    const items = searchData.items.filter((i) => ids.includes(i.sourceId) && i.duplicateStatus !== "EXISTS");
    if (items.length === 0) return;

    setImporting(true);
    try {
      const res = await fetch("/api/admin/prospect-discovery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: items.map((i) => ({
            sourceId: i.sourceId, source: i.source, name: i.name, sector: i.sector,
            city: i.city, neighborhood: i.neighborhood, phone: i.phone, whatsapp: i.whatsapp,
            website: i.website, instagram: i.instagram, facebook: i.facebook,
            mapsUrl: i.mapsUrl, rating: i.rating, reviewCount: i.reviewCount,
          })),
          allowPossibleDuplicates: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setImportResult({
          imported: data.imported,
          skipped: data.skipped,
          createdIds: (data.created || []).map((c: { id: string }) => c.id),
        });
        // Remove imported items from selection
        setSelected(new Set());
        // Mark imported as EXISTS in current results
        const importedNames = new Set((data.created || []).map((c: { name: string }) => c.name));
        setSearchData((prev) => prev ? {
          ...prev,
          items: prev.items.map((i) => importedNames.has(i.name) ? { ...i, duplicateStatus: "EXISTS" as DuplicateStatus } : i),
        } : prev);
        loadTargets();
      }
    } finally {
      setImporting(false);
    }
  }

  const selectableCount = useMemo(
    () => searchData?.items.filter((i) => i.duplicateStatus !== "EXISTS").length || 0,
    [searchData]
  );

  const selectedItems = useMemo(
    () => searchData?.items.filter((i) => selected.has(i.sourceId)) || [],
    [searchData, selected]
  );

  return (
    <div>
      <PageHeader
        title="Prospect Discovery"
        subtitle="Find businesses by sector and city, then import them into Prospecting."
      />

      {/* AI suggestions banner */}
      <AiSuggestionsBlock data={aiSuggestions} loading={aiLoading} onLoad={loadAiSuggestions} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Search form */}
          <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
            <h2 className="text-[14px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#8B00FF]" />
              Search businesses
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">City</label>
                <select value={city} onChange={(e) => { setCity(e.target.value); setNeighborhood(""); }} className="w-full px-2.5 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {CITIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">Sector</label>
                <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {SECTORS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">Neighborhood</label>
                <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300">
                  <option value="">Any</option>
                  {(NEIGHBORHOODS_BY_CITY[city] || []).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#64748B] font-medium mb-1">Keyword</label>
                <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="(optional)" className="w-full px-2.5 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-4">
              <div className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                {searchData?.provider === "GOOGLE"
                  ? "Searching via Google Places (richer data)"
                  : "Searching via OpenStreetMap (free) · add GOOGLE_PLACES_API_KEY for Google Places"}
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {searching ? "Searching..." : "Search"}
              </button>
            </div>

            {searchError && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-amber-900">{errorTitle(searchError.code)}</div>
                  <div className="text-[12px] text-amber-800 mt-0.5">{searchError.message}</div>
                  {errorHint(searchError.code) && (
                    <div className="text-[11px] text-amber-700 mt-1.5 italic">{errorHint(searchError.code)}</div>
                  )}
                </div>
                <button onClick={() => setSearchError(null)} className="text-amber-600 hover:text-amber-800">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Import result */}
          {importResult && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#0F172A]">
                  Imported {importResult.imported} prospect{importResult.imported !== 1 ? "s" : ""}
                  {importResult.skipped > 0 && <span className="text-[#64748B] font-normal"> · skipped {importResult.skipped} duplicate{importResult.skipped !== 1 ? "s" : ""}</span>}
                </div>
                {importResult.imported > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setCampaignModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Megaphone className="w-3 h-3" />
                      Create campaign from {importResult.imported}
                    </button>
                    <button
                      onClick={() => setImportResult(null)}
                      className="text-[11px] text-[#64748B] hover:text-[#0F172A]"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {searchData && (
            <div className="rounded-2xl border border-[var(--os-border)] bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--os-border)] bg-gray-50/60">
                <div className="flex items-center gap-3 flex-wrap text-[12px]">
                  <span className="font-medium text-[#0F172A]">{searchData.total} results</span>
                  <span className="text-[#64748B]">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{searchData.counts.new} new</span>
                  <span className="inline-flex items-center gap-1 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{searchData.counts.possible} possible</span>
                  <span className="inline-flex items-center gap-1 text-[#64748B]"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{searchData.counts.exists} exists</span>
                </div>
                {selectableCount > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleImport()}
                      disabled={importing || selected.size === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm disabled:opacity-40"
                    >
                      {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Import {selected.size > 0 ? `${selected.size} selected` : "selected"}
                    </button>
                  </div>
                )}
              </div>

              {searchData.items.length === 0 ? (
                <EmptyState
                  icon={<Compass className="w-7 h-7" />}
                  title="No results"
                  description={searchData.provider === "OSM"
                    ? "OpenStreetMap coverage is sparse for some sectors in Morocco. Try a broader search or add GOOGLE_PLACES_API_KEY for fuller results."
                    : "Try a different sector, broader area, or check spelling."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--os-border)] text-[11px] uppercase tracking-wider text-[#64748B] font-medium">
                        <th className="px-3 py-2 text-left">
                          <input type="checkbox" checked={selected.size > 0 && selected.size === selectableCount} onChange={toggleSelectAll} className="rounded border-gray-300 text-purple-600" />
                        </th>
                        <th className="px-3 py-2 text-left">Business</th>
                        <th className="px-3 py-2 text-left hidden md:table-cell">Contact</th>
                        <th className="px-3 py-2 text-left hidden lg:table-cell">Rating</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchData.items.map((item) => {
                        const disabled = item.duplicateStatus === "EXISTS";
                        return (
                          <tr key={item.sourceId} className={cn("border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50/60", disabled && "opacity-60")}>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={selected.has(item.sourceId)}
                                onChange={() => toggleSelect(item.sourceId)}
                                className="rounded border-gray-300 text-purple-600 disabled:opacity-40"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-[13px] font-medium text-[#0F172A]">{item.name}</div>
                              <div className="text-[11px] text-[#64748B]">
                                {item.neighborhood ? `${item.neighborhood} · ` : ""}{item.city}
                                {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#8B00FF] hover:underline">website</a>}
                                {item.instagram && <span className="ml-2 text-[#7C3AED]">{item.instagram.startsWith("@") ? item.instagram : "@" + item.instagram}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#475569] hidden md:table-cell tabular-nums">
                              {item.phone || <span className="text-[#94A3B8]">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] hidden lg:table-cell">
                              {item.rating ? (
                                <div className="flex items-center gap-1 text-[#475569]">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {item.rating} <span className="text-[10px] text-[#94A3B8]">({item.reviewCount})</span>
                                </div>
                              ) : <span className="text-[#94A3B8]">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={cn("text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border", DUP_BADGE[item.duplicateStatus])} title={item.duplicateReason || undefined}>
                                {item.duplicateStatus.toLowerCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                {item.mapsUrl && (
                                  <a href={item.mapsUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-[#64748B] hover:text-[#8B00FF]" title="Open source">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleImport([item.sourceId])}
                                  disabled={disabled || importing}
                                  className="text-[11px] font-medium text-[#8B00FF] hover:bg-purple-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Import
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!searchData && !searching && (
            <EmptyState
              icon={<Compass className="w-7 h-7" />}
              title="Search to discover prospects"
              description="Pick a city, sector, and neighborhood, then click Search. Results show duplicate status against your existing prospects."
            />
          )}
        </div>

        {/* Right sidebar: targets */}
        <div className="lg:col-span-1 space-y-5">
          <TargetsWidget targets={targets} onUpdate={loadTargets} />
        </div>
      </div>

      {campaignModalOpen && importResult && (
        <CampaignModal
          prospectIds={importResult.createdIds}
          city={CITIES.find((c) => c.key === city)?.label}
          sector={SECTORS.find((s) => s.key === sector)?.label}
          users={users}
          templates={templates}
          onClose={() => setCampaignModalOpen(false)}
          onCreated={() => { setCampaignModalOpen(false); setImportResult(null); }}
        />
      )}
    </div>
  );
}

/* ---------------- AI Suggestions Block ---------------- */
function AiSuggestionsBlock({ data, loading, onLoad }: { data: AiSuggestResponse | null; loading: boolean; onLoad: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/40 to-violet-50/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#8B00FF]" />
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Best sectors to target this week</h2>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={() => setExpanded((v) => !v)} className="text-[11px] text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Hide" : "Show"}
            </button>
          )}
          <button onClick={onLoad} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-purple-300 bg-white text-[#7C3AED] hover:bg-purple-50 disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {data ? "Refresh" : "Generate suggestions"}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="text-[13px] text-[#0F172A] font-medium mt-2">{data.summary}</div>
          {expanded && data.suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {data.suggestions.map((s, i) => (
                <div key={i} className="rounded-xl border border-purple-200 bg-white p-3">
                  <div className="text-[13px] font-semibold text-[#0F172A]">{s.sector}</div>
                  <div className="text-[11px] text-[#64748B] mt-1">{s.reason}</div>
                  <div className="text-[11px] text-[#7C3AED] font-medium mt-2">→ {s.action}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Targets Widget ---------------- */
function TargetsWidget({ targets, onUpdate }: { targets: Target[]; onUpdate: () => void }) {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);

  async function save(userId: string) {
    const today = new Date().toISOString().slice(0, 10);
    await fetch("/api/admin/prospect-discovery/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date: today, targetImports: editValue }),
    });
    setEditingUser(null);
    onUpdate();
  }

  return (
    <div className="rounded-2xl border border-[var(--os-border)] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <TargetIcon className="w-4 h-4 text-[#8B00FF]" />
        <h2 className="text-[14px] font-semibold text-[#0F172A]">Today&apos;s prospecting targets</h2>
      </div>

      {targets.length === 0 ? (
        <p className="text-[12px] text-[#94A3B8]">No active team members.</p>
      ) : (
        <div className="space-y-3">
          {targets.map((t) => {
            const importPct = t.targetImports > 0 ? Math.min(100, (t.importedToday / t.targetImports) * 100) : 0;
            const contactPct = t.targetContacts > 0 ? Math.min(100, (t.contactedToday / t.targetContacts) * 100) : 0;
            return (
              <div key={t.userId} className="border-b border-[var(--os-border)] last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-[#0F172A]">{t.name}</span>
                  {editingUser === t.userId ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(parseInt(e.target.value, 10) || 0)}
                        className="w-14 px-1.5 py-0.5 rounded border border-[var(--os-border)] text-[11px] text-right"
                      />
                      <button onClick={() => save(t.userId)} className="text-[11px] text-emerald-600 font-medium hover:text-emerald-700">Save</button>
                      <button onClick={() => setEditingUser(null)} className="text-[#94A3B8]"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingUser(t.userId); setEditValue(t.targetImports); }}
                      className="text-[10px] text-[#64748B] hover:text-[#8B00FF]"
                    >
                      Edit target
                    </button>
                  )}
                </div>

                {/* Imports bar */}
                <div className="text-[10px] text-[#64748B] flex items-center justify-between mb-0.5">
                  <span>Imports</span>
                  <span className="tabular-nums">{t.importedToday} / {t.targetImports}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1.5">
                  <div className="h-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3] transition-all" style={{ width: `${importPct}%` }} />
                </div>

                {/* Contacts bar */}
                <div className="text-[10px] text-[#64748B] flex items-center justify-between mb-0.5">
                  <span>Contacts</span>
                  <span className="tabular-nums">{t.contactedToday} / {t.targetContacts}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${contactPct}%` }} />
                </div>

                {t.repliedToday > 0 && (
                  <div className="text-[10px] text-emerald-700 mt-1">+ {t.repliedToday} reply{t.repliedToday !== 1 ? "s" : ""} today</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Campaign Modal ---------------- */
function CampaignModal({
  prospectIds, city, sector, users, templates, onClose, onCreated,
}: {
  prospectIds: string[];
  city: string | undefined;
  sector: string | undefined;
  users: User[];
  templates: Template[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const [name, setName] = useState(`${sector || "Sector"} · ${city || "City"} · ${today}`);
  const [ownerId, setOwnerId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prospect-discovery/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, sector, city, ownerId: ownerId || null,
          templateId: templateId || null, prospectIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-purple-300";
  const labelCls = "block text-[12px] font-medium text-[#475569] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--os-border)]">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#8B00FF]" />
            <h2 className="text-lg font-semibold text-[#0F172A]">New campaign</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-[12px] text-[#475569]">
            Group <span className="font-medium text-[#0F172A]">{prospectIds.length} just-imported prospects</span> under one campaign for tracking and assignment.
          </div>

          <div>
            <label className={labelCls}>Campaign name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Assign to</label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Default template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel.toLowerCase()})</option>)}
              </select>
            </div>
          </div>

          <div className="text-[11px] text-[#64748B] bg-gray-50 rounded-lg p-2.5 leading-relaxed">
            <Info className="inline w-3 h-3 mr-1" />
            Follow-up sequence is automatic: Day 1 → 4 → 10 → 20 once initial contact is logged. Track in the Sales Playbook.
          </div>

          {error && <div className="text-[12px] text-red-600">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9]">Skip</button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={cn(
                "px-5 py-2 rounded-xl text-[13px] font-medium text-white shadow-md transition-all",
                saving ? "bg-gray-400" : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:shadow-lg"
              )}
            >
              {saving ? "Creating..." : "Create campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
