/**
 * AI provider abstraction — Ibda3 OS.
 *
 * Every content-generation feature (audit, outreach, summaries, explanations)
 * goes through this interface so the underlying model can change without any
 * caller edits. Mock is always available and always the fallback; real
 * providers are opt-in via env vars and gracefully delegate to Mock on error.
 */

export type AiProviderName = "MOCK" | "OPENAI" | "GEMINI" | "ANTHROPIC";

export type AuditInput = {
  name: string;
  sector: string;
  city: string;
  country: string;
  website: string;      // repaired URL or ""
  hasWebsite: boolean;
  hasEmail: boolean;
  hasInstagram: boolean;
  hasPhone: boolean;
};

export type AuditOutput = {
  /** One-paragraph summary used as the card headline. */
  aiSummary: string;
  /** One-liner offer pitch tailored to the sector. */
  suggestedOffer: string;
  /** 2–3 sentences on the current website state (or lack thereof). */
  websiteSummary: string;
  /** 2–3 sentences on WHY this business is worth pursuing. */
  opportunityExplanation: string;
};

export type OutreachInput = {
  businessName: string;
  sector: string;
  city: string;
  country: string;
  language: "en" | "fr";
  suggestedOffer: string;
};

export type EmailDraft = {
  subject: string;
  body: string;
};

export interface AiProvider {
  readonly name: AiProviderName;
  readonly isReal: boolean;
  generateAudit(input: AuditInput): Promise<AuditOutput>;
  generateOutreachEmail(input: OutreachInput): Promise<EmailDraft>;
  generateOutreachWhatsApp(input: OutreachInput): Promise<string>;
}
