import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getAnthropic, SALES_AI_MODEL, MissingApiKeyError } from "@/lib/anthropic";

const TONES = ["PROFESSIONAL", "FRIENDLY", "DIRECT", "DARIJA_LIGHT", "FRENCH_BUSINESS", "ENGLISH"] as const;
const OBJECTIVES = ["GET_REPLY", "BOOK_MEETING", "SEND_AUDIT", "RECONNECT", "FOLLOW_UP"] as const;
const FEEDBACKS = ["TOO_GENERIC", "TOO_LONG", "TOO_SALESY", "MAKE_WARMER", "MAKE_SHORTER"] as const;

const bodySchema = z.object({
  language: z.enum(["fr", "en", "ar"]).default("fr"),
  tone: z.enum(TONES).default("FRIENDLY"),
  objective: z.enum(OBJECTIVES).default("GET_REPLY"),
  feedback: z.enum(FEEDBACKS).nullable().optional(),
  previousAttempt: z.string().nullable().optional(),
});

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    whatsapp_short: { type: "string" as const, description: "30-50 words, direct, opens a conversation. Plain text, no markdown." },
    whatsapp_long: { type: "string" as const, description: "80-120 words, includes one specific observation about the business. Plain text, no markdown." },
    instagram_short: { type: "string" as const, description: "30-50 words, casual tone, lower formality than WhatsApp. Plain text." },
    instagram_long: { type: "string" as const, description: "80-120 words, references their Instagram presence specifically. Plain text." },
    rationale: { type: "string" as const, description: "1-2 sentences: what specific signal you used to personalize this." },
  },
  required: ["whatsapp_short", "whatsapp_long", "instagram_short", "instagram_long", "rationale"],
  additionalProperties: false,
};

const TONE_GUIDE: Record<string, string> = {
  PROFESSIONAL: "Formal, polite, business-appropriate. Vouvoiement in French.",
  FRIENDLY: "Warm, conversational, first-name basis where appropriate. Approachable but not casual.",
  DIRECT: "Short sentences, no fluff, no preamble. Get to the point in the first line.",
  DARIJA_LIGHT: "French base with 1-2 natural Darija touches (salam, labas, mzyan, wakha, inshallah). NOT full Darija — French with local flavor.",
  FRENCH_BUSINESS: "Strict French business etiquette: Vouvoiement, full sentences, formal closings.",
  ENGLISH: "Native English business tone. Concise, polite, professional.",
};

const OBJECTIVE_GUIDE: Record<string, string> = {
  GET_REPLY: "End with a low-friction question they can answer in one sentence. Make it easy to say yes/no. NO meeting ask, NO pitch.",
  BOOK_MEETING: "Propose ONE specific meeting window (e.g., '15 minutes cette semaine?' or 'a quick 10-min call Thursday?'). Make it concrete and low-commitment.",
  SEND_AUDIT: "Tease 1-2 audit observations about their digital presence and offer to share a short audit. Make it feel like value, not a pitch.",
  RECONNECT: "Acknowledge time since last contact gracefully — no pressure, no guilt. Soft re-open with a new angle or reason to reconnect now.",
  FOLLOW_UP: "Reference the previous message briefly and add ONE new angle (a question, an insight, an example). Don't repeat the original pitch.",
};

function buildSystemPrompt(language: string, tone: string, objective: string, isRegeneration: boolean): string {
  const langName = language === "fr" ? "French" : language === "ar" ? "Arabic" : "English";
  return `You write outbound sales messages for Ibda3 Digital, a web development agency in Marrakech, Morocco.
You are messaging local business owners to start a conversation — NOT to immediately pitch a website.

Strict rules:
1. NEVER sound generic. If your message would work for any business in any sector, rewrite it.
2. NEVER pitch a website, automation, CRM, or any service in the first message. The goal is to start dialogue.
3. ALWAYS reference one specific, observable thing about THIS business (sector, neighborhood, Instagram, missing website).
4. Maximum 120 words per long variant. Short variants 30-50 words.
5. Write in ${langName}.
6. No emoji spam — max 1 emoji if natural.
7. Do not use placeholders like {{name}} — write the actual business name from the prospect data.
8. ALWAYS write out the business name verbatim somewhere in the message.

TONE: ${tone}
${TONE_GUIDE[tone] || ""}

OBJECTIVE: ${objective}
${OBJECTIVE_GUIDE[objective] || ""}

${isRegeneration ? "This is a REGENERATION based on user feedback. Address the feedback directly — do not just paraphrase the prior attempt. Keep the personalization signals but change the angle." : ""}

Output JSON matching the schema. Plain text in every field — no markdown, no asterisks, no headers.`;
}

const FEEDBACK_INSTRUCTIONS: Record<string, string> = {
  TOO_GENERIC: "Previous attempt was TOO GENERIC. Add at least 2 specific references to this business's sector, neighborhood, or social presence. Show you actually looked at them.",
  TOO_LONG: "Previous attempt was TOO LONG. Cut every variant to under 60 words. Be ruthless. One observation + one question.",
  TOO_SALESY: "Previous attempt was TOO SALESY. Remove any pitch language. Open with curiosity, not capability. Don't mention services.",
  MAKE_WARMER: "Previous attempt was TOO COLD. Add warmth: a small compliment about something specific, an acknowledgment of their work, a more conversational opener. Avoid corporate phrases.",
  MAKE_SHORTER: "Previous attempt was VERBOSE. Cut 40% of the word count across all variants. Tighten every sentence.",
};

function buildUserPrompt(args: {
  name: string;
  sector: string;
  city: string;
  hasWebsite: boolean;
  website: string | null;
  instagram: string | null;
  followUpStage: string;
  previousMessages: string[];
  feedback: string | null;
  previousAttempt: string | null;
}): string {
  const lines = [
    `Business: ${args.name}`,
    `Sector: ${args.sector}`,
    `City / neighborhood: ${args.city}`,
    `Has a website: ${args.hasWebsite ? `yes (${args.website || "URL unknown"})` : "no"}`,
    `Instagram: ${args.instagram || "none / unknown"}`,
    `Stage in sequence: ${args.followUpStage}`,
  ];

  if (args.previousMessages.length > 0) {
    lines.push("");
    lines.push("Previous messages we sent to this prospect (oldest first):");
    args.previousMessages.forEach((m, i) => lines.push(`[${i + 1}] ${m}`));
    lines.push("");
    lines.push("Reference what we already said — don't repeat the same opener. If this is a follow-up, acknowledge our previous outreach lightly.");
  }

  if (args.feedback && args.previousAttempt) {
    lines.push("");
    lines.push("=== REGENERATION CONTEXT ===");
    lines.push("Previous AI attempt the user rejected:");
    lines.push(args.previousAttempt);
    lines.push("");
    lines.push("User feedback on that attempt:");
    lines.push(FEEDBACK_INSTRUCTIONS[args.feedback] || args.feedback);
  }

  lines.push("");
  lines.push("Generate 4 message variants per the schema. Each must reference something specific about this business — not generic agency copy.");

  return lines.join("\n");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    select: {
      name: true, sector: true, neighborhood: true, instagram: true, hasWebsite: true,
      sentAt: true, followup1At: true, followup2At: true, followup3At: true,
    },
  });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  // Determine follow-up stage
  let stage = "Initial contact (Day 1)";
  if (prospect.followup3At) stage = "After final follow-up (Day 20) — last chance";
  else if (prospect.followup2At) stage = "Day 20 — Final follow-up";
  else if (prospect.followup1At) stage = "Day 10 — Second follow-up";
  else if (prospect.sentAt) stage = "Day 4 — First follow-up";

  // Get last 3 outreach messages for context
  const recentMessages = await prisma.outreachMessage.findMany({
    where: { prospectId: id },
    orderBy: { sentAt: "desc" },
    take: 3,
    select: { body: true },
  });

  let client: Anthropic;
  try {
    client = getAnthropic();
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "AI not configured", message: "Add ANTHROPIC_API_KEY to Vercel environment variables." },
        { status: 503 }
      );
    }
    throw err;
  }

  try {
    const response = await client.messages.create({
      model: SALES_AI_MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA }, effort: "high" },
      system: buildSystemPrompt(
        parsed.data.language,
        parsed.data.tone,
        parsed.data.objective,
        !!parsed.data.feedback
      ),
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            name: prospect.name,
            sector: prospect.sector,
            city: prospect.neighborhood || "Marrakech",
            hasWebsite: prospect.hasWebsite,
            website: null,
            instagram: prospect.instagram || null,
            followUpStage: stage,
            previousMessages: recentMessages.map((m) => m.body).reverse(),
            feedback: parsed.data.feedback ?? null,
            previousAttempt: parsed.data.previousAttempt ?? null,
          }),
        },
      ],
    });

    // Extract the JSON text block — structured outputs return validated JSON in a text block
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({
      variants: parsedOutput,
      stage,
      tone: parsed.data.tone,
      objective: parsed.data.objective,
      regenerated: !!parsed.data.feedback,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "AI request failed", status: err.status, message: err.message },
        { status: 502 }
      );
    }
    throw err;
  }
}
