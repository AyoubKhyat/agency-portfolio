/**
 * Offline contact verification (Step E).
 *
 * Upgrades format-valid (UNVERIFIED) fields to VERIFIED / UNAVAILABLE using
 * only Node built-ins — no external, paid, or Google APIs:
 *   - Website → HTTP reachability (does the domain resolve and serve?)
 *   - Email   → DNS MX lookup (can the domain receive mail?)
 *
 * Instagram and WhatsApp are NOT checked here — they stay UNVERIFIED until a
 * later phase with a real source. Only fields that are UNVERIFIED with a value
 * are probed, so mock/contactless results trigger zero network calls.
 *
 * Every probe is bounded by a timeout and never throws to the caller:
 *   reachable/has-MX → VERIFIED
 *   definitively unreachable / no MX / no such domain → UNAVAILABLE
 *   timeout or inconclusive error → left UNVERIFIED (we never guess)
 */

import { promises as dns } from "node:dns";
import type { ContactVerification, VerifiedContact, VerificationMethod, VerificationStatus } from "./types";

const TIMEOUT_MS = 4000;

function stamp(value: string, status: VerificationStatus, method: VerificationMethod): VerifiedContact {
  return { value, status, method, checkedAt: new Date().toISOString() };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Block obviously-internal targets — light SSRF guard for server-side fetches. */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^::1$/.test(h) ||
    h === "0.0.0.0"
  );
}

async function reachable(url: string, signal: AbortSignal): Promise<void> {
  try {
    await fetch(url, { method: "HEAD", redirect: "follow", signal });
  } catch (e) {
    // Timeout is inconclusive — bubble up so we keep UNVERIFIED.
    if ((e as { name?: string })?.name === "AbortError") throw e;
    // Some servers reject HEAD — a GET disambiguates a real network failure.
    await fetch(url, { method: "GET", redirect: "follow", signal });
  }
}

/* ─────────────────────────── Website ─────────────────────────── */

async function verifyWebsite(field: VerifiedContact): Promise<VerifiedContact> {
  if (field.status !== "UNVERIFIED" || !field.value) return field;

  let host = "";
  try { host = new URL(field.value).hostname; } catch { return field; }
  if (isPrivateHost(host)) return stamp(field.value, "UNAVAILABLE", "HTTP");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await reachable(field.value, controller.signal);
    return stamp(field.value, "VERIFIED", "HTTP"); // any HTTP response = domain serves
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return field; // inconclusive
    return stamp(field.value, "UNAVAILABLE", "HTTP");                  // could not connect
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────── Email (MX) ─────────────────────────── */

async function verifyEmail(field: VerifiedContact): Promise<VerifiedContact> {
  if (field.status !== "UNVERIFIED" || !field.value) return field;

  const domain = field.value.split("@")[1];
  if (!domain) return field;

  try {
    const mx = await withTimeout(dns.resolveMx(domain), TIMEOUT_MS);
    if (mx && mx.length > 0) return stamp(field.value, "VERIFIED", "MX"); // domain can receive mail
    return stamp(field.value, "UNAVAILABLE", "MX");                       // resolves but no MX
  } catch (e) {
    const code = (e as { code?: string })?.code;
    // Domain does not exist / has no records → definitively unusable.
    if (code === "ENOTFOUND" || code === "ENODATA") return stamp(field.value, "UNAVAILABLE", "MX");
    return field; // timeout / transient DNS error → keep UNVERIFIED
  }
}

/* ─────────────────────────── Stage ─────────────────────────── */

/**
 * Run the offline verifiers over a candidate's contact verification map and
 * return an upgraded copy. Phone / WhatsApp / Instagram pass through unchanged.
 */
export async function verifyContacts(v: ContactVerification): Promise<ContactVerification> {
  const [website, email] = await Promise.all([verifyWebsite(v.website), verifyEmail(v.email)]);
  return { ...v, website, email };
}
