import { z } from "zod";

/* ============================================================
 * Documents Hub — shared contract between the API and the UI.
 *
 * Everything the server trusts is defined here: allowed enum
 * values, the size ceiling, PDF sniffing and filename hardening.
 * The client imports the same constants so the dropdowns can
 * never drift from what the API accepts.
 * ============================================================ */

export const DOCUMENT_TYPES = ["CONTRACT", "PROPOSAL", "QUOTE", "INVOICE"] as const;
export const DOCUMENT_LANGUAGES = ["FR", "EN", "AR"] as const;
export const DOCUMENT_STATUSES = ["DRAFT", "SENT", "SIGNED", "PAID", "CANCELLED"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentLanguage = (typeof DOCUMENT_LANGUAGES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRACT: "Contract",
  PROPOSAL: "Proposal",
  QUOTE: "Devis / Quote",
  INVOICE: "Invoice",
};

export const DOCUMENT_LANGUAGE_LABELS: Record<DocumentLanguage, string> = {
  FR: "Français",
  EN: "English",
  AR: "العربية",
};

/**
 * Vercel caps a serverless request body at ~4.5 MB, so anything above that
 * never reaches this code — the platform rejects it first. We stop at 4 MB so
 * the failure is a friendly JSON error from us rather than an opaque 413.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_LABEL = "4 MB";

export const PDF_MIME = "application/pdf";

/* ---------- file validation ---------- */

/**
 * Sniff the actual bytes rather than trusting the extension or the
 * browser-supplied Content-Type, both of which are attacker-controlled.
 *
 * Per the PDF spec the `%PDF-` header should start the file, but real-world
 * writers sometimes emit leading whitespace or a byte-order mark, and readers
 * are expected to scan the first 1 KB. We do the same.
 */
export function looksLikePdf(buffer: Buffer): boolean {
  const window = buffer.subarray(0, 1024).toString("latin1");
  return window.includes("%PDF-");
}

export type FileRejection = { ok: false; error: string };
export type FileAcceptance = { ok: true };

/**
 * Full server-side gate for an uploaded file. Order matters: size first (cheap),
 * then declared type, then the real bytes.
 */
export function validatePdfUpload(file: File, buffer: Buffer): FileRejection | FileAcceptance {
  if (buffer.length === 0) {
    return { ok: false, error: "That file is empty. Please choose a valid PDF." };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    const mb = (buffer.length / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `That file is ${mb} MB. The maximum is ${MAX_FILE_LABEL}.`,
    };
  }
  if (file.type && file.type !== PDF_MIME) {
    return { ok: false, error: "Only PDF files are allowed." };
  }
  if (!looksLikePdf(buffer)) {
    return {
      ok: false,
      error: "That file is not a valid PDF. Please upload a real PDF document.",
    };
  }
  return { ok: true };
}

/* ---------- filename hardening ---------- */

/**
 * Reduce an arbitrary upload name to something safe to store and to echo back
 * in a Content-Disposition header. Strips directory traversal, control
 * characters and the quotes/newlines that would let a crafted name break out
 * of the header and inject one of its own. Letters and digits in any script
 * survive, so Arabic titles stay readable.
 */
export function sanitizeFileName(raw: string): string {
  const base = (raw || "").split(/[\\/]/).pop() || "";
  const stripped = base
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/["\\\r\n]/g, "")
    .trim();

  const withoutExt = stripped.replace(/\.pdf$/i, "");
  const safe = withoutExt
    .replace(/[^\p{L}\p{N} ._-]/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 120);

  return `${safe || "document"}.pdf`;
}

/**
 * ASCII-only twin of a filename, for the legacy `filename=` parameter that
 * older clients read. The UTF-8 original still travels in `filename*`.
 */
function asciiFallback(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\u0020-\u007E]/g, "_")
    .replace(/["\\]/g, "_");
  return folded.replace(/^_+\.pdf$/i, "document.pdf") || "document.pdf";
}

/**
 * Build an RFC 6266 / RFC 5987 Content-Disposition value. Both parameters are
 * derived from the sanitized name, so no user byte reaches the header raw.
 */
export function contentDisposition(mode: "inline" | "attachment", rawName: string): string {
  const safe = sanitizeFileName(rawName);
  return `${mode}; filename="${asciiFallback(safe)}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/* ---------- metadata validation ---------- */

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => v ?? "");

/** `<input type="date">` gives YYYY-MM-DD; empty string means "not set". */
const dateOnly = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date")
  .transform((v) => {
    if (v === null) return null;
    const parsed = new Date(`${v}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

/** Amount arrives as a form string; blank means "no amount". */
const optionalAmount = z
  .preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return null;
      if (typeof v === "string") {
        const n = Number(v.replace(/\s/g, "").replace(",", "."));
        return Number.isNaN(n) ? v : n;
      }
      return v;
    },
    z.number("Amount must be a number").nonnegative("Amount cannot be negative").nullable(),
  )
  .optional()
  .transform((v) => v ?? null);

/** Optional foreign key: blank string from a <select> means "no relation". */
const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  clientName: trimmedOptional(200),
  clientId: optionalId,
  projectName: trimmedOptional(200),
  projectId: optionalId,
  type: z.enum(DOCUMENT_TYPES, "Choose a document type"),
  language: z.enum(DOCUMENT_LANGUAGES, "Choose a language"),
  status: z.enum(DOCUMENT_STATUSES, "Choose a status"),
  documentDate: dateOnly,
  amount: optionalAmount,
  currency: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((v) => v || "MAD"),
  notes: trimmedOptional(5000),
});

/** Every field optional, for PATCH. */
export const documentPatchSchema = documentMetadataSchema.partial().extend({
  archived: z.boolean().optional(),
});

/** Turn a ZodError into one short sentence a human can act on. */
export function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid data";
  const field = issue.path.filter((p) => typeof p === "string").join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

/**
 * FormData values are all strings. Collect only the keys we know about so a
 * caller cannot smuggle extra columns into the write.
 */
export function formDataToMetadata(fd: FormData): Record<string, unknown> {
  const keys = [
    "title", "clientName", "clientId", "projectName", "projectId",
    "type", "language", "status", "documentDate", "amount", "currency", "notes",
  ] as const;

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = fd.get(key);
    if (value !== null && typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * The exact column set every metadata response is built from.
 *
 * `data` on DocumentFile is deliberately absent: passing this to Prisma's
 * `select` makes it structurally impossible for a list or detail endpoint to
 * leak file bytes, even if someone later adds an include by mistake.
 */
export const DOCUMENT_METADATA_SELECT = {
  id: true,
  title: true,
  clientName: true,
  clientId: true,
  projectName: true,
  projectId: true,
  type: true,
  language: true,
  status: true,
  documentDate: true,
  amount: true,
  currency: true,
  notes: true,
  fileName: true,
  fileSize: true,
  archivedAt: true,
  createdById: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, companyName: true } },
  project: { select: { id: true, name: true } },
} as const;
