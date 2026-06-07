import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  jsPDF,
  drawHeader,
  drawSectionHeading,
  drawInfoRow,
  drawTable,
  drawAmountBox,
  drawTextBlock,
  applyFooters,
  formatDate,
  formatAmount,
  BRAND,
  MARGIN_LEFT,
  CONTENT_WIDTH,
} from "@/lib/pdf-utils";

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

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

  // Parse line items
  let items: LineItem[] = [];
  try {
    items = JSON.parse(invoice.items || "[]");
  } catch {
    items = [];
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // --- Header ---
  let y = drawHeader(doc, "INVOICE", "Invoice #", invoice.invoiceNumber);

  // --- Invoice meta ---
  y = drawInfoRow(doc, y, "Date:", formatDate(invoice.createdAt));
  if (invoice.dueDate) {
    y = drawInfoRow(doc, y, "Due Date:", formatDate(invoice.dueDate));
  }
  y = drawInfoRow(doc, y, "Status:", invoice.status);
  if (invoice.paidAt) {
    y = drawInfoRow(doc, y, "Paid On:", formatDate(invoice.paidAt));
  }
  y += 4;

  // --- Bill To ---
  y = drawSectionHeading(doc, y, "Bill To");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.text);
  doc.text(invoice.clientName, MARGIN_LEFT + 8, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.grey);

  if (invoice.clientEmail) {
    doc.text(`Email: ${invoice.clientEmail}`, MARGIN_LEFT + 8, y);
    y += 5;
  }
  if (invoice.clientPhone) {
    doc.text(`Phone: ${invoice.clientPhone}`, MARGIN_LEFT + 8, y);
    y += 5;
  }
  if (invoice.clientAddress) {
    const addressLines = doc.splitTextToSize(invoice.clientAddress, CONTENT_WIDTH - 16) as string[];
    for (const line of addressLines) {
      doc.text(line, MARGIN_LEFT + 8, y);
      y += 5;
    }
  }
  y += 6;

  // --- Line Items Table ---
  y = drawSectionHeading(doc, y, "Line Items");

  const headers = ["#", "Description", "Qty", "Unit Price", "Total"];
  const colWidths = [10, 80, 20, 30, 30];

  const rows = items.map((item, i) => [
    String(i + 1),
    item.description,
    String(item.quantity),
    formatAmount(item.unitPrice, invoice.currency),
    formatAmount(item.quantity * item.unitPrice, invoice.currency),
  ]);

  y = drawTable(doc, y, headers, rows, colWidths);
  y += 4;

  // --- Totals section (right-aligned) ---
  const totalsX = MARGIN_LEFT + CONTENT_WIDTH - 90;
  const valX = MARGIN_LEFT + CONTENT_WIDTH - 5;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);
  doc.text("Subtotal:", totalsX, y);
  doc.text(formatAmount(invoice.subtotal, invoice.currency), valX, y, { align: "right" });
  y += 7;

  // Tax
  doc.text(`TVA (${invoice.taxRate}%):`, totalsX, y);
  doc.text(formatAmount(invoice.taxAmount, invoice.currency), valX, y, { align: "right" });
  y += 7;

  // Divider
  doc.setDrawColor(...BRAND.purple);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, valX, y);
  y += 6;

  // Total (highlighted)
  y = drawAmountBox(doc, y, "Total Due", formatAmount(invoice.total, invoice.currency));
  y += 4;

  // --- Payment Terms ---
  y = drawSectionHeading(doc, y, "Payment Information");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);

  const paymentInfo = [
    "Payment Method: Bank Transfer / Wire",
    "Bank: [Your Bank Name]",
    "Account Name: Ibda3 Digital",
    "IBAN: [IBAN Number]",
    "SWIFT/BIC: [SWIFT Code]",
    "",
    "Please include the invoice number in the payment reference.",
  ];

  for (const line of paymentInfo) {
    if (line === "") {
      y += 3;
      continue;
    }
    doc.text(line, MARGIN_LEFT + 8, y);
    y += 5;
  }
  y += 4;

  // --- Notes ---
  if (invoice.notes) {
    y = drawSectionHeading(doc, y, "Notes");
    y = drawTextBlock(doc, y, invoice.notes);
    y += 4;
  }

  // --- Footer note ---
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.grey);
  doc.text("Thank you for your business!", MARGIN_LEFT + 8, y);
  y += 5;
  if (invoice.createdByName) {
    doc.text(`Prepared by: ${invoice.createdByName}`, MARGIN_LEFT + 8, y);
  }

  // Apply footers on all pages
  applyFooters(doc);

  // Return PDF
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const safeName = invoice.clientName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${invoice.invoiceNumber}-${safeName}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
