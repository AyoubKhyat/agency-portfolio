import { createHash } from "crypto";

/**
 * Simple in-memory rate limiter. Serverless functions get one bucket per instance,
 * which is acceptable for a demo. Swap to Upstash/Redis for a production hard limit.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_MESSAGES_PER_WINDOW = Number(process.env.CHAT_RATE_LIMIT_PER_HOUR || 30);

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function check(ipHash: string): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = buckets.get(ipHash);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ipHash, bucket);
  }

  bucket.count += 1;

  return {
    ok: bucket.count <= MAX_MESSAGES_PER_WINDOW,
    remaining: Math.max(0, MAX_MESSAGES_PER_WINDOW - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// occasional cleanup to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  buckets.forEach((b, key) => {
    if (b.resetAt < now) buckets.delete(key);
  });
}, WINDOW_MS).unref?.();
