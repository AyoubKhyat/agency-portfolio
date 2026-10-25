/**
 * Free website diagnosis requests from the homepage hero.
 *
 * A request is an ordinary CRM lead sent through /api/contact (see
 * contact-submit): no schema change. It is recognised by its fixed subject,
 * and its message carries the site address, the visitor's locale and the
 * optional problem description, labelled in French like the rest of the
 * admin. Nothing here fetches or inspects the visitor's site: the diagnosis is
 * done by the team afterwards.
 *
 * The URL field is `siteUrl`, never `website`: `website` is the contact
 * honeypot, and a filled honeypot is silently dropped by the form and the API.
 */
import { EMAIL_RE, PHONE_RE, type Inquiry } from "./contact-submit";

/** Same value in every locale, so diagnosis leads are easy to find in the inbox. */
export const DIAGNOSIS_SUBJECT = "Diagnostic gratuit";
export const SITE_URL_FIELD = "siteUrl";
export const SITE_URL_MAX = 300;
export const PROBLEM_MAX = 2000;

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i;

/**
 * The visitor's site address as an absolute http(s) URL, or null when it is not
 * a plausible public website. "votresite.ma" becomes "https://votresite.ma".
 */
export function normalizeSiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > SITE_URL_MAX || /\s/.test(raw)) return null;
  const withScheme = SCHEME.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const labels = url.hostname.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !TLD.test(labels[labels.length - 1])) return null;
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.protocol}//${url.host}${path}${url.search}${url.hash}`;
}

// ─── The two steps ───────────────────────────────────────────────

export type DiagnosisField = typeof SITE_URL_FIELD | "fullName" | "email" | "phone" | "problem";
export type DiagnosisValues = Record<DiagnosisField, string>;

/** Error codes: url_* are Diagnosis messages, the others Validation messages (same keys as the contact form). */
export type DiagnosisError =
  | "url_required" | "url_invalid"
  | "name_required" | "name_min" | "email_required" | "email_invalid" | "phone_invalid";

/** Step 1 asks only for the address; step 2 for how to reach the visitor (phone and problem optional). */
export const STEP_FIELDS = {
  1: [SITE_URL_FIELD],
  2: ["fullName", "email", "phone", "problem"],
} as const satisfies Record<1 | 2, readonly DiagnosisField[]>;

export const EMPTY_DIAGNOSIS: DiagnosisValues = { siteUrl: "", fullName: "", email: "", phone: "", problem: "" };

export function validateDiagnosisField(field: DiagnosisField, value: string): DiagnosisError | undefined {
  const v = value.trim();
  switch (field) {
    case "siteUrl":
      if (!v) return "url_required";
      return normalizeSiteUrl(v) ? undefined : "url_invalid";
    case "fullName":
      if (!v) return "name_required";
      return v.length < 2 ? "name_min" : undefined;
    case "email":
      if (!v) return "email_required";
      return EMAIL_RE.test(v) ? undefined : "email_invalid";
    case "phone":
      return v && !PHONE_RE.test(v) ? "phone_invalid" : undefined;
    case "problem":
      return undefined;
  }
}

/** Errors for every field of a step, in field order (empty when the step can go on). */
export function validateStep(step: 1 | 2, values: DiagnosisValues): Partial<Record<DiagnosisField, DiagnosisError>> {
  const out: Partial<Record<DiagnosisField, DiagnosisError>> = {};
  for (const f of STEP_FIELDS[step]) {
    const e = validateDiagnosisField(f, values[f]);
    if (e) out[f] = e;
  }
  return out;
}

export type DiagnosisRequest = {
  siteUrl: string;
  fullName: string;
  email: string;
  phone?: string;
  problem?: string;
  locale: string;
};

/** The /api/contact payload for a diagnosis request. Throws on an invalid site address. */
export function buildDiagnosisInquiry(req: DiagnosisRequest): Inquiry {
  const site = normalizeSiteUrl(req.siteUrl);
  if (!site) throw new Error("Invalid site address");
  const problem = (req.problem ?? "").trim().slice(0, PROBLEM_MAX);
  const message = [
    "Demande de diagnostic gratuit du site (vérification par l'équipe).",
    `Site : ${site}`,
    `Langue : ${req.locale.toUpperCase()}`,
    `Problème décrit : ${problem || "non précisé"}`,
  ].join("\n");
  return {
    fullName: req.fullName.trim(),
    email: req.email.trim(),
    phone: req.phone?.trim() || undefined,
    subject: DIAGNOSIS_SUBJECT,
    message,
  };
}
