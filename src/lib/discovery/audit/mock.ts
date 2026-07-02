/**
 * Audit for a discovery candidate — routes through the AI provider layer so
 * whichever provider is configured (Mock / OpenAI / Gemini / Anthropic)
 * produces the audit. Mock is the default and always the fallback.
 *
 * This file is named `mock.ts` for backward compatibility with Phase 2.1's
 * folder structure. Behind the scenes it now delegates to `getAiProvider()`.
 */

import { getAiProvider } from "@/lib/ai";
import type { AuditOutput } from "@/lib/ai/types";
import type { RepairedCandidate } from "../validate";

export type DiscoveryAudit = AuditOutput;

export async function auditCandidate(candidate: RepairedCandidate): Promise<DiscoveryAudit> {
  const provider = getAiProvider();
  return provider.generateAudit({
    name: candidate.name,
    sector: candidate.sector,
    city: candidate.city,
    country: candidate.country,
    website: candidate.website,
    hasWebsite: candidate.validity.website,
    hasEmail: candidate.validity.email,
    hasInstagram: candidate.validity.instagram,
    hasPhone: candidate.validity.phone,
  });
}
