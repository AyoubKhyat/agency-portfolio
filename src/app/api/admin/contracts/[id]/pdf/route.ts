import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  PAGE_W,
  MARGIN_X,
  CONTENT_W,
  TEXT,
  MUTED,
  SUBTLE,
  BORDER,
  BORDER_SOFT,
  ACCENT,
  BRAND,
  formatMoney,
  formatDate,
  ensureSpace,
  drawSectionLabel,
  drawDivider,
  drawBrandHeader,
  drawStatusPill,
  drawMetaPair,
  drawTextBlock,
  drawSignatureBlock,
  applyFooters,
} from "@/lib/pdf-theme";

/* ============================================================
 * Contract PDF — formal service agreement
 * Distinct character vs. Invoice / Proposal:
 *  - Title "Agreement" + contract.title as subtitle
 *  - EFFECTIVE DATE / TERM (not Issue/Due, not Prepared/Valid)
 *  - "Parties" block: side-by-side Party A | Party B
 *  - Scope as bulleted (not numbered) list
 *  - Clauses styled as ARTICLE I. / ARTICLE II. ... (small caps headings)
 *  - "Signed electronically" callout when signed (e-sign metadata)
 *  - Footer: "Confidential — for the parties above only."
 * ============================================================ */

const CLAUSES: Array<{ heading: string; body: (ctx: ClauseContext) => string }> = [
  {
    heading: "Engagement",
    body: ({ provider, client }) =>
      `This Agreement is entered into between ${provider} (the "Provider") and ${client} (the "Client") for the services described in the Scope of Work. By signing below, both parties agree to the terms set forth herein.`,
  },
  {
    heading: "Payment",
    body: () =>
      "Payment shall be made according to the payment terms specified above. Late payments may incur a 2% monthly surcharge. All amounts are stated in the currency specified unless otherwise agreed in writing.",
  },
  {
    heading: "Intellectual Property",
    body: () =>
      "Upon full payment, the Client receives ownership of all deliverables created specifically for this engagement. The Provider retains the right to display the work in its portfolio and marketing materials, unless restricted by separate written agreement.",
  },
  {
    heading: "Confidentiality",
    body: () =>
      "Both parties agree to keep confidential any proprietary or non-public information disclosed during the course of this engagement. This obligation survives termination of the Agreement.",
  },
  {
    heading: "Revisions & Scope Changes",
    body: () =>
      "The agreed Scope of Work includes reasonable revisions as defined in the project brief. Work beyond the original scope will be quoted separately and requires written approval from the Client before commencing.",
  },
  {
    heading: "Termination",
    body: () =>
      "Either party may terminate this Agreement with fifteen (15) days written notice. Upon termination, the Client shall pay for all work completed up to the termination date.",
  },
  {
    heading: "Liability",
    body: () =>
      "The Provider's total liability under this Agreement shall not exceed the total Contract Value. Neither party shall be liable for indirect, consequential, incidental, or punitive damages.",
  },
  {
    heading: "Force Majeure",
    body: () =>
      "Neither party shall be liable for delays caused by circumstances beyond their reasonable control, including but not limited to natural disasters, war, civil unrest, or government regulations.",
  },
  {
    heading: "Governing Law",
    body: () =>
      "This Agreement shall be governed by and construed in accordance with the laws of the Kingdom of Morocco. Disputes shall first be addressed through good-faith negotiation before resorting to legal proceedings.",
  },
];

type ClauseContext = { provider: string; client: string };

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, contactPerson: true, phone: true, email: true } },
      prospect: { select: { id: true, name: true, sector: true, phone: true } },
      proposal: { select: { id: true, packageName: true, services: true, amount: true, currency: true, timeline: true } },
    },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // --- Resolved fields ---
  const clientName = contract.client?.companyName || contract.prospect?.name || "—";
  const contactPerson = contract.client?.contactPerson || "";
  const clientPhone = contract.client?.phone || contract.prospect?.phone || "";
  const clientEmail = contract.client?.email || "";
  const ref = `CTR-${contract.id.substring(0, 8).toUpperCase()}`;
  const isSigned = !!contract.signatureData || !!contract.signedAt || contract.status === "SIGNED" || contract.status === "ACTIVE" || contract.status === "COMPLETED";

  // Term string (e.g. "May 20, 2026 → Aug 20, 2026" or "From May 20, 2026" or "Until completion")
  const termString = (() => {
    if (contract.startDate && contract.endDate) {
      return `${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`;
    }
    if (contract.startDate) return `From ${formatDate(contract.startDate)}`;
    if (contract.endDate) return `Until ${formatDate(contract.endDate)}`;
    return "Until completion";
  })();
  const effectiveDate = contract.signedDate || contract.startDate || contract.createdAt;

  const services = (contract.proposal?.services || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // --- Build PDF ---
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setFont("helvetica", "normal");

  let y = drawBrandHeader(doc);
  const rightX = PAGE_W - MARGIN_X;

  /* ---------- Title block ---------- */
  const titleBaselineY = y + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...TEXT);
  doc.text("Agreement", MARGIN_X, titleBaselineY);

  // Subtitle: contract title (project name), wraps if long
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const subtitleLines = doc.splitTextToSize(contract.title || "Service Agreement", 100) as string[];
  doc.text(subtitleLines[0] || "", MARGIN_X, titleBaselineY + 7);
  if (subtitleLines.length > 1) {
    doc.text(subtitleLines[1], MARGIN_X, titleBaselineY + 12);
  }

  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  doc.text(`#${ref}`, MARGIN_X, titleBaselineY + (subtitleLines.length > 1 ? 18 : 13));

  // Right meta
  const metaY = y;
  drawMetaPair(doc, metaY, rightX, "Effective date", formatDate(effectiveDate));
  drawMetaPair(doc, metaY + 11, rightX, "Term", termString);
  drawStatusPill(doc, rightX, metaY + 22 + 4, contract.status);

  y = titleBaselineY + (subtitleLines.length > 1 ? 24 : 19);

  /* ---------- Parties (two-column side-by-side panel) ---------- */
  y = ensureSpace(doc, y, 56);
  y = drawSectionLabel(doc, y, "Parties");

  const partyColW = (CONTENT_W - 12) / 2;
  const partyAX = MARGIN_X;
  const partyBX = MARGIN_X + partyColW + 12;

  // Subtle column separator
  doc.setDrawColor(...BORDER_SOFT);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X + partyColW + 6, y - 2, MARGIN_X + partyColW + 6, y + 30);

  // Party A — Provider
  const partyBaselineY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  doc.text("PROVIDER", partyAX, partyBaselineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(BRAND.legalName, partyAX, partyBaselineY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(BRAND.tagline.replace("  ·  ", " · "), partyAX, partyBaselineY + 11);
  doc.text(BRAND.email, partyAX, partyBaselineY + 16);
  doc.text(BRAND.phone, partyAX, partyBaselineY + 21);

  // Party B — Client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUBTLE);
  doc.text("CLIENT", partyBX, partyBaselineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(clientName, partyBX, partyBaselineY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  let py = partyBaselineY + 11;
  if (contactPerson) { doc.text(`Attn: ${contactPerson}`, partyBX, py); py += 5; }
  if (clientEmail) { doc.text(clientEmail, partyBX, py); py += 5; }
  if (clientPhone) { doc.text(clientPhone, partyBX, py); py += 5; }

  y = partyBaselineY + 32;

  /* ---------- Scope of work ---------- */
  if (services.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionLabel(doc, y, "Scope of work");

    if (contract.proposal?.packageName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);
      doc.text(contract.proposal.packageName, MARGIN_X, y);
      y += 6;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const svc of services) {
      const lines = doc.splitTextToSize(svc, CONTENT_W - 8) as string[];
      const rowH = lines.length * 5 + 1;
      y = ensureSpace(doc, y, rowH);

      // Square bullet (distinct from proposal's numbered list)
      doc.setFillColor(...TEXT);
      doc.rect(MARGIN_X + 0.5, y - 2.3, 1.6, 1.6, "F");

      doc.setTextColor(...TEXT);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN_X + 6, y + li * 5);
      }
      y += rowH;
    }

    if (contract.proposal?.timeline) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...SUBTLE);
      doc.text("TIMELINE", MARGIN_X, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);
      const tLines = doc.splitTextToSize(contract.proposal.timeline, CONTENT_W) as string[];
      for (const line of tLines) { doc.text(line, MARGIN_X, y); y += 5; }
    }

    y += 8;
  }

  /* ---------- Contract value ---------- */
  y = ensureSpace(doc, y, 26);
  y += 2;
  drawDivider(doc, y);
  y += 8;

  const totalLabelX = PAGE_W - MARGIN_X - 60;
  const totalValX = PAGE_W - MARGIN_X;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text("Contract value", totalLabelX, y);

  doc.setFontSize(14);
  doc.setTextColor(...ACCENT);
  doc.text(formatMoney(contract.amount, contract.currency), totalValX, y, { align: "right" });

  y += 16;

  /* ---------- Payment terms ---------- */
  if (contract.paymentTerms) {
    y = ensureSpace(doc, y, 16);
    y = drawSectionLabel(doc, y, "Payment terms");
    y = drawTextBlock(doc, y, contract.paymentTerms);
    y += 6;
  }

  /* ---------- Terms of Agreement (ARTICLE-numbered clauses) ---------- */
  y = ensureSpace(doc, y, 30);
  y = drawSectionLabel(doc, y, "Terms of agreement");

  const ctx: ClauseContext = { provider: BRAND.legalName, client: clientName };

  for (let i = 0; i < CLAUSES.length; i++) {
    const clause = CLAUSES[i];
    const roman = ROMAN[i] || String(i + 1);

    // Heading
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT);
    doc.text(`ARTICLE ${roman}.  ${clause.heading.toUpperCase()}`, MARGIN_X, y);
    y += 5;

    // Body
    y = drawTextBlock(doc, y, clause.body(ctx), { size: 9.5, color: MUTED });
    y += 2;
  }

  /* ---------- Additional notes ---------- */
  if (contract.notes) {
    y = ensureSpace(doc, y, 16);
    y += 4;
    y = drawSectionLabel(doc, y, "Additional notes");
    y = drawTextBlock(doc, y, contract.notes);
    y += 4;
  }

  /* ---------- Electronic signature callout (if signed) ---------- */
  y += 4;
  if (isSigned && (contract.signedByName || contract.signedAt)) {
    y = ensureSpace(doc, y, 24);
    // Soft callout: thin border, no fill
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, 16, 1.5, 1.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUBTLE);
    doc.text("SIGNED ELECTRONICALLY", MARGIN_X + 4, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const signedLine = [
      contract.signedByName,
      contract.signedByEmail,
      contract.signedAt ? `on ${formatDate(contract.signedAt)}` : null,
      contract.signatureIp ? `IP ${contract.signatureIp}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(signedLine || "—", MARGIN_X + 4, y + 11.5);

    y += 22;
  }

  /* ---------- Acknowledgement & Signatures ---------- */
  y = ensureSpace(doc, y, 32);
  y = drawSectionLabel(doc, y, "Acknowledgement");
  y += 2;

  y = drawSignatureBlock(
    doc,
    y,
    { label: "For " + BRAND.legalName, name: contract.createdByName || null, subline: "Authorized signatory" },
    {
      label: "For the Client",
      name: isSigned && contract.signedByName ? contract.signedByName : null,
      subline: clientName,
    }
  );

  applyFooters(doc, "Confidential  ·  For the parties above only.");

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `${ref}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
