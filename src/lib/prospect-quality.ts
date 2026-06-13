/**
 * Prospect contact-quality tiers — Moroccan phone-aware.
 *
 * HOT  — actionable today: mobile (06/07) OR Instagram OR explicit WhatsApp link
 * WARM — reachable but not message-able today: fixed line (05) only, website, email
 * COLD — no contact channel at all
 *
 * Moroccan numbering plan (per ANRT):
 *   06xxxxxxxx, 07xxxxxxxx → mobile (WhatsApp viable)
 *   05xxxxxxxx              → fixed line (NOT a WhatsApp lead)
 *
 * Scoring is contact-channel-weighted, mobile-aware:
 *   Mobile (= WhatsApp) +40, Instagram +30, Email +20, Website +15, Fixed phone +10
 */

/** True if phone is a Moroccan mobile (starts with 06 or 07 after normalization). */
export function isMobileMA(phone: string | null | undefined): boolean {
  if (!phone) return false;
  // Strip non-digits, drop leading 212 (country code) and any leading 0
  const d = phone.replace(/\D/g, "").replace(/^212/, "").replace(/^0+/, "");
  return /^[67]/.test(d);
}

/** True if phone is a Moroccan fixed line (starts with 05 after normalization). */
export function isFixedLineMA(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const d = phone.replace(/\D/g, "").replace(/^212/, "").replace(/^0+/, "");
  return /^5/.test(d);
}

/** True if a string looks like an explicit wa.me / api.whatsapp.com link with a mobile destination. */
function isVerifiedWhatsappLink(s: string | null | undefined): boolean {
  if (!s) return false;
  // Extract digits from wa.me/<digits> patterns
  const m = s.match(/wa\.me\/(\+?\d+)/i) || s.match(/api\.whatsapp\.com\/send\?phone=(\+?\d+)/i);
  if (!m) return false;
  return isMobileMA(m[1]);
}

export type QualityLabel = "HOT" | "WARM" | "COLD";

export type ContactSignals = {
  phone: string | null | undefined;
  whatsapp: string | null | undefined;   // wa.me link or similar
  instagram: string | null | undefined;
  website: string | null | undefined;
  email: string | null | undefined;
};

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function computeQualityLabel(s: ContactSignals): QualityLabel {
  // Actionable channels (HOT)
  const hasMobile = isMobileMA(s.phone) || isMobileMA(s.whatsapp);
  const hasVerifiedWhatsapp = isVerifiedWhatsappLink(s.whatsapp);
  const hasInstagram = nonEmpty(s.instagram);

  if (hasMobile || hasVerifiedWhatsapp || hasInstagram) return "HOT";

  // Warm channels — reachable but not message-able today
  const hasFixedLine = isFixedLineMA(s.phone);
  const hasWebsite = nonEmpty(s.website);
  const hasEmail = nonEmpty(s.email);

  if (hasFixedLine || hasWebsite || hasEmail) return "WARM";

  return "COLD";
}

/**
 * Pure contact-channel score (0-100). Mobile gets the WhatsApp bonus;
 * fixed line gets only the small phone bonus.
 */
export function contactScore(s: ContactSignals): number {
  let total = 0;
  const hasMobile = isMobileMA(s.phone) || isMobileMA(s.whatsapp) || isVerifiedWhatsappLink(s.whatsapp);
  const hasFixed = isFixedLineMA(s.phone);

  if (hasMobile) total += 40;                  // WhatsApp viable
  if (nonEmpty(s.instagram)) total += 30;
  if (nonEmpty(s.email)) total += 20;
  if (nonEmpty(s.website)) total += 15;
  if (hasFixed && !hasMobile) total += 10;     // fixed-line-only gets just the phone bonus
  return Math.min(100, total);
}

/**
 * Returns which channels are present — used to render the 5-column ✓/✗ grid.
 * WhatsApp ✓ means we can actually wa.me them (mobile or verified link).
 */
export type ChannelFlags = {
  whatsapp: boolean;
  instagram: boolean;
  website: boolean;
  email: boolean;
  phone: boolean;        // any phone (mobile or fixed)
  mobile: boolean;       // mobile-only
  fixedLine: boolean;    // fixed-line-only
};

export function channelFlags(s: ContactSignals): ChannelFlags {
  const mobile = isMobileMA(s.phone) || isMobileMA(s.whatsapp);
  const fixedLine = isFixedLineMA(s.phone);
  return {
    whatsapp: mobile || isVerifiedWhatsappLink(s.whatsapp),
    instagram: nonEmpty(s.instagram),
    website: nonEmpty(s.website),
    email: nonEmpty(s.email),
    phone: nonEmpty(s.phone),
    mobile,
    fixedLine,
  };
}

export function contactableChannelCount(s: ContactSignals): number {
  const f = channelFlags(s);
  return [f.whatsapp, f.instagram, f.website, f.email, f.phone].filter(Boolean).length;
}

export function isContactable(s: ContactSignals): boolean {
  return isMobileMA(s.phone) || isMobileMA(s.whatsapp) || nonEmpty(s.instagram) || nonEmpty(s.email);
}

/** True if a prospect is HOT under the actionable definition — used by Outreach metrics. */
export function isActionableHot(s: ContactSignals): boolean {
  return isMobileMA(s.phone) || isMobileMA(s.whatsapp) || isVerifiedWhatsappLink(s.whatsapp) || nonEmpty(s.instagram);
}
