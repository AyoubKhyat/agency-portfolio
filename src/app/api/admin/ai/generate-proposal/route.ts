import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateFromTemplate, detectServiceType } from "@/lib/proposal-templates";
import { z } from "zod";

const requestSchema = z.object({
  prospectName: z.string().min(1, "Prospect name is required"),
  sector: z.string().min(1, "Sector is required"),
  services: z.string().min(1, "Services is required"),
  budget: z.string().optional(),
  notes: z.string().optional(),
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Call an AI model using the OpenAI-compatible API format.
 * Supports both OpenAI and Anthropic (via OpenAI-compatible endpoint).
 */
async function generateWithAI(input: {
  prospectName: string;
  sector: string;
  services: string;
  budget?: string;
  notes?: string;
}): Promise<{
  packageName: string;
  services: string;
  timeline: string;
  paymentTerms: string;
  notes: string;
} | null> {
  const serviceType = detectServiceType(input.services);

  const systemPrompt = `Tu es un expert en propositions commerciales pour une agence web au Maroc appelée "Ibda3 Digital", basée à Marrakech. Tu rédiges des propositions professionnelles en français.

L'agence propose : sites vitrines, e-commerce, applications mobiles, SEO, maintenance, branding, chatbots IA, automatisation WhatsApp, applications web sur mesure, design réseaux sociaux.

Contact WhatsApp : +212 625 461 645

Tu dois répondre UNIQUEMENT avec un JSON valide (pas de markdown, pas de commentaires) avec cette structure exacte :
{
  "packageName": "Nom du package proposé",
  "services": "Description détaillée des services inclus",
  "timeline": "Délai de réalisation estimé",
  "paymentTerms": "Conditions de paiement",
  "notes": "Texte complet de la proposition (introduction personnalisée, prestations, proposition de valeur, appel à l'action)"
}`;

  const userPrompt = `Génère une proposition commerciale pour :
- Client : ${input.prospectName}
- Secteur : ${input.sector}
- Services demandés : ${input.services}
- Type de service principal : ${serviceType}
${input.budget ? `- Budget indicatif : ${input.budget} MAD` : ""}
${input.notes ? `- Notes complémentaires : ${input.notes}` : ""}

La proposition doit être professionnelle, personnalisée au secteur du client, et rédigée en français.`;

  try {
    let apiUrl: string;
    let headers: Record<string, string>;
    let model: string;

    if (OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      };
      model = "gpt-4o-mini";
    } else if (ANTHROPIC_API_KEY) {
      // Use Anthropic's OpenAI-compatible endpoint
      apiUrl = "https://api.anthropic.com/v1/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      };
      model = "claude-sonnet-4-20250514";
    } else {
      return null;
    }

    let response: Response;
    let resultText: string;

    if (OPENAI_API_KEY) {
      response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        console.error("[ai/generate-proposal] OpenAI error:", response.status, await response.text());
        return null;
      }

      const data = await response.json();
      resultText = data.choices?.[0]?.message?.content || "";
    } else {
      // Anthropic native API
      response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        console.error("[ai/generate-proposal] Anthropic error:", response.status, await response.text());
        return null;
      }

      const data = await response.json();
      resultText = data.content?.[0]?.text || "";
    }

    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[ai/generate-proposal] No JSON found in AI response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      packageName: parsed.packageName || "",
      services: parsed.services || input.services,
      timeline: parsed.timeline || "",
      paymentTerms: parsed.paymentTerms || "",
      notes: parsed.notes || "",
    };
  } catch (err) {
    console.error("[ai/generate-proposal] AI generation failed:", err);
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msgs = Object.entries(flat.fieldErrors).map(
      ([k, v]) => `${k}: ${(v as string[]).join(", ")}`
    );
    return NextResponse.json(
      { error: msgs.join("; ") || "Invalid input" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const hasAI = !!(OPENAI_API_KEY || ANTHROPIC_API_KEY);

  // Try AI generation first, fall back to templates
  let result: {
    packageName: string;
    services: string;
    timeline: string;
    paymentTerms: string;
    notes: string;
  };

  if (hasAI) {
    const aiResult = await generateWithAI(input);
    if (aiResult) {
      return NextResponse.json({ ...aiResult, source: "ai" });
    }
    // AI failed, fall back to templates
    console.warn("[ai/generate-proposal] AI failed, falling back to templates");
  }

  result = generateFromTemplate(input);
  return NextResponse.json({ ...result, source: "template" });
}
