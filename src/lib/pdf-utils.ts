import { jsPDF } from "jspdf";

// Agency branding
const BRAND = {
  name: "Ibda3 Digital",
  tagline: "Digital Agency - Marrakech, Morocco",
  email: "ibda3.digital0@gmail.com",
  phone: "+212 625 461 645",
  website: "ibda3-digital.vercel.app",
  purple: [139, 0, 255] as [number, number, number],    // #8B00FF
  purpleLight: [167, 139, 250] as [number, number, number], // #A78BFA
  dark: [15, 15, 26] as [number, number, number],       // #0F0F1A
  grey: [156, 163, 175] as [number, number, number],    // #9CA3AF
  text: [50, 50, 60] as [number, number, number],
  lightBg: [245, 245, 250] as [number, number, number],
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

/** Draw the company header block at the top of a page */
export function drawHeader(doc: jsPDF, title: string, refLabel: string, refValue: string): number {
  let y = 15;

  // Purple accent bar at the very top
  doc.setFillColor(...BRAND.purple);
  doc.rect(0, 0, PAGE_WIDTH, 4, "F");

  // Company name
  y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BRAND.purple);
  doc.text(BRAND.name, MARGIN_LEFT, y);

  // Tagline
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.grey);
  doc.text(BRAND.tagline, MARGIN_LEFT, y);

  // Contact info (right-aligned)
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.grey);
  doc.text(BRAND.email, rightX, 18, { align: "right" });
  doc.text(BRAND.phone, rightX, 23, { align: "right" });
  doc.text(BRAND.website, rightX, 28, { align: "right" });

  // Divider line
  y += 5;
  doc.setDrawColor(...BRAND.purple);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  // Document title
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND.dark);
  doc.text(title, MARGIN_LEFT, y);

  // Reference number
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.grey);
  doc.text(`${refLabel}: ${refValue}`, MARGIN_LEFT, y);

  return y + 8;
}

/** Draw a section heading with purple accent */
export function drawSectionHeading(doc: jsPDF, y: number, title: string): number {
  y = checkPageBreak(doc, y, 15);
  doc.setFillColor(...BRAND.purple);
  doc.rect(MARGIN_LEFT, y - 4, 3, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.dark);
  doc.text(title, MARGIN_LEFT + 8, y + 4);
  return y + 16;
}

/** Draw a key-value info row */
export function drawInfoRow(doc: jsPDF, y: number, label: string, value: string): number {
  y = checkPageBreak(doc, y, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.grey);
  doc.text(label, MARGIN_LEFT + 8, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.text);
  doc.text(value || "—", MARGIN_LEFT + 55, y);

  return y + 7;
}

/** Draw a table with header row + data rows */
export function drawTable(
  doc: jsPDF,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): number {
  y = checkPageBreak(doc, y, 20);
  const rowHeight = 8;

  // Header row
  doc.setFillColor(...BRAND.purple);
  doc.rect(MARGIN_LEFT, y - 5, CONTENT_WIDTH, rowHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);

  let xPos = MARGIN_LEFT + 3;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], xPos, y);
    xPos += colWidths[i];
  }

  y += rowHeight;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (let r = 0; r < rows.length; r++) {
    y = checkPageBreak(doc, y, rowHeight + 2);

    // Alternating background
    if (r % 2 === 0) {
      doc.setFillColor(...BRAND.lightBg);
      doc.rect(MARGIN_LEFT, y - 5, CONTENT_WIDTH, rowHeight, "F");
    }

    doc.setTextColor(...BRAND.text);
    xPos = MARGIN_LEFT + 3;
    for (let c = 0; c < rows[r].length; c++) {
      const cellText = rows[r][c] || "";
      // Truncate long text to fit column
      const maxChars = Math.floor(colWidths[c] / 2.2);
      const displayText = cellText.length > maxChars ? cellText.substring(0, maxChars - 2) + ".." : cellText;
      doc.text(displayText, xPos, y);
      xPos += colWidths[c];
    }
    y += rowHeight;
  }

  return y + 4;
}

/** Draw a highlighted amount box */
export function drawAmountBox(doc: jsPDF, y: number, label: string, amount: string): number {
  y = checkPageBreak(doc, y, 25);
  const boxWidth = 90;
  const boxX = PAGE_WIDTH - MARGIN_RIGHT - boxWidth;

  doc.setFillColor(...BRAND.lightBg);
  doc.roundedRect(boxX, y, boxWidth, 20, 3, 3, "F");
  doc.setDrawColor(...BRAND.purple);
  doc.setLineWidth(0.8);
  doc.roundedRect(boxX, y, boxWidth, 20, 3, 3, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.grey);
  doc.text(label, boxX + 5, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.purple);
  doc.text(amount, boxX + 5, y + 17);

  return y + 28;
}

/** Draw a multiline text block with word wrapping */
export function drawTextBlock(doc: jsPDF, y: number, text: string, maxWidth?: number): number {
  const width = maxWidth ?? CONTENT_WIDTH - 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);

  const lines = doc.splitTextToSize(text, width) as string[];
  for (const line of lines) {
    y = checkPageBreak(doc, y, 6);
    doc.text(line, MARGIN_LEFT + 8, y);
    y += 5;
  }
  return y + 3;
}

/** Draw the footer with page number */
export function drawFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  const y = PAGE_HEIGHT - 12;

  // Bottom accent line
  doc.setDrawColor(...BRAND.purple);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y - 3, PAGE_WIDTH - MARGIN_RIGHT, y - 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.grey);
  doc.text(`${BRAND.name} — ${BRAND.tagline}`, MARGIN_LEFT, y);
  doc.text(`Page ${pageNum} / ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: "right" });
}

/** Draw a signature area with two signature blocks */
export function drawSignatureArea(doc: jsPDF, y: number, party1: string, party2: string): number {
  y = checkPageBreak(doc, y, 55);

  y = drawSectionHeading(doc, y, "Signatures");

  const colWidth = CONTENT_WIDTH / 2 - 5;
  const col1X = MARGIN_LEFT + 8;
  const col2X = MARGIN_LEFT + CONTENT_WIDTH / 2 + 5;

  // Party 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);
  doc.text(party1, col1X, y);

  // Party 2
  doc.text(party2, col2X, y);

  y += 8;

  // Signature lines
  doc.setDrawColor(...BRAND.grey);
  doc.setLineWidth(0.3);

  // Left signature line
  doc.text("Signature:", col1X, y);
  y += 3;
  doc.line(col1X, y + 15, col1X + colWidth - 10, y + 15);

  // Right signature line
  doc.text("Signature:", col2X, y - 3);
  doc.line(col2X, y + 15, col2X + colWidth - 10, y + 15);

  y += 20;

  // Date lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Date: ____________________", col1X, y);
  doc.text("Date: ____________________", col2X, y);

  return y + 12;
}

/** Check if we need a page break, and add one if so */
function checkPageBreak(doc: jsPDF, y: number, requiredSpace: number): number {
  if (y + requiredSpace > PAGE_HEIGHT - 25) {
    doc.addPage();
    // Re-draw top accent bar on new page
    doc.setFillColor(...BRAND.purple);
    doc.rect(0, 0, PAGE_WIDTH, 2, "F");
    return 15;
  }
  return y;
}

/** Apply footers to all pages */
export function applyFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }
}

/** Format a date nicely */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** Format currency amount */
export function formatAmount(amount: number, currency: string): string {
  if (currency === "MAD") {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
  }
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export { jsPDF, BRAND, MARGIN_LEFT, CONTENT_WIDTH, PAGE_WIDTH, PAGE_HEIGHT };
