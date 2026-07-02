import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getAiProvider } from "@/lib/ai";

const schema = z.object({
  discoveryResultId: z.string().min(1),
  channel: z.enum(["email", "whatsapp"]),
});

/**
 * Preview endpoint — returns the outreach draft for a discovery result.
 * Uses the persisted draft if present, otherwise regenerates via the AI
 * provider (which itself falls back to Mock on error).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const result = await prisma.discoveryResult.findUnique({
    where: { id: parsed.data.discoveryResultId },
    select: {
      name: true, sector: true, city: true, country: true,
      suggestedOffer: true, emailSubject: true, emailBody: true, whatsappBody: true,
      emailValid: true, whatsappValid: true,
    },
  });
  if (!result) return NextResponse.json({ error: "Discovery result not found" }, { status: 404 });

  if (parsed.data.channel === "email") {
    if (result.emailSubject && result.emailBody) {
      return NextResponse.json({ channel: "email", subject: result.emailSubject, body: result.emailBody });
    }
    const provider = getAiProvider();
    const language: "fr" | "en" = result.country === "France" || result.country === "Monaco" || result.country === "Belgium" ? "fr" : "en";
    const draft = await provider.generateOutreachEmail({
      businessName: result.name,
      sector: result.sector,
      city: result.city,
      country: result.country,
      language,
      suggestedOffer: result.suggestedOffer,
    });
    await prisma.discoveryResult.update({
      where: { id: parsed.data.discoveryResultId },
      data: { emailSubject: draft.subject, emailBody: draft.body },
    });
    return NextResponse.json({ channel: "email", subject: draft.subject, body: draft.body });
  }

  // WhatsApp
  if (result.whatsappBody) {
    return NextResponse.json({ channel: "whatsapp", body: result.whatsappBody });
  }
  const provider = getAiProvider();
  const language: "fr" | "en" = result.country === "France" || result.country === "Monaco" || result.country === "Belgium" ? "fr" : "en";
  const draft = await provider.generateOutreachWhatsApp({
    businessName: result.name,
    sector: result.sector,
    city: result.city,
    country: result.country,
    language,
    suggestedOffer: result.suggestedOffer,
  });
  await prisma.discoveryResult.update({
    where: { id: parsed.data.discoveryResultId },
    data: { whatsappBody: draft },
  });
  return NextResponse.json({ channel: "whatsapp", body: draft });
}
