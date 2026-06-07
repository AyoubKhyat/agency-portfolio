/**
 * Simple in-memory rate limiter using a Map.
 * Tracks requests per IP within a sliding window.
 *
 * Usage:
 *   const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
 *   const result = limiter.check(ip);
 *   if (!result.allowed) return NextResponse.json(..., { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { max, windowMs } = options;
  const store = new Map<string, RateLimitEntry>();

  // Periodically clean up stale entries to prevent memory leaks (every 5 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Allow garbage collection in non-server environments
  if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
  }

  return {
    check(ip: string): RateLimitResult {
      const now = Date.now();
      let entry = store.get(ip);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(ip, entry);
      }

      // Remove timestamps outside the current window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= max) {
        const oldestInWindow = entry.timestamps[0];
        const resetMs = oldestInWindow + windowMs - now;
        return { allowed: false, remaining: 0, resetMs };
      }

      entry.timestamps.push(now);
      return {
        allowed: true,
        remaining: max - entry.timestamps.length,
        resetMs: windowMs,
      };
    },
  };
}

// Pre-configured limiters for the app
export const loginLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });
export const contactLimiter = createRateLimiter({ max: 3, windowMs: 60_000 });
