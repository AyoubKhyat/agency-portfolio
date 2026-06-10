import { jsPDF } from "jspdf";

/* ============================================================
 * Shared executive PDF design system.
 * Tokens + atomic primitives used by Proposal and Contract PDFs.
 * The Invoice PDF inlines identical tokens (kept self-contained).
 * ============================================================ */

export type RGB = [number, number, number];

// --- Page geometry (A4 portrait, mm) ---
export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN_X = 20;
export const MARGIN_Y = 22;
export const CONTENT_W = PAGE_W - MARGIN_X * 2;
export const FOOTER_BASELINE = PAGE_H - 14;
export const SAFE_BOTTOM = PAGE_H - 25;

// --- Color tokens ---
export const TEXT: RGB = [17, 24, 39];           // #111827
export const MUTED: RGB = [75, 85, 99];          // #4B5563
export const SUBTLE: RGB = [156, 163, 175];      // #9CA3AF
export const BORDER: RGB = [229, 231, 235];      // #E5E7EB
export const BORDER_SOFT: RGB = [243, 244, 246]; // #F3F4F6
export const ACCENT: RGB = [139, 0, 255];        // #8B00FF

// --- Brand ---
export const BRAND = {
  name: "IBDA3 DIGITAL",
  legalName: "Ibda3 Digital",
  tagline: "Digital Agency  ·  Marrakech, Morocco",
  email: "ibda3.digital0@gmail.com",
  phone: "+212 625 461 645",
  website: "ibda3-digital.vercel.app",
};

// --- Status pill palette (covers Invoice / Proposal / Contract) ---
const NEUTRAL = { bg: [243, 244, 246] as RGB, fg: [75, 85, 99] as RGB };
const BLUE = { bg: [219, 234, 254] as RGB, fg: [29, 78, 216] as RGB };
const GREEN = { bg: [220, 252, 231] as RGB, fg: [21, 128, 61] as RGB };
const RED = { bg: [254, 226, 226] as RGB, fg: [185, 28, 28] as RGB };
const AMBER = { bg: [254, 243, 199] as RGB, fg: [146, 64, 14] as RGB };

export const STATUS_PALETTE: Record<string, { bg: RGB; fg: RGB }> = {
  DRAFT: NEUTRAL,
  CANCELLED: NEUTRAL,
  REJECTED: RED,
  SENT: BLUE,
  PAID: GREEN,
  OVERDUE: RED,
  ACCEPTED: GREEN,
  PENDING_SIGNATURE: AMBER,
  SIGNED: GREEN,
  ACTIVE: BLUE,
  COMPLETED: GREEN,
};

// --- Formatting ---
export function formatMoney(amount: number, currency: string): string {
  const n = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${currency}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// --- Primitives ---

/** Reserve vertical space; insert a page break if needed. Returns y to use. */
export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= SAFE_BOTTOM) return y;
  doc.addPage();
  return MARGIN_Y;
}

/** Small uppercase section label. */
export function drawSectionLabel(doc: jsPDF, y: number, label: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  doc.text(label.toUpperCase(), MARGIN_X, y);
  return y + 6;
}

/** Hairline border across the content width. */
export function drawDivider(doc: jsPDF, y: number, soft = false): void {
  doc.setDrawColor(...(soft ? BORDER_SOFT : BORDER));
  doc.setLineWidth(soft ? 0.1 : 0.2);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
}

/** Brand wordmark + contact info + divider. Returns y AFTER the spacer below the divider. */
export function drawBrandHeader(doc: jsPDF, startY: number = MARGIN_Y): number {
  // Wordmark (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text(BRAND.name, MARGIN_X, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(BRAND.tagline, MARGIN_X, startY + 5);

  // Contact (right)
  const rightX = PAGE_W - MARGIN_X;
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(BRAND.email, rightX, startY - 1, { align: "right" });
  doc.text(BRAND.phone, rightX, startY + 3.5, { align: "right" });
  doc.text(BRAND.website, rightX, startY + 8, { align: "right" });

  const dividerY = startY + 14;
  drawDivider(doc, dividerY);
  return dividerY + 16;
}

/** Right-aligned status pill at the given baseline. */
export function drawStatusPill(doc: jsPDF, rightX: number, baselineY: number, status: string): void {
  const palette = STATUS_PALETTE[status] || STATUS_PALETTE.DRAFT;
  const label = status.replace(/_/g, " ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const textW = doc.getTextWidth(label);
  const pillW = textW + 8;
  const pillH = 5.5;
  const pillX = rightX - pillW;

  doc.setFillColor(...palette.bg);
  doc.roundedRect(pillX, baselineY - pillH + 2, pillW, pillH, 1.5, 1.5, "F");
  doc.setTextColor(...palette.fg);
  doc.text(label, pillX + pillW / 2, baselineY - 1, { align: "center" });
}

/** Right-aligned meta pair (LABEL above value). Returns y advanced by 11mm. */
export function drawMetaPair(
  doc: jsPDF,
  y: number,
  rightX: number,
  label: string,
  value: string
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text(label.toUpperCase(), rightX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(value, rightX, y + 5, { align: "right" });
  return y + 11;
}

/** Body text block at body size; wraps. */
export function drawTextBlock(
  doc: jsPDF,
  y: number,
  text: string,
  opts?: { width?: number; size?: number; color?: RGB }
): number {
  const width = opts?.width ?? CONTENT_W;
  const size = opts?.size ?? 9.5;
  const color = opts?.color ?? TEXT;
  const lineH = size * 0.45 + 1.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, width) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineH);
    doc.text(line, MARGIN_X, y);
    y += lineH;
  }
  return y + 2;
}

/** Footer + page numbers, applied to all pages at the end. */
export function applyFooters(doc: jsPDF, message: string): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, FOOTER_BASELINE - 6, PAGE_W - MARGIN_X, FOOTER_BASELINE - 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    doc.text(message, MARGIN_X, FOOTER_BASELINE);
    if (total > 1) {
      doc.text(`${p} / ${total}`, PAGE_W - MARGIN_X, FOOTER_BASELINE, { align: "right" });
    }
  }
}

/** Two-column signature block. */
export function drawSignatureBlock(
  doc: jsPDF,
  y: number,
  left: { label: string; name?: string | null; subline?: string | null },
  right: { label: string; name?: string | null; subline?: string | null }
): number {
  y = ensureSpace(doc, y, 26);
  const sigColW = (CONTENT_W - 20) / 2;
  const sigLX = MARGIN_X;
  const sigRX = MARGIN_X + sigColW + 20;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(sigLX, y, sigLX + sigColW, y);
  doc.line(sigRX, y, sigRX + sigColW, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text(left.label.toUpperCase(), sigLX, y);
  doc.text(right.label.toUpperCase(), sigRX, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (left.name) {
    doc.setTextColor(...TEXT);
    doc.text(left.name, sigLX, y);
  } else {
    doc.setTextColor(...SUBTLE);
    doc.text("Signature & date", sigLX, y);
  }

  if (right.name) {
    doc.setTextColor(...TEXT);
    doc.text(right.name, sigRX, y);
  } else {
    doc.setTextColor(...SUBTLE);
    doc.text("Signature & date", sigRX, y);
  }

  if (left.subline || right.subline) {
    y += 4.5;
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    if (left.subline) doc.text(left.subline, sigLX, y);
    if (right.subline) doc.text(right.subline, sigRX, y);
  }

  return y + 6;
}
