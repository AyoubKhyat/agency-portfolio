/**
 * Prospect contact-quality tiers and scoring.
 *
 * HOT  — has WhatsApp OR Instagram (can DM tonight)
 * WARM — has Website AND Phone (need to visit + call)
 * COLD — only name/location, no contact channel
 *
 * Scoring is contact-channel-weighted per spec:
 *   WhatsApp +40, Instagram +30, Email +20, Website +15, Phone +10
 */

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
  const hasWhatsapp = nonEmpty(s.whatsapp) || nonEmpty(s.phone);
  const hasInstagram = nonEmpty(s.instagram);
  const hasWebsite = nonEmpty(s.website);
  const hasPhone = nonEmpty(s.phone);

  if (hasWhatsapp || hasInstagram) return "HOT";
  if (hasWebsite && hasPhone) return "WARM";
  return "COLD";
}

/**
 * Pure contact-channel score (0-100). Independent of engagement signals.
 * Use this for ranking discovery results before import.
 */
export function contactScore(s: ContactSignals): number {
  let total = 0;
  if (nonEmpty(s.whatsapp) || nonEmpty(s.phone)) total += 40; // WhatsApp = phone we can wa.me
  if (nonEmpty(s.instagram)) total += 30;
  if (nonEmpty(s.email)) total += 20;
  if (nonEmpty(s.website)) total += 15;
  if (nonEmpty(s.phone)) total += 10;
  return Math.min(100, total);
}

/**
 * Returns which channels are present — used to render the 5-column ✓/✗ grid.
 */
export type ChannelFlags = {
  whatsapp: boolean;
  instagram: boolean;
  website: boolean;
  email: boolean;
  phone: boolean;
};

export function channelFlags(s: ContactSignals): ChannelFlags {
  return {
    whatsapp: nonEmpty(s.whatsapp) || nonEmpty(s.phone),
    instagram: nonEmpty(s.instagram),
    website: nonEmpty(s.website),
    email: nonEmpty(s.email),
    phone: nonEmpty(s.phone),
  };
}

export function contactableChannelCount(s: ContactSignals): number {
  const f = channelFlags(s);
  return [f.whatsapp, f.instagram, f.website, f.email, f.phone].filter(Boolean).length;
}

export function isContactable(s: ContactSignals): boolean {
  // "Contactable tonight" = has WhatsApp / Instagram / Email / Phone (a way to reach humans).
  // Website alone doesn't count — we can't message a website.
  return nonEmpty(s.whatsapp) || nonEmpty(s.phone) || nonEmpty(s.instagram) || nonEmpty(s.email);
}
