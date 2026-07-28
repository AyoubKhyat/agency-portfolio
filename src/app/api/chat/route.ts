import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chat, type ChatMessage } from "@/lib/chat/llm";
import { check, hashIp } from "@/lib/chat/rate-limit";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/chat/knowledge-base";

export const runtime = "nodejs";

const RequestSchema = z.object({
  locale: z.enum(["en", "fr", "ar"]).default("en"),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(30)
    .default([]),
});

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
  }
  const { locale, conversationId, message, history } = parsed.data;

  // rate limit
  const ipHash = hashIp(getClientIp(req));
  const rl = check(ipHash);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit reached. Please try again later.", resetAt: rl.resetAt },
      { status: 429 }
    );
  }

  // check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  // call the LLM
  let reply = "";
  let usage = { inputTokens: 0, outputTokens: 0 };
  try {
    const result = await chat({ locale: locale as Locale, history: history as ChatMessage[], userMessage: message });
    reply = result.reply;
    usage = result.usage;
  } catch (err) {
    console.error("[chat] LLM error", err);
    return NextResponse.json({ error: "The assistant is unavailable right now. Please try again." }, { status: 502 });
  }

  // persist conversation (best-effort — don't block reply on DB errors)
  let savedConvId: string | undefined = conversationId;
  try {
    const client = prisma;
    if (client) {
      const messagesToSave = [
        ...history,
        { role: "user", content: message, ts: new Date().toISOString() },
        { role: "assistant", content: reply, ts: new Date().toISOString() },
      ];
      if (conversationId) {
        await client.chatConversation.update({
          where: { id: conversationId },
          data: { messages: messagesToSave as unknown as object, locale, ipHash },
        });
      } else {
        const created = await client.chatConversation.create({
          data: { messages: messagesToSave as unknown as object, locale, ipHash },
        });
        savedConvId = created.id;
      }
    }
  } catch (err) {
    console.warn("[chat] conversation persist skipped", err);
  }

  return NextResponse.json({
    reply,
    conversationId: savedConvId,
    remaining: rl.remaining,
    usage,
  });
}
