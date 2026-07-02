/**
 * AI provider factory.
 *
 * Selection rules (first match wins):
 *   1. AI_PROVIDER env var if set explicitly to a valid name, AND its API key
 *      is present. Otherwise the explicit choice is ignored (logged, not
 *      thrown) and we fall through.
 *   2. Auto-detect by API key: OPENAI_API_KEY → OpenAI, GEMINI_API_KEY →
 *      Gemini, ANTHROPIC_API_KEY → Anthropic.
 *   3. MockAiProvider.
 *
 * Mock is never disabled — it's the fallback for every real provider on
 * per-call errors, and the default when no keys are set.
 */

import { MockAiProvider } from "./mock";
import { OpenAiProvider } from "./openai";
import { GeminiAiProvider } from "./gemini";
import { AnthropicAiProvider } from "./anthropic";
import type { AiProvider } from "./types";

let _cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (_cached) return _cached;
  _cached = resolveProvider();
  return _cached;
}

/** For tests / dev tools — reset the cached instance so env changes take effect. */
export function _resetAiProviderForTests(): void {
  _cached = null;
}

function resolveProvider(): AiProvider {
  const explicit: string = (process.env.AI_PROVIDER || "").toUpperCase();
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (explicit === "OPENAI" && openaiKey) return new OpenAiProvider(openaiKey);
  if (explicit === "GEMINI" && geminiKey) return new GeminiAiProvider(geminiKey);
  if (explicit === "ANTHROPIC" && anthropicKey) return new AnthropicAiProvider(anthropicKey);
  if (explicit === "MOCK") return new MockAiProvider();

  if (explicit && explicit !== "MOCK") {
    console.warn(`[ai] AI_PROVIDER=${explicit} but its API key is not set — falling back.`);
  }

  if (openaiKey) return new OpenAiProvider(openaiKey);
  if (geminiKey) return new GeminiAiProvider(geminiKey);
  if (anthropicKey) return new AnthropicAiProvider(anthropicKey);
  return new MockAiProvider();
}

export type { AiProvider, AiProviderName } from "./types";
