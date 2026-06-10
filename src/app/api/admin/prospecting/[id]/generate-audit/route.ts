import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getAnthropic, SALES_AI_MODEL, MissingApiKeyError } from "@/lib/anthropic";

const bodySchema = z.object({
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    recommendations: {
      type: "array" as const,
      description: "Exactly 3 audit findings, ordered most-to-least impactful.",
      items: {
        type: "object" as const,
        properties: {
          observation: { type: "string" as const, description: "A specific, concrete thing you observed about this business. Plain text." },
          opportunity: { type: "string" as const, description: "Why this matters — what they're missing out on. 1-2 sentences." },
          recommendation: { type: "string" as const, description: "A specific actionable suggestion (not a sales pitch). 1-2 sentences." },
        },
        required: ["observation", "opportunity", "recommendation"],
        additionalProperties: false,
      },
    },
    conversation_opener: {
      type: "string" as const,
      description: "A short message (40-80 words) the salesperson can send WITH the audit. Should reference one of the recommendations and ask a low-friction question. Plain text.",
    },
  },
  required: ["recommendations", "conversation_opener"],
  additionalProperties: false,
};

function buildSystemPrompt(language: string): string {
  const langName = language === "fr" ? "French" : language === "ar" ? "Arabic" : "English";
  return `You are an experienced digital marketing consultant at Ibda3 Digital, a web agency in Marrakech.
The sales team uses your audits to start conversations with prospects — NOT to immediately sell.

Your job: spot 3 concrete things this specific business could improve in their digital presence, and explain each in a way that sounds like genuine expert observation, not sales copy.

Structure each finding as:
- Observation: a specific, factual thing you noticed (or would notice if you looked at their digital presence). Be concrete and credible.
- Opportunity: what they're losing or missing because of this — in plain business terms, not jargon.
- Recommendation: one specific action (a "weekly content calendar", "Google Business Profile claim", "lead-capture form") — NOT "you need a website" or "hire us".

Strict rules:
1. Findings must be SPECIFIC to this sector and business profile, not generic ("improve your SEO" is generic, "your Instagram bio doesn't include WhatsApp link or location" is specific).
2. Do NOT pitch Ibda3 Digital's services directly. Your value to the salesperson is that the audit feels like a free expert opinion.
3. Ordered most-to-least impactful for THIS sector.
4. The conversation_opener is the message the salesperson will send WITH this audit attached. It should feel helpful, not promotional. Reference one observation and ask a question.
5. Write everything in ${langName}.
6. No markdown. No bullet points inside text fields. Plain prose only.

Output JSON matching the schema.`;
}

function buildUserPrompt(args: {
  name: string;
  sector: string;
  city: string;
  hasWebsite: boolean;
  instagram: string | null;
}): string {
  return [
    `Audit target: ${args.name}`,
    `Sector: ${args.sector}`,
    `City / neighborhood: ${args.city}`,
    `Has a website: ${args.hasWebsite ? "yes" : "no"}`,
    `Instagram: ${args.instagram || "none / unknown"}`,
    "",
    "Generate 3 specific recommendations and a conversation opener per the schema.",
    "If you don't have direct access to their actual online presence, base findings on what's typical for this sector in Marrakech and what would credibly apply.",
    "Make every observation feel observed, not generic.",
  ].join("\n");
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
    select: { name: true, sector: true, neighborhood: true, instagram: true, hasWebsite: true },
  });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

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
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA }, effort: "high" },
      system: buildSystemPrompt(parsed.data.language),
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            name: prospect.name,
            sector: prospect.sector,
            city: prospect.neighborhood || "Marrakech",
            hasWebsite: prospect.hasWebsite,
            instagram: prospect.instagram || null,
          }),
        },
      ],
    });

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
      audit: parsedOutput,
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
