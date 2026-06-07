import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  jsPDF,
  drawHeader,
  drawSectionHeading,
  drawInfoRow,
  drawTextBlock,
  drawAmountBox,
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

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, companyName: true, contactPerson: true, phone: true, email: true },
      },
      prospect: {
        select: { id: true, name: true, sector: true, phone: true },
      },
      proposal: {
        select: { id: true, packageName: true, services: true, amount: true, currency: true, timeline: true },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // ----- Build PDF -----
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  let y = drawHeader(
    doc,
    "CONTRACT",
    "Ref",
    `CTR-${contract.id.substring(0, 8).toUpperCase()}`
  );

  // Contract title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BRAND.dark);
  const titleLines = doc.splitTextToSize(contract.title, CONTENT_WIDTH - 8) as string[];
  for (const line of titleLines) {
    doc.text(line, MARGIN_LEFT + 8, y);
    y += 6;
  }
  y += 4;

  // Status and dates
  y = drawInfoRow(doc, y, "Status:", contract.status);
  y = drawInfoRow(doc, y, "Created:", formatDate(contract.createdAt));
  if (contract.signedDate) {
    y = drawInfoRow(doc, y, "Signed:", formatDate(contract.signedDate));
  }
  if (contract.startDate) {
    y = drawInfoRow(doc, y, "Start Date:", formatDate(contract.startDate));
  }
  if (contract.endDate) {
    y = drawInfoRow(doc, y, "End Date:", formatDate(contract.endDate));
  }
  y += 4;

  // Parties
  const clientName = contract.client?.companyName || contract.prospect?.name || "—";

  y = drawSectionHeading(doc, y, "Parties");

  // Party A (agency)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);
  doc.text("Party A (Service Provider):", MARGIN_LEFT + 8, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(BRAND.name, MARGIN_LEFT + 12, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.grey);
  doc.text(BRAND.tagline, MARGIN_LEFT + 12, y);
  y += 5;
  doc.text(`Email: ${BRAND.email}`, MARGIN_LEFT + 12, y);
  y += 5;
  doc.text(`Phone: ${BRAND.phone}`, MARGIN_LEFT + 12, y);
  y += 10;

  // Party B (client)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.text);
  doc.text("Party B (Client):", MARGIN_LEFT + 8, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(clientName, MARGIN_LEFT + 12, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.grey);

  const contactPerson = contract.client?.contactPerson || "";
  const clientPhone = contract.client?.phone || contract.prospect?.phone || "";
  const clientEmail = contract.client?.email || "";

  if (contactPerson) {
    doc.text(`Contact: ${contactPerson}`, MARGIN_LEFT + 12, y);
    y += 5;
  }
  if (clientPhone) {
    doc.text(`Phone: ${clientPhone}`, MARGIN_LEFT + 12, y);
    y += 5;
  }
  if (clientEmail) {
    doc.text(`Email: ${clientEmail}`, MARGIN_LEFT + 12, y);
    y += 5;
  }
  y += 6;

  // Scope of work (from linked proposal)
  if (contract.proposal?.services) {
    y = drawSectionHeading(doc, y, "Scope of Work");

    if (contract.proposal.packageName) {
      y = drawInfoRow(doc, y, "Package:", contract.proposal.packageName);
      y += 2;
    }

    const serviceLines = contract.proposal.services
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (let i = 0; i < serviceLines.length; i++) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.text);

      // Bullet point
      doc.setFillColor(...BRAND.purple);
      doc.circle(MARGIN_LEFT + 12, y - 1.2, 1.2, "F");

      doc.text(serviceLines[i], MARGIN_LEFT + 18, y);
      y += 6;
    }
    y += 2;

    if (contract.proposal.timeline) {
      y = drawInfoRow(doc, y, "Timeline:", contract.proposal.timeline);
      y += 2;
    }
  }

  // Financial terms
  y = drawSectionHeading(doc, y, "Financial Terms");
  y = drawAmountBox(doc, y, "Contract Value", formatAmount(contract.amount, contract.currency));

  if (contract.paymentTerms) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.text);
    doc.text("Payment Terms:", MARGIN_LEFT + 8, y);
    y += 6;
    y = drawTextBlock(doc, y, contract.paymentTerms);
  }
  y += 4;

  // General terms & conditions
  y = drawSectionHeading(doc, y, "General Terms & Conditions");

  const contractTerms = [
    {
      title: "1. Engagement",
      text: `This contract establishes a professional engagement between ${BRAND.name} ("Provider") and ${clientName} ("Client") for the services described herein.`,
    },
    {
      title: "2. Payment",
      text: "Payment shall be made according to the payment terms specified above. Late payments may incur a 2% monthly surcharge. All amounts are in the currency specified unless otherwise agreed.",
    },
    {
      title: "3. Intellectual Property",
      text: "Upon full payment, the Client receives full ownership of all deliverables created specifically for this project. The Provider retains the right to use the work in its portfolio and marketing materials.",
    },
    {
      title: "4. Confidentiality",
      text: "Both parties agree to keep confidential any proprietary information disclosed during the course of this engagement. This obligation survives the termination of this contract.",
    },
    {
      title: "5. Revisions & Scope Changes",
      text: "The agreed scope includes reasonable revisions as defined in the project brief. Additional work beyond the original scope will be quoted separately and requires written approval from the Client.",
    },
    {
      title: "6. Termination",
      text: "Either party may terminate this contract with 15 days written notice. In case of termination, the Client shall pay for all work completed up to the termination date.",
    },
    {
      title: "7. Liability",
      text: "The Provider's total liability under this contract shall not exceed the total contract value. The Provider is not liable for indirect, consequential, or incidental damages.",
    },
    {
      title: "8. Force Majeure",
      text: "Neither party shall be liable for delays caused by circumstances beyond their reasonable control, including but not limited to natural disasters, war, or government regulations.",
    },
    {
      title: "9. Governing Law",
      text: "This contract shall be governed by and construed in accordance with the laws of the Kingdom of Morocco. Any disputes shall be resolved through amicable negotiation before resorting to legal proceedings.",
    },
  ];

  for (const clause of contractTerms) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.dark);
    // Check for page break before clause title
    if (y + 12 > 272) {
      doc.addPage();
      doc.setFillColor(...BRAND.purple);
      doc.rect(0, 0, 210, 2, "F");
      y = 15;
    }
    doc.text(clause.title, MARGIN_LEFT + 8, y);
    y += 6;
    y = drawTextBlock(doc, y, clause.text);
    y += 2;
  }

  // Additional notes
  if (contract.notes) {
    y += 2;
    y = drawSectionHeading(doc, y, "Additional Notes");
    y = drawTextBlock(doc, y, contract.notes);
    y += 4;
  }

  // Signature area
  y += 6;
  y = drawSignatureArea(doc, y, `For ${BRAND.name}`, `For ${clientName}`);

  // Created-by stamp
  if (contract.createdByName) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.grey);
    doc.text(`Prepared by: ${contract.createdByName}`, MARGIN_LEFT + 8, y);
  }

  // Apply footers on all pages
  applyFooters(doc);

  // Return PDF
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `Contract-${clientName.replace(/[^a-zA-Z0-9]/g, "_")}-${contract.id.substring(0, 8)}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
