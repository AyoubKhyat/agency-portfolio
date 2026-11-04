/**
 * Links that open the person's own email or WhatsApp with an approved message. Pure, and used in the
 * browser. Nothing in the app sends a message: these only pre-fill a composer the person controls.
 */
export type DiagnosisChannel = "EMAIL" | "WHATSAPP";

/** Above this, some mail clients and browsers cut the link, so the person copies the text instead. */
export const MAX_LINK_CHARS = 1900;

/** International digits for wa.me, assuming Morocco for a local 0-prefixed number. Null when it can't be a number. */
export function whatsappDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  else if (!trimmed.startsWith("+") && digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

export function buildSendLink(
  channel: DiagnosisChannel,
  to: { email: string; phone: string | null },
  subject: string,
  body: string,
): string | null {
  let link: string | null = null;
  if (channel === "EMAIL") {
    link = `mailto:${encodeURIComponent(to.email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  } else {
    const digits = whatsappDigits(to.phone);
    if (digits) link = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
  }
  return link && link.length <= MAX_LINK_CHARS ? link : null;
}
