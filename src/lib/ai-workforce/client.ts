/**
 * The AI Workforce's own Groq key and call. It reads only this key and only this address, so no older AI
 * feature can start from it and nothing in the environment can redirect it. Adding the key activates this
 * workflow only, inside its caps. A plain fetch with no SDK means no hidden retries: every call is one request.
 */
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const SAFE_CODE = /^[a-z0-9_]{1,64}$/;

const readKey = () => process.env.AI_WORKFORCE_GROQ_API_KEY?.trim() ?? "";

export const hasWorkforceKey = () => readKey() !== "";

/** Groq answered with an error. Holds the status and its code, never its message text. */
export class WorkforceApiError extends Error {
  status: number;
  code: string | null;
  retryAfterSeconds: number | null;
  constructor(status: number, code: string | null, retryAfterSeconds: number | null) {
    super(`Groq answered ${status}`);
    this.name = "WorkforceApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** No usable answer arrived, so the request may still have been processed. */
export class WorkforceConnectionError extends Error {
  constructor() {
    super("The Groq request didn't finish");
    this.name = "WorkforceConnectionError";
  }
}

export type ChatCompletion = {
  model?: string;
  choices?: { finish_reason?: string | null; message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export async function createChatCompletion(body: Record<string, unknown>, timeoutMs: number): Promise<ChatCompletion> {
  const apiKey = readKey();
  if (!apiKey) throw new Error("AI_WORKFORCE_GROQ_API_KEY is not configured");

  let res: Response;
  let data: unknown;
  try {
    res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error", // the key never follows a redirect
      signal: AbortSignal.timeout(timeoutMs),
    });
    data = await res.json().catch(() => null);
  } catch {
    throw new WorkforceConnectionError();
  }

  if (!res.ok) {
    const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
    const retryAfter = Number(res.headers.get("retry-after"));
    throw new WorkforceApiError(
      res.status,
      typeof code === "string" && SAFE_CODE.test(code) ? code : null,
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null,
    );
  }
  if (!data || typeof data !== "object") throw new WorkforceConnectionError();
  return data as ChatCompletion;
}
