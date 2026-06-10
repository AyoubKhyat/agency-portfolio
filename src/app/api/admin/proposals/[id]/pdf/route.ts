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
 * Proposal PDF — commercial offer
 * Distinct character vs. Invoice:
 *  - Title "Proposal"
 *  - PREPARED ON / VALID UNTIL (not Issue / Due)
 *  - "Prepared for" header (not "Bill to")
 *  - Scope as numbered list (not a financial table)
 *  - Single "Investment" amount (no Subtotal/VAT split)
 *  - "What happens next" — light commercial CTA section
 *  - Footer: "Looking forward to working with you."
 * ============================================================ */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      prospect: { select: { id: true, name: true, sector: true, phone: true, neighborhood: true, instagram: true } },
      client: { select: { id: true, companyName: true, contactPerson: true, phone: true, email: true } },
    },
  });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  // --- Resolved fields ---
  const clientName = proposal.client?.companyName || proposal.prospect?.name || "—";
  const contactPerson = proposal.contactPerson || proposal.client?.contactPerson || "";
  const clientPhone = proposal.client?.phone || proposal.prospect?.phone || "";
  const clientEmail = proposal.client?.email || "";
  const clientSector = proposal.prospect?.sector || "";
  const ref = `PROP-${proposal.id.substring(0, 8).toUpperCase()}`;
  const validUntil = new Date(new Date(proposal.createdAt).getTime() + 30 * 86_400_000);

  const services = proposal.services
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
  doc.text("Proposal", MARGIN_X, titleBaselineY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`#${ref}`, MARGIN_X, titleBaselineY + 7);

  // Right meta
  const metaY = y;
  drawMetaPair(doc, metaY, rightX, "Prepared on", formatDate(proposal.createdAt));
  drawMetaPair(doc, metaY + 11, rightX, "Valid until", formatDate(validUntil));
  drawStatusPill(doc, rightX, metaY + 22 + 4, proposal.status);

  y = titleBaselineY + 18;

  /* ---------- Prepared for ---------- */
  y = ensureSpace(doc, y, 36);
  y = drawSectionLabel(doc, y, "Prepared for");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(clientName, MARGIN_X, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  if (contactPerson) { doc.text(`Attn: ${contactPerson}`, MARGIN_X, y); y += 4.5; }
  if (clientEmail) { doc.text(clientEmail, MARGIN_X, y); y += 4.5; }
  if (clientPhone) { doc.text(clientPhone, MARGIN_X, y); y += 4.5; }
  if (clientSector) { doc.text(`Sector: ${clientSector}`, MARGIN_X, y); y += 4.5; }

  y += 12;

  /* ---------- Package callout (if present) ---------- */
  if (proposal.packageName) {
    y = ensureSpace(doc, y, 18);
    y = drawSectionLabel(doc, y, "Package");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(proposal.packageName, MARGIN_X, y);
    y += 10;
  }

  /* ---------- Scope of services (numbered list) ---------- */
  if (services.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionLabel(doc, y, "Scope of services");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    for (let i = 0; i < services.length; i++) {
      const text = services[i];
      const lines = doc.splitTextToSize(text, CONTENT_W - 12) as string[];
      const rowH = Math.max(7, lines.length * 5 + 1);
      y = ensureSpace(doc, y, rowH);

      // Number column
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...SUBTLE);
      doc.text(String(i + 1).padStart(2, "0"), MARGIN_X, y);

      // Service text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...TEXT);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN_X + 10, y + li * 5);
      }
      y += rowH + 1;
    }
    y += 6;
  }

  /* ---------- Timeline ---------- */
  if (proposal.timeline) {
    y = ensureSpace(doc, y, 20);
    y = drawSectionLabel(doc, y, "Timeline");
    y = drawTextBlock(doc, y, proposal.timeline);
    y += 4;
  }

  /* ---------- Payment terms ---------- */
  if (proposal.paymentTerms) {
    y = ensureSpace(doc, y, 20);
    y = drawSectionLabel(doc, y, "Payment terms");
    y = drawTextBlock(doc, y, proposal.paymentTerms);
    y += 4;
  }

  /* ---------- Investment (right-aligned single amount) ---------- */
  y = ensureSpace(doc, y, 30);
  y += 2;
  drawDivider(doc, y);
  y += 8;

  const totalLabelX = PAGE_W - MARGIN_X - 60;
  const totalValX = PAGE_W - MARGIN_X;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text("Total investment", totalLabelX, y);

  doc.setFontSize(14);
  doc.setTextColor(...ACCENT);
  doc.text(formatMoney(proposal.amount, proposal.currency), totalValX, y, { align: "right" });

  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUBTLE);
  doc.text("Pricing exclusive of applicable taxes.", totalValX, y, { align: "right" });

  y += 16;

  /* ---------- What happens next ---------- */
  y = ensureSpace(doc, y, 40);
  y = drawSectionLabel(doc, y, "What happens next");

  const steps = [
    { n: "01", title: "Accept this proposal", body: "Sign on the last page or reply to confirm." },
    { n: "02", title: "Kickoff & scope alignment", body: "We schedule a kickoff call within 3 business days." },
    { n: "03", title: "Project starts", body: "Deposit invoiced, work begins per the timeline above." },
  ];

  for (const step of steps) {
    y = ensureSpace(doc, y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...ACCENT);
    doc.text(step.n, MARGIN_X, y);

    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(step.title, MARGIN_X + 10, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(step.body, MARGIN_X + 10, y + 4.5);
    y += 12;
  }

  y += 4;

  /* ---------- Notes (if present) ---------- */
  if (proposal.notes) {
    y = ensureSpace(doc, y, 16);
    y = drawSectionLabel(doc, y, "Notes");
    y = drawTextBlock(doc, y, proposal.notes);
    y += 4;
  }

  /* ---------- Terms (compact) ---------- */
  y = ensureSpace(doc, y, 50);
  y = drawSectionLabel(doc, y, "Terms");

  const terms = [
    "This proposal is valid for 30 days from the prepared-on date.",
    "Prices are exclusive of applicable taxes unless otherwise stated.",
    "Work commences upon written acceptance and receipt of the agreed deposit.",
    "Client provides content, assets, and feedback in a timely manner.",
    "Scope changes after acceptance are quoted separately and require written approval.",
    `${BRAND.legalName} retains the right to showcase completed work in its portfolio.`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const t of terms) {
    const lines = doc.splitTextToSize(t, CONTENT_W - 8) as string[];
    y = ensureSpace(doc, y, lines.length * 4 + 1);
    doc.setTextColor(...SUBTLE);
    doc.text("·", MARGIN_X, y);
    doc.setTextColor(...MUTED);
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], MARGIN_X + 4, y + li * 4);
    }
    y += lines.length * 4 + 1.5;
  }

  y += 10;

  /* ---------- Signature ---------- */
  y = drawSignatureBlock(
    doc,
    y,
    { label: "For " + BRAND.legalName, name: proposal.createdByName, subline: "Authorized signatory" },
    { label: "Approved by", name: null, subline: clientName }
  );

  applyFooters(doc, "Looking forward to working with you.");

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
