/**
 * Gemini adapter — REST call, no SDK dependency.
 * On any error, delegates to MockAiProvider.
 */

import { MockAiProvider } from "./mock";
import type {
  AiProvider, AuditInput, AuditOutput, EmailDraft, OutreachInput,
} from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class GeminiAiProvider implements AiProvider {
  readonly name = "GEMINI" as const;
  readonly isReal = true;
  private fallback = new MockAiProvider();

  constructor(private apiKey: string) {}

  async generateAudit(input: AuditInput): Promise<AuditOutput> {
    try {
      const prompt = `You are a senior sales analyst at a premium web agency. Analyze this business and return strict JSON with keys aiSummary, suggestedOffer, websiteSummary, opportunityExplanation. Return ONLY the JSON.

Business:
${JSON.stringify(input, null, 2)}`;
      const text = await this.call(prompt);
      const parsed = safeJson(text) as Partial<AuditOutput> | null;
      if (!parsed?.aiSummary || !parsed?.suggestedOffer) return this.fallback.generateAudit(input);
      return {
        aiSummary: String(parsed.aiSummary),
        suggestedOffer: String(parsed.suggestedOffer),
        websiteSummary: String(parsed.websiteSummary ?? ""),
        opportunityExplanation: String(parsed.opportunityExplanation ?? ""),
      };
    } catch (err) {
      console.warn("[ai/gemini] audit fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateAudit(input);
    }
  }

  async generateOutreachEmail(input: OutreachInput): Promise<EmailDraft> {
    try {
      const prompt = `Write a personalized outreach email in ${input.language === "fr" ? "French" : "English"} for the business below. Return strict JSON { "subject": "...", "body": "..." }. Sign off "Ayoub Khyat / Ibda3 Digital / https://ibda3-digital.vercel.app".

Business:
${JSON.stringify(input, null, 2)}

Return ONLY the JSON.`;
      const text = await this.call(prompt);
      const parsed = safeJson(text) as Partial<EmailDraft> | null;
      if (!parsed?.subject || !parsed?.body) return this.fallback.generateOutreachEmail(input);
      return { subject: String(parsed.subject), body: String(parsed.body) };
    } catch (err) {
      console.warn("[ai/gemini] email fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateOutreachEmail(input);
    }
  }

  async generateOutreachWhatsApp(input: OutreachInput): Promise<string> {
    try {
      const prompt = `Write a short WhatsApp opener (2-3 sentences) in ${input.language === "fr" ? "French" : "English"} for the business below. Include https://ibda3-digital.vercel.app at the end. Return ONLY the message text.

Business:
${JSON.stringify(input, null, 2)}`;
      const text = await this.call(prompt);
      if (!text.trim()) return this.fallback.generateOutreachWhatsApp(input);
      return text.trim();
    } catch (err) {
      console.warn("[ai/gemini] whatsapp fallback:", err instanceof Error ? err.message : err);
      return this.fallback.generateOutreachWhatsApp(input);
    }
  }

  private async call(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
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
