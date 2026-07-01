export const WHATSAPP_NUMBER = "212625461645";

/**
 * Build a wa.me URL with an optional pre-filled message body.
 * Text is URL-encoded via encodeURIComponent so line breaks, accents and emoji survive.
 * Callers pass locale-specific copy via next-intl (e.g. WhatsApp.prefill_message).
 */
export function buildWhatsAppUrl(prefilledText?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  if (!prefilledText) return base;
  return `${base}?text=${encodeURIComponent(prefilledText)}`;
}
