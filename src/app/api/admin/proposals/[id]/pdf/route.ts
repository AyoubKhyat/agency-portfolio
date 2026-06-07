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
  drawSignatureArea,
  applyFooters,
  formatDate,
  formatAmount,
  BRAND,
  MARGIN_LEFT,
  CONTENT_WIDTH,
} from "@/lib/pdf-utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      prospect: {
        select: { id: true, name: true, sector: true, phone: true, neighborhood: true, instagram: true },
      },
      client: {
        select: { id: true, companyName: true, contactPerson: true, phone: true, email: true },
      },
    },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // ----- Build PDF -----
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  let y = drawHeader(
    doc,
    "PROPOSAL",
    "Ref",
    `PROP-${proposal.id.substring(0, 8).toUpperCase()}`
  );

  // Date info
  y = drawInfoRow(doc, y, "Date:", formatDate(proposal.createdAt));
  if (proposal.sentAt) {
    y = drawInfoRow(doc, y, "Sent:", formatDate(proposal.sentAt));
  }
  y = drawInfoRow(doc, y, "Status:", proposal.status);
  y += 4;

  // Client / Prospect info
  const clientName = proposal.client?.companyName || proposal.prospect?.name || "—";
  const contactPerson = proposal.contactPerson || proposal.client?.contactPerson || "—";
  const clientPhone = proposal.client?.phone || proposal.prospect?.phone || "—";
  const clientEmail = proposal.client?.email || "—";
  const clientSector = proposal.prospect?.sector || "—";

  y = drawSectionHeading(doc, y, "Client Information");
  y = drawInfoRow(doc, y, "Company:", clientName);
  y = drawInfoRow(doc, y, "Contact:", contactPerson);
  y = drawInfoRow(doc, y, "Phone:", clientPhone);
  if (clientEmail !== "—") {
    y = drawInfoRow(doc, y, "Email:", clientEmail);
  }
  y = drawInfoRow(doc, y, "Sector:", clientSector);
  y += 4;

  // Package / Services
  y = drawSectionHeading(doc, y, "Proposed Services");

  if (proposal.packageName) {
    y = drawInfoRow(doc, y, "Package:", proposal.packageName);
    y += 2;
  }

  // Parse services into a table (services is a comma or newline-separated string)
  const serviceLines = proposal.services
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (serviceLines.length > 0) {
    const serviceRows = serviceLines.map((s, i) => [String(i + 1), s]);
    y = drawTable(
      doc,
      y,
      ["#", "Service"],
      serviceRows,
      [15, CONTENT_WIDTH - 15]
    );
  }

  y += 2;

  // Timeline
  if (proposal.timeline) {
    y = drawSectionHeading(doc, y, "Timeline");
    y = drawTextBlock(doc, y, proposal.timeline);
    y += 2;
  }

  // Payment terms
  if (proposal.paymentTerms) {
    y = drawSectionHeading(doc, y, "Payment Terms");
    y = drawTextBlock(doc, y, proposal.paymentTerms);
    y += 2;
  }

  // Total amount
  y = drawAmountBox(doc, y, "Total Amount", formatAmount(proposal.amount, proposal.currency));
  y += 4;

  // Notes / additional info
  if (proposal.notes) {
    y = drawSectionHeading(doc, y, "Notes");
    y = drawTextBlock(doc, y, proposal.notes);
    y += 4;
  }

  // Terms & conditions
  y = drawSectionHeading(doc, y, "Terms & Conditions");
  const terms = [
    "1. This proposal is valid for 30 days from the date of issue.",
    "2. Prices are exclusive of applicable taxes unless otherwise stated.",
    "3. Work will commence upon acceptance and receipt of the agreed deposit.",
    "4. The client will provide all necessary content, assets, and feedback in a timely manner.",
    "5. Changes to the scope of work after acceptance may result in additional charges.",
    "6. Ibda3 Digital retains the right to showcase the completed project in its portfolio.",
  ];
  for (const term of terms) {
    y = drawTextBlock(doc, y, term);
  }

  y += 6;

  // Acceptance signature
  y = drawSignatureArea(doc, y, `For ${BRAND.name}`, `For ${clientName}`);

  // Stamp created by
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.grey);
  doc.text(`Prepared by: ${proposal.createdByName}`, MARGIN_LEFT + 8, y);

  // Apply footers on all pages
  applyFooters(doc);

  // Return PDF
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `Proposal-${clientName.replace(/[^a-zA-Z0-9]/g, "_")}-${proposal.id.substring(0, 8)}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
