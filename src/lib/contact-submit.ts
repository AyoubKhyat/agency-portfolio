/**
 * The one submission path for every public inquiry form (the contact page and
 * the homepage diagnosis): save through /api/contact first (the CRM is the
 * source of truth), then send the EmailJS notification, then report a missed
 * email to the server. What the visitor is told comes from contact-outcome.
 *
 * Browser-safe. The email sender is passed in (the contact form sends its DOM
 * form, the diagnosis form sends named params); fetch and the EmailJS config
 * can be injected, so every path is unit-tested without a network.
 */
import {
  parseApiResponse,
  resolveOutcome,
  shouldReportEmailFailure,
  shouldSendEmail,
  shouldTrackLead,
  type ApiResult,
  type EmailResult,
  type Outcome,
} from "./contact-outcome";

// Client-side rules shared by both forms (the server re-validates with Zod).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+\d][\d\s\-().]{7,}$/;

/** Exactly what /api/contact accepts, and the EmailJS template params of the contact form. */
export type Inquiry = {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export type EmailJsConfig = { serviceId: string; templateId: string; publicKey: string };

/**
 * EmailJS template params for an inquiry sent without a DOM form: the same names
 * the contact form's fields give `emailjs.sendForm` (tests keep the two in sync),
 * so one template serves both forms.
 */
export function emailParams(inquiry: Inquiry): Record<string, string> {
  return {
    fullName: inquiry.fullName,
    email: inquiry.email,
    phone: inquiry.phone ?? "",
    subject: inquiry.subject,
    message: inquiry.message,
  };
}

/** The EmailJS ids from the build-time env, or null when any is missing. */
export function emailJsConfig(): EmailJsConfig | null {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  return serviceId && templateId && publicKey ? { serviceId, templateId, publicKey } : null;
}

export type SubmitResult = {
  api: ApiResult;
  email: EmailResult;
  outcome: Outcome;
  /** Count this as a lead in analytics (once; never for duplicates or failures). */
  track: boolean;
};

export async function submitInquiry(
  inquiry: Inquiry,
  sendEmail: (config: EmailJsConfig) => Promise<unknown>,
  opts: { fetch?: typeof fetch; config?: EmailJsConfig | null } = {},
): Promise<SubmitResult> {
  const doFetch = opts.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const config = "config" in opts ? (opts.config ?? null) : emailJsConfig();

  // 1. Save the inquiry. It also tells us about duplicates.
  let res: Response | null = null;
  try {
    res = await doFetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: inquiry.fullName,
        email: inquiry.email,
        phone: inquiry.phone || undefined,
        subject: inquiry.subject,
        message: inquiry.message,
      }),
    });
  } catch {
    res = null;
  }
  const api = await parseApiResponse(res);

  // 2. Email notification, unless the server already has this exact inquiry.
  let email: EmailResult = "skipped";
  if (shouldSendEmail(api)) {
    if (!config) {
      email = "not_configured";
    } else {
      try {
        await sendEmail(config);
        email = "sent";
      } catch {
        email = "failed";
      }
    }
  }

  // 3. Saved but not emailed: the server logs it (fire and forget).
  if (shouldReportEmailFailure(api, email) && api.kind === "stored" && api.leadId) {
    doFetch("/api/contact/notification-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: api.leadId, status: email === "not_configured" ? "not_configured" : "failed" }),
      keepalive: true,
    }).catch(() => {});
  }

  const outcome = resolveOutcome(api, email);
  return { api, email, outcome, track: shouldTrackLead(api, outcome) };
}
