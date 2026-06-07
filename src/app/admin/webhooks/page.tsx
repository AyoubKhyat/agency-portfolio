"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { FormButton } from "@/components/admin/form";
import { Input } from "@/components/admin/form";
import {
  Plus, Trash2, Pencil, Zap, CheckCircle, AlertCircle, Loader2,
  Globe, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string;
  isActive: boolean;
  secret: string | null;
  createdAt: string;
  updatedAt: string;
};

const ALL_EVENTS = [
  { value: "lead.new", label: "New Lead" },
  { value: "prospect.created", label: "Prospect Created" },
  { value: "prospect.converted", label: "Prospect Converted" },
  { value: "proposal.sent", label: "Proposal Sent" },
  { value: "proposal.accepted", label: "Proposal Accepted" },
  { value: "proposal.rejected", label: "Proposal Rejected" },
  { value: "task.created", label: "Task Created" },
  { value: "meeting.created", label: "Meeting Created" },
];

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4",
      type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200",
    )}>
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/webhooks");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch {
      showToast("Failed to load webhooks", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  function resetForm() {
    setFormName("");
    setFormUrl("");
    setFormEvents([]);
    setFormSecret("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(wh: Webhook) {
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormEvents(wh.events.split(",").map((e) => e.trim()));
    setFormSecret(wh.secret || "");
    setEditingId(wh.id);
    setShowForm(true);
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        url: formUrl.trim(),
        events: formEvents.join(","),
        secret: formSecret.trim() || undefined,
      };

      const res = editingId
        ? await fetch(`/api/admin/webhooks/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/webhooks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        showToast(editingId ? "Webhook updated" : "Webhook created", "success");
        resetForm();
        fetchWebhooks();
      } else {
        const data = await res.json();
        showToast(data.error ? JSON.stringify(data.error) : "Failed to save", "error");
      }
    } catch {
      showToast("Failed to save webhook", "error");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook?")) return;
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Webhook deleted", "success");
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
      } else {
        showToast("Failed to delete", "error");
      }
    } catch {
      showToast("Failed to delete", "error");
    }
  }

  async function handleToggle(wh: Webhook) {
    try {
      const res = await fetch(`/api/admin/webhooks/${wh.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !wh.isActive }),
      });
      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === wh.id ? { ...w, isActive: !w.isActive } : w))
        );
      }
    } catch {
      showToast("Failed to toggle", "error");
    }
  }

  async function handleTest(wh: Webhook) {
    setTestingId(wh.id);
    try {
      const res = await fetch("/api/admin/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: wh.url, secret: wh.secret }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Test delivered (HTTP ${data.status})`, "success");
      } else {
        showToast(
          `Test failed${data.status ? ` (HTTP ${data.status})` : ""}: ${data.error || "Unknown error"}`,
          "error"
        );
      }
    } catch {
      showToast("Test request failed", "error");
    } finally {
      setTestingId(null);
    }
  }

  function truncateUrl(url: string, max = 45) {
    if (url.length <= max) return url;
    return url.slice(0, max) + "...";
  }

  const eventBadgeVariant = (ev: string): "purple" | "blue" | "green" | "amber" | "red" | "default" => {
    if (ev.startsWith("lead")) return "blue";
    if (ev.startsWith("prospect")) return "green";
    if (ev.startsWith("proposal")) return "purple";
    if (ev.startsWith("task")) return "amber";
    if (ev.startsWith("meeting")) return "red";
    return "default";
  };

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Send real-time notifications to external services when events occur"
        count={webhooks.length}
        actions={
          <FormButton
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Add Webhook
          </FormButton>
        }
      />

      {/* Add/Edit Form */}
      {showForm && (
        <GlassCard className="mb-6" padding="lg">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">
              {editingId ? "Edit Webhook" : "New Webhook"}
            </h3>
            <button
              onClick={resetForm}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Slack notifications"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">
                  URL <span className="text-red-500">*</span>
                </label>
                <Input
                  type="url"
                  placeholder="https://hooks.example.com/webhook"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#0F172A] mb-2">
                Events <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => {
                  const selected = formEvents.includes(ev.value);
                  return (
                    <button
                      key={ev.value}
                      type="button"
                      onClick={() => toggleEvent(ev.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-150",
                        selected
                          ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white border-transparent shadow-sm shadow-purple-500/20"
                          : "bg-white border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                      )}
                    >
                      {ev.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">
                Signing Secret{" "}
                <span className="text-[11px] text-[#94A3B8] font-normal">(optional)</span>
              </label>
              <Input
                type="password"
                placeholder="Optional HMAC-SHA256 secret"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">
                If set, payloads will include an X-Webhook-Signature header for verification.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <FormButton type="submit" loading={formSaving} size="sm">
                {editingId ? "Save Changes" : "Create Webhook"}
              </FormButton>
              <FormButton type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </FormButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Webhooks Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B00FF]" />
        </div>
      ) : webhooks.length === 0 ? (
        <GlassCard className="text-center py-16">
          <Globe className="w-12 h-12 mx-auto text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-1">
            No webhooks configured
          </h3>
          <p className="text-[13px] text-[#64748B] mb-5">
            Add a webhook to send real-time event notifications to external services.
          </p>
          <FormButton
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowForm(true)}
          >
            Add Webhook
          </FormButton>
        </GlassCard>
      ) : (
        <GlassCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-5 py-3">
                    Name
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-5 py-3">
                    URL
                  </th>
                  <th className="text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-5 py-3">
                    Events
                  </th>
                  <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-5 py-3">
                    Active
                  </th>
                  <th className="text-right text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr
                    key={wh.id}
                    className="border-b border-[#F8FAFC] last:border-0 hover:bg-[#FAFBFD] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            wh.isActive ? "bg-emerald-500" : "bg-gray-300"
                          )}
                        />
                        <span className="text-[13px] font-medium text-[#0F172A]">
                          {wh.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-[12px] text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded-md font-mono">
                        {truncateUrl(wh.url)}
                      </code>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {wh.events.split(",").map((ev) => (
                          <Badge key={ev} variant={eventBadgeVariant(ev.trim())} size="sm">
                            {ev.trim()}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleToggle(wh)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                          wh.isActive
                            ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] shadow-sm shadow-purple-500/30"
                            : "bg-[#CBD5E1]"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                            wh.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleTest(wh)}
                          disabled={testingId === wh.id}
                          title="Send test"
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                        >
                          {testingId === wh.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(wh)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#8B00FF] hover:bg-purple-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wh.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
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
        </GlassCard>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
