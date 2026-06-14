import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { computeQualityLabel, isMobileMA } from "@/lib/prospect-quality";
import { scoreProspect } from "@/lib/prospect-scoring";
import { findDuplicateProspect } from "@/lib/dal";

/**
 * Minimal-fields prospect creator for the Outreach quick-add flow.
 * Requires name + at least one of (phone, instagram). Everything else is optional.
 * Auto-computes qualityLabel, score, whatsappLink so the new row appears in the
 * right bucket immediately and the action buttons render correctly.
 */
const schema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
}).refine((v) => !!(v.phone?.trim() || v.instagram?.trim()), {
  message: "At least one of phone or Instagram is required",
});

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (digits.startsWith("0")) return "+212" + digits.slice(1);
  if (!raw.startsWith("+")) return "+212" + digits;
  return "+" + digits;
}

function buildWhatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
}

function cleanInstagram(handle: string): string {
  return handle.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : "";
  const instagram = parsed.data.instagram ? cleanInstagram(parsed.data.instagram) : "";
  const whatsappLink = phone ? buildWhatsappLink(phone) : "";
  const website = parsed.data.website?.trim() || "";
  const email = parsed.data.email?.trim() || "";
  const sector = parsed.data.sector?.trim() || "Other";
  const neighborhood = parsed.data.neighborhood?.trim() || "";

  // Duplicate check
  if (phone || instagram) {
    const dup = await findDuplicateProspect(phone, instagram);
    if (dup) {
      return NextResponse.json(
        { error: "Duplicate prospect detected", duplicate: { id: dup.id, name: dup.name } },
        { status: 409 }
      );
    }
  }

  // Compute quality + score
  const signals = { phone, whatsapp: whatsappLink, instagram, website, email };
  const qualityLabel = computeQualityLabel(signals);
  const { score, label: scoreLabel } = scoreProspect({
    hasWebsite: !!website,
    instagram,
    whatsappLink,
    phone,
    email,
    website,
    sentAt: null,
    outreachReplies: 0,
    meetingsCompleted: 0,
    proposalCount: 0,
  });

  // Priority (matches existing legacy semantics): 3 = has site, 1 = IG-only, 2 = default
  const priority = website ? 3 : (instagram && !phone ? 1 : 2);

  const prospect = await prisma.prospect.create({
    data: {
      name: parsed.data.name.trim(),
      phone,
      whatsappLink,
      sector,
      neighborhood,
      instagram,
      hasWebsite: !!website,
      website,
      email,
      qualityLabel,
      status: "A_ENVOYER",
      priority,
      score,
      scoreLabel,
      scoredAt: new Date(),
      source: "MANUAL",
      ownerUserId: parsed.data.ownerUserId || null,
      lastActionAt: new Date(),
      lastActionByUserId: session.userId,
      lastActionByName: session.fullName,
    },
    select: { id: true, name: true, qualityLabel: true, score: true, phone: true, whatsappLink: true, instagram: true },
  });

  return NextResponse.json({
    prospect,
    actionable: isMobileMA(phone) || !!instagram,
  }, { status: 201 });
}
