"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileText, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Field, FormButton, Input, Select, Textarea } from "@/components/admin/form";
import {
  DOCUMENT_LANGUAGE_LABELS,
  DOCUMENT_LANGUAGES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
} from "@/lib/documents";
import { cn } from "@/lib/utils";
import type { AdminDocument, ClientOption, ProjectOption } from "./types";

/* ---------- helpers ---------- */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Mirror of the server gate, so the admin hears about a bad file instantly. */
function checkFile(file: File): string | null {
  const isPdf =
    file.type === "application/pdf" ||
    (file.type === "" && file.name.toLowerCase().endsWith(".pdf"));
  if (!isPdf) return "Only PDF files are allowed.";
  if (file.size === 0) return "That file is empty. Please choose a valid PDF.";
  if (file.size > MAX_FILE_BYTES) {
    return `That file is ${formatBytes(file.size)}. The maximum is ${MAX_FILE_LABEL}.`;
  }
  return null;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/* ---------- component ---------- */

type Props = {
  /** Present when editing; absent when creating. */
  document?: AdminDocument | null;
  clients: ClientOption[];
  projects: ProjectOption[];
  onClose: () => void;
  onSaved: (doc: AdminDocument, mode: "created" | "updated") => void;
};

export function DocumentForm({ document: doc, clients, projects, onClose, onSaved }: Props) {
  const isEdit = Boolean(doc);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(doc?.title ?? "");
  const [type, setType] = useState<string>(doc?.type ?? "CONTRACT");
  const [language, setLanguage] = useState<string>(doc?.language ?? "FR");
  const [status, setStatus] = useState<string>(doc?.status ?? "DRAFT");
  const [clientName, setClientName] = useState(doc?.clientName ?? "");
  const [clientId, setClientId] = useState(doc?.clientId ?? "");
  const [projectName, setProjectName] = useState(doc?.projectName ?? "");
  const [projectId, setProjectId] = useState(doc?.projectId ?? "");
  const [documentDate, setDocumentDate] = useState(toDateInput(doc?.documentDate ?? null));
  const [amount, setAmount] = useState(doc?.amount != null ? String(doc.amount) : "");
  const [currency, setCurrency] = useState(doc?.currency ?? "MAD");
  const [notes, setNotes] = useState(doc?.notes ?? "");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clientOptions = useMemo(
    () => [...clients].sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [clients],
  );
  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const acceptFile = useCallback((next: File | null) => {
    if (!next) return;
    const problem = checkFile(next);
    if (problem) {
      setFileError(problem);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(next);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0] ?? null);
  }

  /** Client-side mirror of the Zod schema. */
  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Title is required";
    if (title.trim().length > 200) errors.title = "Title is too long";
    if (amount.trim()) {
      const n = Number(amount.replace(/\s/g, "").replace(",", "."));
      if (Number.isNaN(n)) errors.amount = "Amount must be a number";
      else if (n < 0) errors.amount = "Amount cannot be negative";
    }
    if (!isEdit && !file) {
      setFileError("Please attach a PDF file.");
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0 && !fileError;
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("type", type);
    fd.set("language", language);
    fd.set("status", status);
    fd.set("clientName", clientName.trim());
    fd.set("clientId", clientId);
    fd.set("projectName", projectName.trim());
    fd.set("projectId", projectId);
    fd.set("documentDate", documentDate);
    fd.set("amount", amount.trim());
    fd.set("currency", currency.trim() || "MAD");
    fd.set("notes", notes.trim());
    if (file) fd.set("file", file);
    return fd;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      if (!isEdit) {
        const res = await fetch("/api/admin/documents", {
          method: "POST",
          body: buildFormData(),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || `Upload failed (${res.status})`);
        onSaved(body as AdminDocument, "created");
        return;
      }

      // Edit: metadata as JSON, then the file separately if one was chosen.
      // Metadata goes first so a rejected replace never loses the edits.
      const metaRes = await fetch(`/api/admin/documents/${doc!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          language,
          status,
          clientName: clientName.trim(),
          clientId: clientId || null,
          projectName: projectName.trim(),
          projectId: projectId || null,
          documentDate: documentDate || null,
          amount: amount.trim() === "" ? null : amount.trim(),
          currency: currency.trim() || "MAD",
          notes: notes.trim(),
        }),
      });
      const metaBody = await metaRes.json().catch(() => null);
      if (!metaRes.ok) throw new Error(metaBody?.error || `Save failed (${metaRes.status})`);

      let saved = metaBody as AdminDocument;

      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const fileRes = await fetch(`/api/admin/documents/${doc!.id}/replace`, {
          method: "POST",
          body: fd,
        });
        const fileBody = await fileRes.json().catch(() => null);
        if (!fileRes.ok) throw new Error(fileBody?.error || `Replace failed (${fileRes.status})`);
        saved = fileBody as AdminDocument;
      }

      onSaved(saved, "updated");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0F172A]">
              {isEdit ? "Edit document" : "Add document"}
            </h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {isEdit
                ? "Update the details, or replace the PDF."
                : `PDF only, up to ${MAX_FILE_LABEL}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#475569] hover:bg-[#F1F5F9] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700">{formError}</p>
            </div>
          )}

          {/* file */}
          <Field
            label={isEdit ? "Replace PDF" : "PDF file"}
            required={!isEdit}
            error={fileError}
            hint={
              isEdit && !file
                ? `Currently: ${doc!.fileName} (${formatBytes(doc!.fileSize)}). Leave empty to keep it.`
                : undefined
            }
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 px-4 py-7 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                dragging
                  ? "border-[#8B00FF] bg-purple-50"
                  : fileError
                    ? "border-red-300 bg-red-50/40"
                    : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]",
              )}
            >
              {file ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <p className="text-[13px] font-medium text-[#0F172A]">{file.name}</p>
                  <p className="text-[11px] text-[#64748B]">{formatBytes(file.size)} — click to change</p>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-[#94A3B8]" />
                  <p className="text-[13px] text-[#475569]">
                    Drop a PDF here, or <span className="text-[#8B00FF] font-medium">browse</span>
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">PDF only · max {MAX_FILE_LABEL}</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </Field>

          <Field label="Title" required error={fieldErrors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contrat — Hammam Nour — refonte site"
              invalid={Boolean(fieldErrors.title)}
              maxLength={200}
            />
          </Field>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Type" required>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Language" required>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {DOCUMENT_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{DOCUMENT_LANGUAGE_LABELS[l]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status" required>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {DOCUMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Client name">
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Hammam Nour"
                maxLength={200}
              />
            </Field>
            <Field
              label="Link to client"
              hint={clientOptions.length === 0 ? "No clients recorded yet" : "Optional"}
            >
              <Select
                value={clientId}
                onChange={(e) => {
                  const id = e.target.value;
                  setClientId(id);
                  const match = clientOptions.find((c) => c.id === id);
                  if (match && !clientName.trim()) setClientName(match.companyName);
                }}
                disabled={clientOptions.length === 0}
              >
                <option value="">— None —</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Project name">
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Refonte site vitrine"
                maxLength={200}
              />
            </Field>
            <Field
              label="Link to project"
              hint={projectOptions.length === 0 ? "No projects recorded yet" : "Optional"}
            >
              <Select
                value={projectId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProjectId(id);
                  const match = projectOptions.find((p) => p.id === id);
                  if (match && !projectName.trim()) setProjectName(match.name);
                }}
                disabled={projectOptions.length === 0}
              >
                <option value="">— None —</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Date">
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </Field>
            <Field label="Amount" error={fieldErrors.amount}>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="12000"
                inputMode="decimal"
                invalid={Boolean(fieldErrors.amount)}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="MAD"
                maxLength={8}
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this document…"
              rows={3}
              maxLength={5000}
            />
          </Field>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <FormButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </FormButton>
          <FormButton type="submit" loading={saving} icon={<FileText className="w-4 h-4" />}>
            {isEdit ? "Save changes" : "Upload document"}
          </FormButton>
        </div>
      </form>
    </div>
  );
}
