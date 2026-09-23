import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getAnthropic, SALES_AI_MODEL, MissingApiKeyError } from "@/lib/anthropic";

/**
 * "Quick audit" generator.
 *
 * IMPORTANT — evidence discipline. Nothing in this system has visited the
 * prospect's website, opened their Instagram, or tested their booking flow.
 * The only inputs are the handful of fields stored on the Prospect row. An
 * earlier version of this prompt instructed the model to "base findings on
 * what's typical for this sector" and to "make every observation feel
 * observed", which produced confident, invented claims that could then be
 * sent to real business owners. That was a defect, not a feature.
 *
 * The contract is now structural rather than a matter of prompt tone:
 *   - `knownFacts` is built HERE, deterministically, from stored columns.
 *     The model never contributes to it.
 *   - The model may only produce HYPOTHESES, each carrying a `how_to_verify`
 *     step, and may never phrase one as an observation.
 *
 * When the real evidence engine lands (Phase 2), `knownFacts` becomes the
 * ProspectEvidence rows and hypotheses become the fallback, not the headline.
 */

const bodySchema = z.object({
  language: z.enum(["fr", "en", "ar"]).default("fr"),
});

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    hypotheses: {
      type: "array" as const,
      description:
        "Up to 3 UNVERIFIED hypotheses worth checking, ordered most-to-least likely to matter for this sector.",
      items: {
        type: "object" as const,
        properties: {
          hypothesis: {
            type: "string" as const,
            description:
              "A possible gap, phrased explicitly as unverified (often / may / worth checking whether). NEVER phrased as something we saw. Plain text.",
          },
          why_it_matters: {
            type: "string" as const,
            description: "The commercial consequence if it turns out to be true. 1-2 sentences.",
          },
          how_to_verify: {
            type: "string" as const,
            description:
              "The concrete check a human should run before mentioning this to the prospect. 1 sentence.",
          },
          recommendation: {
            type: "string" as const,
            description: "A specific action, conditional on the hypothesis holding. 1-2 sentences.",
          },
        },
        required: ["hypothesis", "why_it_matters", "how_to_verify", "recommendation"],
        additionalProperties: false,
      },
    },
    conversation_opener: {
      type: "string" as const,
      description:
        "A short message (40-80 words) the salesperson can send. It may reference ONLY the known facts listed in the prompt, and must ask a question rather than assert anything about their digital presence. Plain text.",
    },
    evidence_gap: {
      type: "string" as const,
      description:
        "One sentence naming what we would need to actually look at before any hypothesis could be stated as fact. Internal note — not sent to the prospect.",
    },
  },
  required: ["hypotheses", "conversation_opener", "evidence_gap"],
  additionalProperties: false,
};

export type ProspectAuditFacts = {
  name: string;
  sector: string;
  neighborhood: string | null;
  instagram: string | null;
  hasWebsite: boolean;
  website: string | null;
};

/**
 * Deterministic restatement of what we actually hold on this prospect.
 * Every entry is traceable to a stored column — no inference, no AI.
 */
export function buildKnownFacts(p: ProspectAuditFacts): string[] {
  const facts: string[] = [`Business name on file: ${p.name}`];
  facts.push(`Sector recorded as: ${p.sector}`);
  facts.push(`Location recorded as: ${p.neighborhood || "Marrakech (not more specific)"}`);

  const url = (p.website || "").trim();
  if (url) facts.push(`A website URL is on file: ${url} (contents NOT inspected)`);
  else if (p.hasWebsite) facts.push("Flagged as having a website, but no URL is stored (contents NOT inspected)");
  else facts.push("No website URL on file (means none recorded by us — not that none exists)");

  const ig = (p.instagram || "").trim();
  if (ig) facts.push(`An Instagram handle is on file: @${ig.replace(/^@/, "")} (account NOT inspected)`);
  else facts.push("No Instagram handle on file");

  return facts;
}

export function buildSystemPrompt(language: string): string {
  const langName = language === "fr" ? "French" : language === "ar" ? "Arabic" : "English";
  return `You are an experienced digital consultant at Ibda3 Digital, a web agency in Marrakech.
The sales team uses your output to decide what to CHECK before starting a conversation — not as a finished audit to forward to the prospect.

CRITICAL CONSTRAINT — read this twice:
You have NOT seen this business's website, Instagram, Google listing, booking flow, or any of their content. Nobody has. The only information that exists is the short list of KNOWN FACTS in the user message, which came from our own database.

Therefore:
1. You MUST NOT state anything about their website design, speed, structure, photos, copy, menu, prices, booking process, reviews, or Instagram content. You have no basis for any such claim.
2. Everything you produce is a HYPOTHESIS about what MIGHT be true for this kind of business. Phrase it that way, explicitly and every time.
3. Every hypothesis must include a concrete verification step a human can perform in under two minutes.
4. Do NOT invent detail to make a hypothesis sound researched. A plainly hedged hypothesis is correct output. A vivid, specific-sounding fabrication is a failure, even if it happens to be true.
5. If the known facts are too thin to support three distinct sector-relevant hypotheses, say so in evidence_gap and produce fewer rather than padding with invented specifics.
6. The conversation_opener may reference ONLY the known facts. It must not assert or imply that we looked at their site or feed. Asking a question is fine; claiming an observation is not.
7. Do NOT pitch Ibda3 Digital's services.
8. Write everything in ${langName}. Plain prose, no markdown, no bullets inside text fields.

Output JSON matching the schema.`;
}

export function buildUserPrompt(knownFacts: string[]): string {
  return [
    "KNOWN FACTS (the complete set of what we actually hold — nothing else has been checked):",
    ...knownFacts.map((f) => `- ${f}`),
    "",
    "NOT AVAILABLE: their website contents, page speed, mobile behaviour, booking or quote flow, Instagram posts, Google reviews, opening hours, pricing.",
    "",
    "Produce up to 3 sector-relevant hypotheses worth verifying, each with a verification step, plus a conversation opener grounded only in the known facts above.",
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
    select: {
      name: true, sector: true, neighborhood: true, instagram: true,
      hasWebsite: true, website: true,
    },
  });
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const knownFacts = buildKnownFacts(prospect);

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
      messages: [{ role: "user", content: buildUserPrompt(knownFacts) }],
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
      audit: {
        // Ours, deterministic, never model-authored.
        knownFacts,
        // Model-authored, explicitly unverified.
        hypotheses: parsedOutput.hypotheses ?? [],
        conversation_opener: parsedOutput.conversation_opener ?? "",
        evidence_gap: parsedOutput.evidence_gap ?? "",
        evidenceLevel: "NONE_COLLECTED" as const,
      },
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
