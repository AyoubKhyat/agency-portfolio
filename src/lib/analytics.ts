/**
 * Consent-aware GA4 events.
 *
 * gtag only exists after the visitor accepts cookies (see the ga-consent-gate
 * script in the root layout), and this module checks consent again before
 * every event. Parameters are restricted to a short allowlist of non-personal
 * keys with slug-like values, so a name, email, phone number or message can
 * never be sent by mistake.
 */

export const GA_ID = "G-PK5HSDWHYM";
const CONSENT_KEY = "cookie-consent";

export type AnalyticsEvent = "generate_lead" | "whatsapp_click";

const ALLOWED_PARAMS = ["service", "locale", "page_type", "placement", "method"] as const;
export type EventParams = Partial<Record<(typeof ALLOWED_PARAMS)[number], string | null | undefined>>;

const SAFE_VALUE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

/** Keep only allowlisted keys whose values look like slugs (no spaces, @, digits-only phone strings…). */
export function sanitizeParams(params: EventParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ALLOWED_PARAMS) {
    const raw = params[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim().toLowerCase();
    if (SAFE_VALUE.test(value) && !/^\+?\d{6,}$/.test(value)) out[key] = value;
  }
  return out;
}

export type AnalyticsEnv = {
  gtag?: (...args: unknown[]) => void;
  consent: string | null;
  disabled: boolean;
};

function browserEnv(): AnalyticsEnv | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  let consent: string | null = null;
  try {
    consent = window.localStorage.getItem(CONSENT_KEY);
  } catch {
    consent = null;
  }
  return {
    gtag: typeof w.gtag === "function" ? (w.gtag as AnalyticsEnv["gtag"]) : undefined,
    consent,
    disabled: w[`ga-disable-${GA_ID}`] === true,
  };
}

export function canTrack(env: AnalyticsEnv | null): env is AnalyticsEnv & { gtag: NonNullable<AnalyticsEnv["gtag"]> } {
  return !!env && typeof env.gtag === "function" && env.consent === "accepted" && !env.disabled;
}

/** Send a GA4 event if (and only if) the visitor consented. Returns whether it was sent. */
export function trackEvent(name: AnalyticsEvent, params: EventParams, env: AnalyticsEnv | null = browserEnv()): boolean {
  if (!canTrack(env)) return false;
  try {
    env.gtag("event", name, sanitizeParams(params));
    return true;
  } catch {
    return false;
  }
}

export type PageType =
  | "home" | "services" | "service_detail" | "portfolio" | "case_study"
  | "contact" | "about" | "blog" | "blog_post" | "privacy" | "other";

const LOCALES = new Set(["fr", "en", "ar"]);

export function localeFromPath(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return LOCALES.has(first) ? first : "other";
}

export function pageTypeFromPath(pathname: string): PageType {
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  if (LOCALES.has(parts[0])) parts.shift();
  const [section, slug] = parts;
  if (!section) return "home";
  switch (section) {
    case "services": return slug ? "service_detail" : "services";
    case "portfolio": return slug ? "case_study" : "portfolio";
    case "blog": return slug ? "blog_post" : "blog";
    case "contact": return "contact";
    case "about": return "about";
    case "privacy": return "privacy";
    default: return "other";
  }
}

/**
 * Ignores a second interaction with the same element inside `windowMs`
 * (double-clicks, or click + auxclick from one press), so one intent is one event.
 */
export function createClickDeduper(windowMs = 1000, now: () => number = Date.now) {
  const last = new WeakMap<object, number>();
  return (target: object): boolean => {
    const t = now();
    const prev = last.get(target);
    last.set(target, t);
    return prev === undefined || t - prev >= windowMs;
  };
}
