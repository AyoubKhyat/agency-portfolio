"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Target, Users, FileText, X, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/badge";
import { cn } from "@/lib/utils";

type ProspectResult = {
  id: string;
  name: string;
  sector: string;
  status: string;
  phone: string;
  instagram: string;
};

type LeadResult = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  subject: string;
};

type NoteResult = {
  id: string;
  content: string;
  prospectId: string;
  authorName: string | null;
  prospect: { name: string };
};

type SearchResults = {
  prospects: ProspectResult[];
  leads: LeadResult[];
  notes: NoteResult[];
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

const STATUS_BADGE: Record<string, string> = {
  A_ENVOYER: "blue",
  ENVOYE: "amber",
  REPONDU: "green",
  PAS_DE_WHATSAPP: "red",
  CONVERTI: "purple",
  NEW: "blue",
  CONTACTED: "amber",
  QUALIFIED: "green",
  CLOSED: "default",
};

const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "To Send",
  ENVOYE: "Sent",
  REPONDU: "Replied",
  PAS_DE_WHATSAPP: "No WhatsApp",
  CONVERTI: "Converted",
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
};

type ResultItem = {
  id: string;
  category: "prospects" | "leads" | "notes";
  data: ProspectResult | LeadResult | NoteResult;
};

function flattenResults(results: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];
  for (const p of results.prospects) {
    items.push({ id: `prospect-${p.id}`, category: "prospects", data: p });
  }
  for (const l of results.leads) {
    items.push({ id: `lead-${l.id}`, category: "leads", data: l });
  }
  for (const n of results.notes) {
    items.push({ id: `note-${n.id}`, category: "notes", data: n });
  }
  return items;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Target }> = {
  prospects: { label: "Prospects", icon: Target },
  leads: { label: "Leads", icon: Users },
  notes: { label: "Notes", icon: FileText },
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const flatItems = results ? flattenResults(results) : [];
  const totalResults = flatItems.length;
  const hasResults = totalResults > 0;

  const navigate = useCallback(
    (item: ResultItem) => {
      onClose();
      switch (item.category) {
        case "prospects":
          router.push("/admin/prospecting");
          break;
        case "leads":
          router.push(`/admin/leads/${(item.data as LeadResult).id}`);
          break;
        case "notes":
          router.push("/admin/prospecting");
          break;
      }
    },
    [onClose, router]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalResults - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalResults - 1));
        return;
      }

      if (e.key === "Enter" && hasResults) {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) navigate(item);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, totalResults, hasResults, selectedIndex, flatItems, navigate]);

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setSelectedIndex(0);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data: SearchResults = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function renderCategory(category: "prospects" | "leads" | "notes") {
    if (!results) return null;
    const items = flatItems.filter((i) => i.category === category);
    if (items.length === 0) return null;

    const meta = CATEGORY_META[category];
    const Icon = meta.icon;

    return (
      <div>
        <div className="flex items-center gap-2 px-4 py-2">
          <Icon className="w-3.5 h-3.5 text-[#8B00FF]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            {meta.label}
          </span>
          <span className="text-[11px] text-[#94A3B8]">({items.length})</span>
        </div>
        {items.map((item) => {
          const globalIndex = flatItems.indexOf(item);
          const isSelected = globalIndex === selectedIndex;

          return (
            <button
              key={item.id}
              data-selected={isSelected}
              onClick={() => navigate(item)}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                isSelected
                  ? "bg-gradient-to-r from-[#8B00FF]/5 to-[#C026D3]/5"
                  : "hover:bg-[#F8FAFC]"
              )}
            >
              {category === "prospects" && renderProspectItem(item.data as ProspectResult, isSelected)}
              {category === "leads" && renderLeadItem(item.data as LeadResult, isSelected)}
              {category === "notes" && renderNoteItem(item.data as NoteResult, isSelected)}
            </button>
          );
        })}
      </div>
    );
  }

  function renderProspectItem(p: ProspectResult, isSelected: boolean) {
    return (
      <>
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
          isSelected
            ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white"
            : "bg-[#F1F5F9] text-[#475569]"
        )}>
          <Target className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#0F172A] truncate">{p.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="default" size="sm">{p.sector}</Badge>
            <Badge
              variant={STATUS_BADGE[p.status] as "blue" | "amber" | "green" | "red" | "purple"}
              size="sm"
              dot
            >
              {STATUS_LABELS[p.status] || p.status}
            </Badge>
          </div>
        </div>
        <ArrowRight className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          isSelected ? "text-[#8B00FF]" : "text-[#CBD5E1]"
        )} />
      </>
    );
  }

  function renderLeadItem(l: LeadResult, isSelected: boolean) {
    return (
      <>
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
          isSelected
            ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white"
            : "bg-[#F1F5F9] text-[#475569]"
        )}>
          <Users className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#0F172A] truncate">{l.fullName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[#64748B] truncate">{l.email}</span>
            <Badge
              variant={STATUS_BADGE[l.status] as "blue" | "amber" | "green" | "default"}
              size="sm"
              dot
            >
              {STATUS_LABELS[l.status] || l.status}
            </Badge>
          </div>
        </div>
        <ArrowRight className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          isSelected ? "text-[#8B00FF]" : "text-[#CBD5E1]"
        )} />
      </>
    );
  }

  function renderNoteItem(n: NoteResult, isSelected: boolean) {
    return (
      <>
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
          isSelected
            ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white"
            : "bg-[#F1F5F9] text-[#475569]"
        )}>
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#0F172A] truncate">{n.content}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[#64748B]">{n.prospect.name}</span>
            {n.authorName && (
              <span className="text-[11px] text-[#94A3B8]">by {n.authorName}</span>
            )}
          </div>
        </div>
        <ArrowRight className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          isSelected ? "text-[#8B00FF]" : "text-[#CBD5E1]"
        )} />
      </>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[15vh] px-4 sm:px-0 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full max-w-[560px] bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden pointer-events-auto"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB]">
                <Search className="w-5 h-5 text-[#94A3B8] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search prospects, leads, notes..."
                  className="flex-1 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] bg-transparent outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="p-1 rounded-md text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-[#F1F5F9] border border-[#E5E7EB] rounded text-[11px] font-medium text-[#64748B] shrink-0">
                  ESC
                </kbd>
              </div>

              <div ref={listRef} className="max-h-[400px] overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-[#8B00FF] animate-spin" />
                  </div>
                )}

                {!loading && results && hasResults && (
                  <div className="py-2 divide-y divide-[#F1F5F9]">
                    {renderCategory("prospects")}
                    {renderCategory("leads")}
                    {renderCategory("notes")}
                  </div>
                )}

                {!loading && results && !hasResults && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F1F5F9] mb-3">
                      <Search className="w-5 h-5 text-[#94A3B8]" />
                    </div>
                    <p className="text-[14px] font-medium text-[#475569]">No results found</p>
                    <p className="text-[13px] text-[#94A3B8] mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}

                {!loading && !results && !query && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 mb-3">
                      <Search className="w-5 h-5 text-[#8B00FF]" />
                    </div>
                    <p className="text-[14px] font-medium text-[#475569]">Search everything</p>
                    <p className="text-[13px] text-[#94A3B8] mt-1">
                      Prospects, leads, and notes
                    </p>
                  </div>
                )}
              </div>

              {hasResults && (
                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[#E5E7EB] bg-[#F8FAFC]">
                  <div className="flex items-center gap-1.5">
                    <kbd className="inline-flex items-center justify-center w-5 h-5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      &uarr;
                    </kbd>
                    <kbd className="inline-flex items-center justify-center w-5 h-5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      &darr;
                    </kbd>
                    <span className="text-[11px] text-[#94A3B8] ml-0.5">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="inline-flex items-center justify-center h-5 px-1.5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      Enter
                    </kbd>
                    <span className="text-[11px] text-[#94A3B8] ml-0.5">Open</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
