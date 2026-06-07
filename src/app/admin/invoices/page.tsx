"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, DollarSign, AlertCircle, Clock, Plus, Download,
  CheckCircle, Trash2, X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/admin/badge";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */
type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  proposalId: string | null;
  items: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

type Proposal = {
  id: string;
  packageName: string | null;
  amount: number;
  currency: string;
  services: string;
  prospect: { id: string; name: string } | null;
  client: { id: string; companyName: string } | null;
};

type LineItem = { description: string; quantity: number; unitPrice: number; total: number };

/* ---------- constants ---------- */
const STATUSES = ["ALL", "DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "default",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
  CANCELLED: "default",
};

/* ---------- helpers ---------- */
function formatMAD(value: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 0) {
    const futureDays = Math.abs(days);
    if (futureDays === 1) return "tomorrow";
    return `in ${futureDays}d`;
  }
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/* ========== page ========== */
export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);

  /* fetch data */
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/invoices").then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      }),
      fetch("/api/admin/proposals").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([invData, proposalData]) => {
      if (invData?.invoices) setInvoices(invData.invoices);
      if (Array.isArray(proposalData)) setProposals(proposalData);
    }).finally(() => setLoading(false));
  }, [router]);

  /* filtered list */
  const filtered = useMemo(() => {
    if (filter === "ALL") return invoices;
    return invoices.filter((inv) => inv.status === filter);
  }, [invoices, filter]);

  /* stats */
  const stats = useMemo(() => {
    const totalRevenue = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
    const outstanding = invoices.filter((i) => ["SENT", "OVERDUE"].includes(i.status)).reduce((s, i) => s + i.total, 0);
    const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
    return { total: invoices.length, totalRevenue, outstanding, overdueCount };
  }, [invoices]);

  const tabs = STATUSES.map((s) => ({
    value: s,
    label: s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase(),
    count: s === "ALL" ? invoices.length : invoices.filter((i) => i.status === s).length,
  }));

  /* actions */
  async function markPaid(id: string) {
    const res = await fetch(`/api/admin/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
    if (res.ok) setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  function downloadPdf(id: string) {
    window.open(`/api/admin/invoices/${id}/pdf`, "_blank");
  }

  async function handleCreate(data: CreateInvoiceData) {
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const inv = await res.json();
      setInvoices((prev) => [inv, ...prev]);
      setShowForm(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create, send and track client invoices"
        count={invoices.length}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={stats.total} label="Total invoices" icon={<Receipt className="w-5 h-5" />} index={0} />
        <RevenueStatCard value={stats.totalRevenue} />
        <StatCard value={stats.outstanding} label="Outstanding" icon={<Clock className="w-5 h-5" />} index={2} suffix=" MAD" />
        <StatCard value={stats.overdueCount} label="Overdue" icon={<AlertCircle className="w-5 h-5" />} index={3} />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <FilterTabs items={tabs} active={filter} onChange={setFilter} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-7 h-7" />}
          title={invoices.length === 0 ? "No invoices yet" : "No invoices match this filter"}
          description="Create your first invoice to start tracking revenue."
          action={
            invoices.length === 0 ? (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" />
                Create Invoice
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((inv) => (
              <div key={inv.id} className="p-3.5 rounded-xl border border-[var(--os-border)] bg-white/80">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <span className="text-[13px] font-medium text-[#0F172A]">{inv.invoiceNumber}</span>
                    <p className="text-[11px] text-[#475569]">{inv.clientName}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[inv.status] as "blue" | "green" | "red" | "default"} size="sm">{inv.status}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[14px] font-semibold text-[#0F172A]">{formatMAD(inv.total)} <span className="text-[10px] text-[#9CA3AF]">{inv.currency}</span></span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => downloadPdf(inv.id)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#8B00FF] hover:bg-purple-50 transition-colors" title="Download PDF"><Download className="w-3.5 h-3.5" /></button>
                    {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                      <button onClick={() => markPaid(inv.id)} className="p-1.5 rounded-lg text-[#475569] hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Mark Paid"><CheckCircle className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 rounded-lg text-[#475569] hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="text-[10px] text-[#64748B] mt-1">Due: {relativeDate(inv.dueDate)}</p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block border border-[var(--os-border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--os-border)] bg-gray-50/80">
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Invoice #</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Client</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Amount</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs">Status</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs hidden lg:table-cell">Due Date</th>
                    <th className="text-left px-4 py-3 text-[#475569] font-medium text-xs hidden lg:table-cell">Created</th>
                    <th className="text-right px-4 py-3 text-[#475569] font-medium text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-[var(--os-border)] hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-[#0F172A] font-medium text-[13px]">{inv.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-[#475569] text-xs">{inv.clientName}</td>
                      <td className="px-4 py-3">
                        <span className="text-[14px] font-semibold text-[#0F172A]">
                          {formatMAD(inv.total)} <span className="text-[10px] font-normal text-[#9CA3AF]">{inv.currency}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[inv.status] as "blue" | "green" | "red" | "default"} dot size="sm">{inv.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-xs hidden lg:table-cell">{relativeDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-[#64748B] text-xs hidden lg:table-cell">{relativeDate(inv.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadPdf(inv.id)}
                            className="p-1.5 rounded-lg text-[#475569] hover:text-[#8B00FF] hover:bg-purple-50 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                            <button
                              onClick={() => markPaid(inv.id)}
                              className="p-1.5 rounded-lg text-[#475569] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvoice(inv.id)}
                            className="p-1.5 rounded-lg text-[#475569] hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Create Invoice Modal */}
      {showForm && (
        <InvoiceFormModal
          proposals={proposals}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

/* ---------- Revenue stat (custom for MAD formatting) ---------- */
function RevenueStatCard({ value }: { value: number }) {
  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#8B00FF]">
        {formatMAD(value)}<span className="text-[12px] sm:text-[13px] font-medium text-[#9CA3AF] ml-1.5">MAD</span>
      </div>
      <div className="text-[12px] sm:text-[13px] text-[#64748B] mt-1 font-medium">Revenue (paid)</div>
    </div>
  );
}

/* ========== Create Invoice Form Modal ========== */
type CreateInvoiceData = {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  proposalId?: string | null;
  items: LineItem[];
  taxRate: number;
  currency: string;
  dueDate?: string | null;
  notes?: string | null;
};

function InvoiceFormModal({
  proposals,
  onClose,
  onSubmit,
}: {
  proposals: Proposal[];
  onClose: () => void;
  onSubmit: (data: CreateInvoiceData) => void;
}) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxRate, setTaxRate] = useState(20);
  const [currency] = useState("MAD");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* auto-fill from proposal */
  function handleProposalSelect(id: string) {
    setProposalId(id);
    const p = proposals.find((pr) => pr.id === id);
    if (!p) return;
    const name = p.client?.companyName || p.prospect?.name || "";
    if (name) setClientName(name);
    // Build line items from services
    const services = p.services.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (services.length > 0) {
      const perService = Math.round((p.amount / services.length) * 100) / 100;
      setItems(services.map((s) => ({ description: s, quantity: 1, unitPrice: perService, total: perService })));
    }
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx] };
      if (field === "description") item.description = value as string;
      if (field === "quantity") item.quantity = Math.max(0, Number(value) || 0);
      if (field === "unitPrice") item.unitPrice = Math.max(0, Number(value) || 0);
      item.total = item.quantity * item.unitPrice;
      next[idx] = item;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || items.some((i) => !i.description.trim())) return;
    setSubmitting(true);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        proposalId: proposalId || null,
        items: items.map((i) => ({ ...i, total: i.quantity * i.unitPrice })),
        taxRate,
        currency,
        dueDate: dueDate || null,
        notes: notes || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[var(--os-border)] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition-all";
  const labelCls = "block text-[12px] font-medium text-[#475569] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[var(--os-border)] shadow-2xl shadow-purple-900/10 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--os-border)]">
          <h2 className="text-lg font-semibold text-[#0F172A]">New Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* From proposal */}
          {proposals.length > 0 && (
            <div>
              <label className={labelCls}>Create from Proposal (optional)</label>
              <select value={proposalId} onChange={(e) => handleProposalSelect(e.target.value)} className={inputCls}>
                <option value="">-- Select a proposal --</option>
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.packageName || "Proposal"} - {p.client?.companyName || p.prospect?.name || "?"} ({formatMAD(p.amount)} {p.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Client Name *</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="Company or person name" required />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputCls} placeholder="client@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputCls} placeholder="+212 ..." />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className={inputCls} placeholder="Street, City, Country" />
          </div>

          {/* Line items */}
          <div>
            <label className={labelCls}>Line Items *</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border border-[var(--os-border)] bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      className={cn(inputCls, "bg-white")}
                      placeholder="Description"
                      required
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className={cn(inputCls, "bg-white text-center")}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice || ""}
                      onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                      className={cn(inputCls, "bg-white text-right")}
                      placeholder="Price"
                    />
                  </div>
                  <div className="w-24 flex items-center justify-end text-[13px] font-medium text-[#0F172A] pt-2">
                    {formatMAD(item.quantity * item.unitPrice)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 mt-1 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                    disabled={items.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#8B00FF] hover:text-[#7C3AED] transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Add line item
            </button>
          </div>

          {/* Totals */}
          <div className="rounded-xl border border-[var(--os-border)] bg-gray-50/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[#475569]">Subtotal</span>
              <span className="text-[13px] font-medium text-[#0F172A]">{formatMAD(subtotal)} {currency}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#475569]">TVA</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 px-2 py-1 rounded border border-[var(--os-border)] bg-white text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-purple-300"
                />
                <span className="text-[12px] text-[#475569]">%</span>
              </div>
              <span className="text-[13px] text-[#475569]">{formatMAD(taxAmount)} {currency}</span>
            </div>
            <div className="border-t border-[var(--os-border)] pt-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#0F172A]">Total</span>
              <span className="text-lg font-bold text-[#8B00FF]">{formatMAD(total)} {currency}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(inputCls, "h-20 resize-none")}
              placeholder="Additional notes or terms..."
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !clientName.trim()}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium text-white shadow-md shadow-purple-500/20 transition-all",
                submitting ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:shadow-lg hover:shadow-purple-500/30"
              )}
            >
              {submitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
