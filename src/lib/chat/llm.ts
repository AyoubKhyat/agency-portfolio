import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "./knowledge-base";
import { buildSystemPrompt } from "./system-prompt";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 512;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Send a chat message and get the assistant's reply.
 * `history` is the full prior conversation (excluding the new user message).
 */
export async function chat(params: {
  locale: Locale;
  history: ChatMessage[];
  userMessage: string;
}): Promise<{ reply: string; usage: { inputTokens: number; outputTokens: number } }> {
  const anthropic = getClient();
  const messages = [...params.history, { role: "user" as const, content: params.userMessage }];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(params.locale),
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && textBlock.type === "text" ? textBlock.text : "";

  return {
    reply: reply.trim(),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
