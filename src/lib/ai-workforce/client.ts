/**
 * The AI Workforce's own API key and client. ANTHROPIC_API_KEY switches on every older AI feature, none of
 * which has a cap or a kill switch, so this workflow never reads or sets it. Adding this key activates
 * this workflow only, and only inside its budget. Give the key its own spend limit in the Anthropic console.
 */
import Anthropic from "@anthropic-ai/sdk";

const readKey = () => process.env.AI_WORKFORCE_ANTHROPIC_API_KEY?.trim() ?? "";

export const hasWorkforceKey = () => readKey() !== "";

/** The key, endpoint and retries are all explicit, so nothing is picked up from the SDK's own env vars. */
export function getWorkforceClient(): Anthropic {
  const apiKey = readKey();
  if (!apiKey) throw new Error("AI_WORKFORCE_ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey, authToken: null, baseURL: "https://api.anthropic.com", maxRetries: 0 });
}
