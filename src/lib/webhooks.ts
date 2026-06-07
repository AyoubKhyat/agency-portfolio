import { prisma, hasPrisma } from "@/lib/prisma";
import { createHmac } from "crypto";

/**
 * Fire-and-forget webhook dispatcher.
 * Queries all active webhooks matching the given event, POSTs the payload
 * to each URL. Errors are caught silently so webhooks never break the app.
 */
export async function dispatchWebhook(event: string, payload: object): Promise<void> {
  // Don't await — fire and forget
  dispatchInternal(event, payload).catch(() => {});
}

async function dispatchInternal(event: string, payload: object): Promise<void> {
  if (!hasPrisma()) return;

  let webhooks: { id: string; url: string; secret: string | null }[];
  try {
    const all = await prisma.webhook.findMany({
      where: { isActive: true },
      select: { id: true, url: true, events: true, secret: true },
    });
    // Filter to webhooks whose comma-separated events list includes this event
    webhooks = all.filter((w: { events: string }) => {
      const eventList = w.events.split(",").map((e: string) => e.trim());
      return eventList.includes(event);
    });
  } catch (err) {
    console.error("[webhooks] Failed to query webhooks:", err);
    return;
  }

  if (webhooks.length === 0) return;

  const timestamp = new Date().toISOString();
  const body = JSON.stringify({ event, timestamp, data: payload });

  const promises = webhooks.map(async (wh) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Timestamp": timestamp,
      };

      if (wh.secret) {
        const signature = createHmac("sha256", wh.secret)
          .update(body)
          .digest("hex");
        headers["X-Webhook-Signature"] = `sha256=${signature}`;
      }

      const response = await fetch(wh.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        console.error(
          `[webhooks] Webhook ${wh.id} returned ${response.status} for event "${event}"`
        );
      }
    } catch (err) {
      console.error(
        `[webhooks] Failed to deliver event "${event}" to webhook ${wh.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Send a test payload to a specific URL (used by the test endpoint).
 */
export async function sendTestWebhook(
  url: string,
  secret?: string | null
): Promise<{ success: boolean; status?: number; error?: string }> {
  const event = "test.ping";
  const timestamp = new Date().toISOString();
  const payload = {
    event,
    timestamp,
    data: {
      message: "This is a test webhook from Ibda3 Digital",
      sentAt: timestamp,
    },
  };
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": event,
    "X-Webhook-Timestamp": timestamp,
  };

  if (secret) {
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });
    return { success: response.ok, status: response.status };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
