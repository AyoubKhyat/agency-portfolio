/**
 * Anthropic adapter — thin JSON-mode wrapper.
 *
 * On any error (missing key, network failure, malformed response), delegates
 * to the MockAiProvider so the UI never breaks. This is enforced here, not by
 * the factory, so every generator method has a guaranteed non-throwing path.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MockAiProvider } from "./mock";
import type {
  AiProvider, AuditInput, AuditOutput, EmailDraft, OutreachInput,
} from "./types";

const MODEL = "claude-opus-4-8";

export class AnthropicAiProvider implements AiProvider {
  readonly name = "ANTHROPIC" as const;
  readonly isReal = true;
  private client: Anthropic;
  private fallback = new MockAiProvider();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateAudit(input: AuditInput): Promise<AuditOutput> {
    try {
      const prompt = `You are a senior sales analyst at a premium web agency. Analyze this business and return a strict JSON object with keys: aiSummary (1 paragraph, 3-5 sentences), suggestedOffer (1 sentence pitch), websiteSummary (2-3 sentences on current website state or gap), opportunityExplanation (2-3 sentences on why to pursue).

Business:
${JSON.stringify(input, null, 2)}

Return ONLY the JSON — no prose, no code fences.`;
      const res = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text).join("");
      const parsed = extractJson(text) as Partial<AuditOutput> | null;
      if (!parsed?.aiSummary || !parsed.suggestedOffer) return this.fallback.generateAudit(input);
      return {
        aiSummary: String(parsed.aiSummary),
        suggestedOffer: String(parsed.suggestedOffer),
        websiteSummary: String(parsed.websiteSummary ?? ""),
        opportunityExplanation: String(parsed.opportunityExplanation ?? ""),
      };
    } catch (err) {
      console.warn("[ai/anthropic] audit fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateAudit(input);
    }
  }

  async generateOutreachEmail(input: OutreachInput): Promise<EmailDraft> {
    try {
      const prompt = `You are a senior sales writer at Ibda3 Digital, a premium web agency based in Marrakech. Write a personalized outreach email in ${input.language === "fr" ? "French" : "English"} for the business below. Return strict JSON: { "subject": "...", "body": "..." }. The body should be 4 short paragraphs and end with a sign-off "Ayoub Khyat / Ibda3 Digital / https://ibda3-digital.vercel.app".

Business:
${JSON.stringify(input, null, 2)}

Return ONLY the JSON.`;
      const res = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text).join("");
      const parsed = extractJson(text) as Partial<EmailDraft> | null;
      if (!parsed?.subject || !parsed?.body) return this.fallback.generateOutreachEmail(input);
      return { subject: String(parsed.subject), body: String(parsed.body) };
    } catch (err) {
      console.warn("[ai/anthropic] email fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateOutreachEmail(input);
    }
  }

  async generateOutreachWhatsApp(input: OutreachInput): Promise<string> {
    try {
      const prompt = `Write a short WhatsApp opener (2-3 sentences max) in ${input.language === "fr" ? "French" : "English"} for the business below. Casual but professional. Include the link https://ibda3-digital.vercel.app at the end. Return ONLY the message — no JSON, no quotes.

Business:
${JSON.stringify(input, null, 2)}`;
      const res = await this.client.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text).join("").trim();
      if (!text) return this.fallback.generateOutreachWhatsApp(input);
      return text;
    } catch (err) {
      console.warn("[ai/anthropic] whatsapp fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateOutreachWhatsApp(input);
    }
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
