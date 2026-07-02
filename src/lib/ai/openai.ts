/**
 * OpenAI adapter — Chat Completions with JSON response format.
 *
 * Uses fetch directly (no SDK dependency) so the module compiles even when
 * the `openai` package isn't installed. On any error it delegates to the
 * MockAiProvider — the UI never breaks.
 */

import { MockAiProvider } from "./mock";
import type {
  AiProvider, AuditInput, AuditOutput, EmailDraft, OutreachInput,
} from "./types";

const API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export class OpenAiProvider implements AiProvider {
  readonly name = "OPENAI" as const;
  readonly isReal = true;
  private fallback = new MockAiProvider();

  constructor(private apiKey: string) {}

  async generateAudit(input: AuditInput): Promise<AuditOutput> {
    try {
      const prompt = `You are a senior sales analyst at a premium web agency. Analyze this business and return strict JSON with keys aiSummary, suggestedOffer, websiteSummary, opportunityExplanation.

Business:
${JSON.stringify(input, null, 2)}`;
      const data = await this.call(prompt, true);
      const parsed = safeJson(data) as Partial<AuditOutput> | null;
      if (!parsed?.aiSummary || !parsed?.suggestedOffer) return this.fallback.generateAudit(input);
      return {
        aiSummary: String(parsed.aiSummary),
        suggestedOffer: String(parsed.suggestedOffer),
        websiteSummary: String(parsed.websiteSummary ?? ""),
        opportunityExplanation: String(parsed.opportunityExplanation ?? ""),
      };
    } catch (err) {
      console.warn("[ai/openai] audit fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateAudit(input);
    }
  }

  async generateOutreachEmail(input: OutreachInput): Promise<EmailDraft> {
    try {
      const prompt = `Write a personalized outreach email in ${input.language === "fr" ? "French" : "English"} for the business below. Return strict JSON: { "subject": "...", "body": "..." }. The body should be 4 short paragraphs and end with a sign-off "Ayoub Khyat / Ibda3 Digital / https://ibda3-digital.vercel.app".

Business:
${JSON.stringify(input, null, 2)}`;
      const data = await this.call(prompt, true);
      const parsed = safeJson(data) as Partial<EmailDraft> | null;
      if (!parsed?.subject || !parsed?.body) return this.fallback.generateOutreachEmail(input);
      return { subject: String(parsed.subject), body: String(parsed.body) };
    } catch (err) {
      console.warn("[ai/openai] email fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateOutreachEmail(input);
    }
  }

  async generateOutreachWhatsApp(input: OutreachInput): Promise<string> {
    try {
      const prompt = `Write a short WhatsApp opener (2-3 sentences) in ${input.language === "fr" ? "French" : "English"} for the business below. Include https://ibda3-digital.vercel.app at the end. Return ONLY the message text.

Business:
${JSON.stringify(input, null, 2)}`;
      const text = await this.call(prompt, false);
      if (!text.trim()) return this.fallback.generateOutreachWhatsApp(input);
      return text.trim();
    } catch (err) {
      console.warn("[ai/openai] whatsapp fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateOutreachWhatsApp(input);
    }
  }

  private async call(prompt: string, jsonMode: boolean): Promise<string> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

function safeJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
