import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/* ============================================================
 * Premium invoice template — minimalist, B2B agency aesthetic.
 * Single-source design constants. All drawing inlined here so
 * the document is self-contained and unaffected by shared helpers.
 * ============================================================ */

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type RGB = [number, number, number];

// --- Page geometry (A4 portrait, mm) ---
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 20;
const MARGIN_Y = 22;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FOOTER_BASELINE = PAGE_H - 14;
const SAFE_BOTTOM = PAGE_H - 25;

// --- Color tokens ---
const TEXT: RGB = [17, 24, 39];          // #111827
const MUTED: RGB = [75, 85, 99];         // #4B5563
const SUBTLE: RGB = [156, 163, 175];     // #9CA3AF
const BORDER: RGB = [229, 231, 235];     // #E5E7EB
const BORDER_SOFT: RGB = [243, 244, 246]; // #F3F4F6
const ACCENT: RGB = [139, 0, 255];       // #8B00FF

// --- Status pill palette ---
const STATUS_PALETTE: Record<string, { bg: RGB; fg: RGB }> = {
  DRAFT: { bg: [243, 244, 246], fg: [75, 85, 99] },
  SENT: { bg: [219, 234, 254], fg: [29, 78, 216] },
  PAID: { bg: [220, 252, 231], fg: [21, 128, 61] },
  OVERDUE: { bg: [254, 226, 226], fg: [185, 28, 28] },
  CANCELLED: { bg: [243, 244, 246], fg: [107, 114, 128] },
};

// --- Formatting helpers ---
function formatMoney(amount: number, currency: string): string {
  const n = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${currency}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// --- Page break helpers ---
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= SAFE_BOTTOM) return y;
  doc.addPage();
  return MARGIN_Y;
}

// --- Section label (small uppercase) ---
function drawSectionLabel(doc: jsPDF, y: number, label: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  doc.text(label.toUpperCase(), MARGIN_X, y);
  return y + 6;
}

// --- Status pill ---
function drawStatusPill(doc: jsPDF, rightX: number, y: number, status: string): void {
  const palette = STATUS_PALETTE[status] || STATUS_PALETTE.DRAFT;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const textW = doc.getTextWidth(status);
  const padX = 4;
  const padY = 2;
  const pillW = textW + padX * 2;
  const pillH = 5.5;
  const pillX = rightX - pillW;

  doc.setFillColor(...palette.bg);
  doc.roundedRect(pillX, y - pillH + padY, pillW, pillH, 1.5, 1.5, "F");
  doc.setTextColor(...palette.fg);
  doc.text(status, pillX + pillW / 2, y - 1, { align: "center" });
}

// --- Footer (applied to all pages at the end) ---
function applyFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, FOOTER_BASELINE - 6, PAGE_W - MARGIN_X, FOOTER_BASELINE - 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    doc.text("Thank you for your business.", MARGIN_X, FOOTER_BASELINE);
    if (total > 1) {
      doc.text(`${p} / ${total}`, PAGE_W - MARGIN_X, FOOTER_BASELINE, { align: "right" });
    }
  }
}

// --- Items table header ---
type TableCols = {
  xDescL: number;   // left edge of description
  xQtyR: number;    // right edge for Qty (right-aligned anchor)
  xPriceR: number;  // right edge for Unit Price
  xAmtR: number;    // right edge for Amount
};

function drawTableHeader(doc: jsPDF, y: number, cols: TableCols): number {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  doc.text("DESCRIPTION", cols.xDescL, y);
  doc.text("QTY", cols.xQtyR, y, { align: "right" });
  doc.text("UNIT PRICE", cols.xPriceR, y, { align: "right" });
  doc.text("AMOUNT", cols.xAmtR, y, { align: "right" });

  y += 3;
  doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
  return y + 6;
}

/* ============================================================
 * Route handler
 * ============================================================ */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  let items: LineItem[] = [];
  try {
    items = JSON.parse(invoice.items || "[]");
  } catch {
    items = [];
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setFont("helvetica", "normal");

  let y = MARGIN_Y;

  /* ---------- HEADER ---------- */
  // Wordmark (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text("IBDA3 DIGITAL", MARGIN_X, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Digital Agency  ·  Marrakech, Morocco", MARGIN_X, y + 5);

  // Contact info (right)
  const rightX = PAGE_W - MARGIN_X;
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("ibda3.digital0@gmail.com", rightX, y - 1, { align: "right" });
  doc.text("+212 625 461 645", rightX, y + 3.5, { align: "right" });
  doc.text("ibda3-digital.vercel.app", rightX, y + 8, { align: "right" });

  y += 14;

  // Thin divider
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);

  y += 16;

  /* ---------- INVOICE TITLE BLOCK ---------- */
  const titleBaselineY = y + 4;

  // Left: title + number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...TEXT);
  doc.text("Invoice", MARGIN_X, titleBaselineY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`#${invoice.invoiceNumber}`, MARGIN_X, titleBaselineY + 7);

  // Right: dates + status, stacked
  const metaStartY = y;
  const metaLineGap = 11;

  // Issue Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text("ISSUE DATE", rightX, metaStartY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(formatDate(invoice.createdAt), rightX, metaStartY + 5, { align: "right" });

  // Due Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text("DUE DATE", rightX, metaStartY + metaLineGap, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const dueText = invoice.dueDate ? formatDate(invoice.dueDate) : "Upon receipt";
  doc.text(dueText, rightX, metaStartY + metaLineGap + 5, { align: "right" });

  // Status pill
  drawStatusPill(doc, rightX, metaStartY + metaLineGap * 2 + 4, invoice.status);

  y = titleBaselineY + 18;

  /* ---------- BILL TO ---------- */
  y = ensureSpace(doc, y, 40);
  y = drawSectionLabel(doc, y, "Bill to");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(invoice.clientName, MARGIN_X, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);

  y += 5;
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, MARGIN_X, y);
    y += 4.5;
  }
  if (invoice.clientPhone) {
    doc.text(invoice.clientPhone, MARGIN_X, y);
    y += 4.5;
  }
  if (invoice.clientAddress) {
    const addrLines = doc.splitTextToSize(invoice.clientAddress, 90) as string[];
    for (const line of addrLines) {
      doc.text(line, MARGIN_X, y);
      y += 4.5;
    }
  }

  y += 12;

  /* ---------- LINE ITEMS TABLE ---------- */
  const colQtyW = 16;
  const colPriceW = 32;
  const colAmtW = 34;
  const cols: TableCols = {
    xDescL: MARGIN_X,
    xQtyR: MARGIN_X + CONTENT_W - colPriceW - colAmtW - 2,
    xPriceR: MARGIN_X + CONTENT_W - colAmtW - 2,
    xAmtR: MARGIN_X + CONTENT_W,
  };
  const descW = cols.xQtyR - colQtyW - MARGIN_X - 4;

  y = ensureSpace(doc, y, 30);
  y = drawTableHeader(doc, y, cols);

  if (items.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUBTLE);
    doc.text("No line items.", MARGIN_X, y);
    y += 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const descLines = doc.splitTextToSize(item.description || "—", descW) as string[];
      const rowH = Math.max(8, descLines.length * 4.8 + 3);

      if (y + rowH > SAFE_BOTTOM - 8) {
        doc.addPage();
        y = MARGIN_Y;
        y = drawTableHeader(doc, y, cols);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      }

      // Description (may wrap)
      doc.setTextColor(...TEXT);
      for (let li = 0; li < descLines.length; li++) {
        doc.text(descLines[li], cols.xDescL, y + li * 4.8);
      }

      // Qty
      doc.setTextColor(...MUTED);
      doc.text(String(item.quantity), cols.xQtyR, y, { align: "right" });

      // Unit price
      doc.setTextColor(...MUTED);
      doc.text(formatMoney(item.unitPrice, invoice.currency), cols.xPriceR, y, { align: "right" });

      // Amount
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT);
      doc.text(
        formatMoney(item.quantity * item.unitPrice, invoice.currency),
        cols.xAmtR,
        y,
        { align: "right" }
      );
      doc.setFont("helvetica", "normal");

      // Soft separator (skip after last row)
      if (i < items.length - 1) {
        doc.setDrawColor(...BORDER_SOFT);
        doc.setLineWidth(0.1);
        doc.line(MARGIN_X, y + rowH - 2, MARGIN_X + CONTENT_W, y + rowH - 2);
      }

      y += rowH;
    }
  }

  // Closing line under table
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);

  /* ---------- TOTALS (right-aligned block) ---------- */
  y += 8;
  y = ensureSpace(doc, y, 32);

  const totalsLabelX = PAGE_W - MARGIN_X - 60;
  const totalsValX = PAGE_W - MARGIN_X;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text("Subtotal", totalsLabelX, y);
  doc.setTextColor(...TEXT);
  doc.text(formatMoney(invoice.subtotal, invoice.currency), totalsValX, y, { align: "right" });

  // VAT
  y += 6;
  doc.setTextColor(...MUTED);
  doc.text(`VAT (${invoice.taxRate}%)`, totalsLabelX, y);
  doc.setTextColor(...TEXT);
  doc.text(formatMoney(invoice.taxAmount, invoice.currency), totalsValX, y, { align: "right" });

  // Divider
  y += 4;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(totalsLabelX, y, totalsValX, y);

  // Total Due — the single accent placement
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text("Total Due", totalsLabelX, y);

  doc.setFontSize(14);
  doc.setTextColor(...ACCENT);
  doc.text(formatMoney(invoice.total, invoice.currency), totalsValX, y, { align: "right" });

  y += 18;

  /* ---------- PAYMENT INFORMATION ---------- */
  y = ensureSpace(doc, y, 50);
  y = drawSectionLabel(doc, y, "Payment information");

  const paymentRows: Array<[string, string]> = [
    ["Account holder", "Ibda3 Digital"],
    ["Bank", "[Your Bank Name]"],
    ["IBAN", "[IBAN Number]"],
    ["SWIFT / BIC", "[SWIFT Code]"],
  ];

  for (const [label, value] of paymentRows) {
    y = ensureSpace(doc, y, 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(label, MARGIN_X, y);

    doc.setTextColor(...TEXT);
    doc.text(value, MARGIN_X + 42, y);

    y += 5.5;
  }

  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUBTLE);
  doc.text(
    `Please reference invoice ${invoice.invoiceNumber} in your payment.`,
    MARGIN_X,
    y
  );

  y += 12;

  /* ---------- NOTES (if present) ---------- */
  if (invoice.notes) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionLabel(doc, y, "Notes");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT);
    const noteLines = doc.splitTextToSize(invoice.notes, CONTENT_W) as string[];
    for (const line of noteLines) {
      y = ensureSpace(doc, y, 6);
      doc.text(line, MARGIN_X, y);
      y += 4.8;
    }
    y += 8;
  }

  /* ---------- SIGNATURE BLOCK ---------- */
  if (y > SAFE_BOTTOM - 30) {
    doc.addPage();
    y = MARGIN_Y;
  }

  const sigColW = (CONTENT_W - 20) / 2;
  const sigLeftX = MARGIN_X;
  const sigRightX = MARGIN_X + sigColW + 20;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(sigLeftX, y, sigLeftX + sigColW, y);
  doc.line(sigRightX, y, sigRightX + sigColW, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text("PREPARED BY", sigLeftX, y);
  doc.text("CLIENT ACKNOWLEDGEMENT", sigRightX, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(invoice.createdByName || "Ibda3 Digital", sigLeftX, y);

  doc.setTextColor(...SUBTLE);
  doc.text("Signature & date", sigRightX, y);

  // Footers across all pages
  applyFooters(doc);

  // Output
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `${invoice.invoiceNumber}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
