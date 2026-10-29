import Anthropic from "@anthropic-ai/sdk";

/**
 * Thin wrapper around the Anthropic SDK.
 * Centralizes model choice + auth + error shape so the route handlers stay focused.
 */

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured");
    this.name = "MissingApiKeyError";
  }
}

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export function hasAnthropic(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Default model for sales playbook AI features — quality matters more than cost here.
export const SALES_AI_MODEL = "claude-opus-4-8";
