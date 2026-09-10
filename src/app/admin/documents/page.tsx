"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText, Plus, Search, Download, Eye, Pencil, Archive, ArchiveRestore,
  Trash2, X, AlertTriangle, Loader2, Building2, FolderKanban, Files,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/admin/badge";
import { FormButton, Select } from "@/components/admin/form";
import {
  DOCUMENT_LANGUAGE_LABELS,
  DOCUMENT_LANGUAGES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
} from "@/lib/documents";
import { cn } from "@/lib/utils";
import { DocumentForm, formatBytes } from "./DocumentForm";
import type { AdminDocument, ClientOption, ProjectOption } from "./types";

/* ---------- display maps ---------- */

const TYPE_BADGE: Record<string, string> = {
  CONTRACT: "purple",
  PROPOSAL: "blue",
  QUOTE: "amber",
  INVOICE: "green",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "default",
  SENT: "blue",
  SIGNED: "green",
  PAID: "green",
  CANCELLED: "red",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}

/* ========== page ========== */

export default function DocumentsPage() {
  const router = useRouter();

  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedCount, setArchivedCount] = useState(0);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDocument | null>(null);
  const [previewing, setPreviewing] = useState<AdminDocument | null>(null);
  const [deleting, setDeleting] = useState<AdminDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "error" | "success"; msg: string } | null>(null);

  const showToast = useCallback((kind: "error" | "success", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* ---- data ---- */

  // Loading starts true and is only cleared from the fetch callback, so no
  // state update happens synchronously while the effect body runs.
  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (showArchived) params.set("archived", "true");
    params.set("limit", "100");

    fetch(`/api/admin/documents?${params}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        if (!res.ok) {
          showToast("error", "Could not load documents.");
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        setDocuments(body.documents ?? []);
        setArchivedCount(body.archivedCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) showToast("error", "Could not load documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, showArchived, showToast]);

  /** Switching between active and archived re-runs the effect above. */
  function toggleArchived() {
    setLoading(true);
    setShowArchived((v) => !v);
  }

  // Relation options are optional extras — a failure here must not break the page.
  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setClients(data.map((c: { id: string; companyName: string }) => ({
            id: c.id, companyName: c.companyName,
          })));
        }
      })
      .catch(() => {});

    fetch("/api/admin/pipeline")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setProjects(data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => {});
  }, []);

  /* ---- filtering (client-side over the loaded page) ---- */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeFilter !== "ALL" && d.type !== typeFilter) return false;
      if (languageFilter !== "ALL" && d.language !== languageFilter) return false;
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.clientName.toLowerCase().includes(q) ||
        d.projectName.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q)
      );
    });
  }, [documents, search, typeFilter, languageFilter, statusFilter]);

  const typeTabs = useMemo(
    () => [
      { value: "ALL", label: "All", count: documents.length },
      ...DOCUMENT_TYPES.map((t) => ({
        value: t,
        label: DOCUMENT_TYPE_LABELS[t],
        count: documents.filter((d) => d.type === t).length,
      })),
    ],
    [documents],
  );

  const stats = useMemo(() => {
    const byType = (t: string) => documents.filter((d) => d.type === t).length;
    return {
      total: documents.length,
      contracts: byType("CONTRACT"),
      quotes: byType("QUOTE") + byType("PROPOSAL"),
      invoices: byType("INVOICE"),
    };
  }, [documents]);

  /* ---- actions ---- */

  async function download(doc: AdminDocument) {
    if (busyId) return;
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/file?mode=download`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function setArchived(doc: AdminDocument, archived: boolean) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Action failed");

      // The row leaves the current view either way, so drop it locally.
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setArchivedCount((n) => Math.max(0, archived ? n + 1 : n - 1));
      showToast("success", archived ? "Document archived." : "Document restored.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function hardDelete(doc: AdminDocument) {
    setBusyId(doc.id);
    try {
      const res = await fetch(
        `/api/admin/documents/${doc.id}?confirm=PERMANENT_DELETE`,
        { method: "DELETE" },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Delete failed");

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (doc.archivedAt) setArchivedCount((n) => Math.max(0, n - 1));
      setDeleting(null);
      showToast("success", "Document permanently deleted.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(doc: AdminDocument, mode: "created" | "updated") {
    setFormOpen(false);
    setEditing(null);
    if (mode === "created") {
      // A new document is never archived, so only show it in the active view.
      if (!showArchived) setDocuments((prev) => [doc, ...prev]);
      showToast("success", "Document uploaded.");
    } else {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
      showToast("success", "Document updated.");
    }
  }

  const filtersActive =
    search.trim() !== "" ||
    typeFilter !== "ALL" ||
    languageFilter !== "ALL" ||
    statusFilter !== "ALL";

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Contracts, proposals, devis and invoices — stored privately"
        count={documents.length}
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Document
          </button>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={stats.total} label="Documents" icon={<Files className="w-5 h-5" />} index={0} />
        <StatCard value={stats.contracts} label="Contracts" icon={<FileText className="w-5 h-5" />} index={1} />
        <StatCard value={stats.quotes} label="Devis & proposals" icon={<FileText className="w-5 h-5" />} index={2} />
        <StatCard value={stats.invoices} label="Invoices" icon={<FileText className="w-5 h-5" />} index={3} />
      </div>

      {/* search + filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, client, project or file name…"
              className="w-full h-11 pl-9 pr-4 text-sm bg-white border border-[var(--os-border)] rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="h-11 w-full sm:w-40"
              aria-label="Filter by language"
            >
              <option value="ALL">All languages</option>
              {DOCUMENT_LANGUAGES.map((l) => (
                <option key={l} value={l}>{DOCUMENT_LANGUAGE_LABELS[l]}</option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full sm:w-40"
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterTabs items={typeTabs} active={typeFilter} onChange={setTypeFilter} />
          <button
            onClick={toggleArchived}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
              showArchived
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "text-[#475569] border-transparent hover:bg-[#F1F5F9]",
            )}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Viewing archive" : `Archive (${archivedCount})`}
          </button>
        </div>
      </div>

      {/* list */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="os-skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-7 h-7" />}
          title={
            showArchived
              ? "Nothing archived"
              : documents.length === 0
                ? "No documents yet"
                : "No documents match these filters"
          }
          description={
            filtersActive
              ? "Try clearing the search or filters."
              : showArchived
                ? "Archived documents will appear here."
                : "Upload your first contract, devis or invoice to build the library."
          }
          action={
            !showArchived && documents.length === 0 ? (
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" />
                Add Document
              </button>
            ) : filtersActive ? (
              <FormButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("ALL");
                  setLanguageFilter("ALL");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </FormButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border border-[var(--os-border)] bg-white/80"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#0F172A] truncate">{doc.title}</p>
                    <p className="text-[11px] text-[#475569] truncate">
                      {doc.clientName || "—"}
                      {doc.projectName ? ` · ${doc.projectName}` : ""}
                    </p>
                  </div>
                  <Badge variant={TYPE_BADGE[doc.type] as "purple"} size="sm">
                    {DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={STATUS_BADGE[doc.status] as "default"} dot size="sm">{doc.status}</Badge>
                  <span className="text-[10px] text-[#64748B]">{doc.language}</span>
                  <span className="text-[10px] text-[#64748B]">{formatDate(doc.documentDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#0F172A]">
                    {formatAmount(doc.amount, doc.currency)}
                  </span>
                  <RowActions
                    doc={doc}
                    busy={busyId === doc.id}
                    onPreview={() => setPreviewing(doc)}
                    onDownload={() => download(doc)}
                    onEdit={() => { setEditing(doc); setFormOpen(true); }}
                    onArchive={() => setArchived(doc, !doc.archivedAt)}
                    onDelete={() => setDeleting(doc)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* desktop table */}
          <div className="hidden md:block border border-[var(--os-border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--os-border)] bg-gray-50/80">
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Document</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Client / Project</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Type</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Lang</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Status</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs hidden lg:table-cell">Amount</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs hidden lg:table-cell">Date</th>
                    <th className="text-right px-4 py-3 text-[#475569] font-medium text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-[var(--os-border)] last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreviewing(doc)}
                          className="text-left group"
                          title="Preview PDF"
                        >
                          <span className="block text-[13px] font-medium text-[#0F172A] group-hover:text-[#8B00FF] transition-colors">
                            {doc.title}
                          </span>
                          <span className="block text-[11px] text-[#94A3B8]">
                            {doc.fileName} · {formatBytes(doc.fileSize)}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {doc.client ? (
                            <Link
                              href={`/admin/clients/${doc.client.id}`}
                              className="inline-flex items-center gap-1 text-[12px] text-[#8B00FF] hover:underline"
                            >
                              <Building2 className="w-3 h-3" />
                              {doc.client.companyName}
                            </Link>
                          ) : doc.clientName ? (
                            <span className="text-[12px] text-[#475569]">{doc.clientName}</span>
                          ) : (
                            <span className="text-[12px] text-[#94A3B8]">—</span>
                          )}
                          {doc.project ? (
                            <Link
                              href="/admin/pipeline"
                              className="inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#8B00FF]"
                            >
                              <FolderKanban className="w-3 h-3" />
                              {doc.project.name}
                            </Link>
                          ) : doc.projectName ? (
                            <span className="text-[11px] text-[#94A3B8]">{doc.projectName}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={TYPE_BADGE[doc.type] as "purple"} size="sm">
                          {DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium text-[#475569] uppercase">{doc.language}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[doc.status] as "default"} dot size="sm">
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[#0F172A] text-[13px] font-medium hidden lg:table-cell">
                        {formatAmount(doc.amount, doc.currency)}
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-xs hidden lg:table-cell">
                        {formatDate(doc.documentDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <RowActions
                            doc={doc}
                            busy={busyId === doc.id}
                            onPreview={() => setPreviewing(doc)}
                            onDownload={() => download(doc)}
                            onEdit={() => { setEditing(doc); setFormOpen(true); }}
                            onArchive={() => setArchived(doc, !doc.archivedAt)}
                            onDelete={() => setDeleting(doc)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* modals */}
      {formOpen && (
        <DocumentForm
          document={editing}
          clients={clients}
          projects={projects}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {previewing && (
        <PreviewModal
          doc={previewing}
          onClose={() => setPreviewing(null)}
          onDownload={() => download(previewing)}
        />
      )}

      {deleting && (
        <DeleteModal
          doc={deleting}
          busy={busyId === deleting.id}
          onCancel={() => setDeleting(null)}
          onConfirm={() => hardDelete(deleting)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium",
            toast.kind === "error"
              ? "bg-red-600 text-white"
              : "bg-[#0F172A] text-white",
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---------- row actions ---------- */

function RowActions({
  doc, busy, onPreview, onDownload, onEdit, onArchive, onDelete,
}: {
  doc: AdminDocument;
  busy: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const iconCls =
    "p-1.5 rounded-lg text-[#475569] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={onPreview} className={cn(iconCls, "hover:text-[#8B00FF] hover:bg-purple-50")} title="Preview">
        <Eye className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDownload} disabled={busy} className={cn(iconCls, "hover:text-[#8B00FF] hover:bg-purple-50")} title="Download">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </button>
      <button onClick={onEdit} className={cn(iconCls, "hover:text-[#8B00FF] hover:bg-purple-50")} title="Edit">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onArchive}
        disabled={busy}
        className={cn(iconCls, "hover:text-amber-700 hover:bg-amber-50")}
        title={doc.archivedAt ? "Restore" : "Archive"}
      >
        {doc.archivedAt ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
      </button>
      <button onClick={onDelete} className={cn(iconCls, "hover:text-red-600 hover:bg-red-50")} title="Delete permanently">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ---------- preview ---------- */

function PreviewModal({
  doc, onClose, onDownload,
}: {
  doc: AdminDocument;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-2xl shadow-xl border border-[#E2E8F0] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E2E8F0]">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[#0F172A] truncate">{doc.title}</h2>
            <p className="text-[11px] text-[#64748B] truncate">
              {doc.fileName} · {formatBytes(doc.fileSize)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FormButton variant="secondary" size="sm" onClick={onDownload} icon={<Download className="w-3.5 h-3.5" />}>
              Download
            </FormButton>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#475569] hover:bg-[#F1F5F9] transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Same-origin, cookie-authenticated: the iframe inherits the session. */}
        <iframe
          src={`/api/admin/documents/${doc.id}/file?mode=inline`}
          title={`Preview of ${doc.title}`}
          className="flex-1 w-full bg-[#F8FAFC]"
        />
      </div>
    </div>
  );
}

/* ---------- hard delete confirmation ---------- */

function DeleteModal({
  doc, busy, onCancel, onConfirm,
}: {
  doc: AdminDocument;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === "DELETE";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 text-red-600 shrink-0">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#0F172A]">Delete permanently?</h2>
              <p className="text-[13px] text-[#64748B] mt-1">
                <span className="font-medium text-[#0F172A]">{doc.title}</span> and its PDF will be
                erased for good. This cannot be undone — archiving keeps the file and can be reversed.
              </p>
            </div>
          </div>

          <label className="block text-[12px] font-semibold text-[#475569] uppercase tracking-[0.06em] mb-1.5">
            Type DELETE to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="w-full h-11 px-4 bg-white border border-[#E2E8F0] rounded-xl text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <FormButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </FormButton>
          <FormButton
            variant="danger"
            onClick={onConfirm}
            disabled={!matches}
            loading={busy}
            icon={<Trash2 className="w-4 h-4" />}
          >
            Delete forever
          </FormButton>
        </div>
      </div>
    </div>
  );
}
