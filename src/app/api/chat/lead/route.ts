import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LeadSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
  }
  const { fullName, email, phone, message, conversationId } = parsed.data;

  const client = prisma;
  if (!client) {
    // No DB — still return 202 so the user gets a friendly UX; log for ops
    console.warn("[chat/lead] no DB — lead not persisted", { email, fullName });
    return NextResponse.json({ ok: true, persisted: false });
  }

  try {
    const lead = await client.lead.create({
      data: {
        fullName,
        email,
        phone: phone ?? null,
        subject: "Chatbot inquiry",
        message,
        status: "NEW",
      },
    });

    // link to conversation if provided
    if (conversationId) {
      try {
        await client.chatConversation.update({
          where: { id: conversationId },
          data: { leadId: lead.id },
        });
      } catch (err) {
        console.warn("[chat/lead] could not link conversation", err);
      }
    }

    return NextResponse.json({ ok: true, persisted: true, leadId: lead.id });
  } catch (err) {
    console.error("[chat/lead] DB error", err);
    return NextResponse.json({ error: "Could not save lead" }, { status: 500 });
  }
}
