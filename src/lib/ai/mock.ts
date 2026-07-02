/**
 * Mock AI provider — the default and permanent fallback.
 *
 * Everything below is template-driven, deterministic, and locale-aware. Read
 * the sector/city/completeness signals and emit text that reads like a real
 * analyst wrote it. No LLM calls. Never throws.
 */

import type {
  AiProvider, AuditInput, AuditOutput, EmailDraft, OutreachInput,
} from "./types";

/* ─────────────────────────── Audit ─────────────────────────── */

const OFFER_BY_SECTOR: Record<string, string> = {
  "Luxury Hotels":
    "Cinematic property site with direct-booking flow — bypass OTAs on brand traffic and reclaim margin.",
  "Hotels":
    "Direct-booking website + Instagram-linked storytelling to reduce OTA dependency and grow direct revenue.",
  "Web Agencies":
    "White-label partnership — we handle premium overflow, you keep the client relationship.",
  "Architecture Studios":
    "Portfolio site engineered for RFPs — case-study depth, no template feel, image performance built in.",
  "Interior Design Studios":
    "Portfolio site + qualified intake flow that filters out low-fit briefs before they reach your inbox.",
  "Premium Restaurants":
    "Reservation-first site with brand-grade photography, menu system, and seamless WhatsApp booking.",
  "Jewelry Houses":
    "Editorial e-commerce with private-appointment booking and story-led product pages.",
  "Real Estate":
    "Listing platform with WhatsApp-linked qualification and neighborhood-aware search.",
  "Wineries":
    "Domain-story site with direct e-commerce and allocation management for club members.",
  "Yacht Brokers":
    "Fleet showcase with charter-enquiry qualification and calendar-linked availability.",
  "Law Firms":
    "Practice-area architecture engineered for referral traffic and LinkedIn-driven credibility.",
  "Spa & Wellness":
    "Booking-first site with treatment library, therapist bios, and reviews block.",
};

function offerFor(sector: string): string {
  return OFFER_BY_SECTOR[sector] ??
    "Premium redesign with tailored booking or lead flow, engineered for the sector.";
}

function summaryFor(input: AuditInput): string {
  const where = [input.city, input.country].filter(Boolean).join(", ");
  const parts: string[] = [`${input.name}${where ? ` — ${where}` : ""}.`];

  const missing: string[] = [];
  if (!input.hasWebsite) missing.push("no discoverable website");
  if (!input.hasEmail) missing.push("no public email");
  if (!input.hasInstagram) missing.push("no Instagram presence");

  if (missing.length >= 2) {
    parts.push(
      `Weak digital footprint (${missing.join(", ")}) — clear runway for a first-mover premium redesign that lets the brand catch up to its offering.`
    );
  } else if (missing.length === 1) {
    parts.push(
      `Has partial digital presence but ${missing[0]} — meaningful upside on conversion and brand consistency without a full rebuild.`
    );
  } else {
    parts.push(
      "Solid digital footprint already in place — the angle is premium positioning and conversion depth, not a rebuild-from-zero pitch."
    );
  }

  parts.push(
    `Sector fit is strong: ${input.sector.toLowerCase()} aligns with our cinematic / immersive niche.`
  );
  return parts.join(" ");
}

function websiteSummaryFor(input: AuditInput): string {
  if (!input.hasWebsite) {
    return `${input.name} does not appear to have a discoverable website. That gap alone is a first-mover opportunity: they're relying on directories, OTAs, or Instagram for discovery, which caps their margin and their brand story.`;
  }
  const sectorTone = input.sector === "Luxury Hotels" || input.sector === "Jewelry Houses"
    ? "The site is present but the visual identity likely feels dated versus the property/brand itself"
    : input.sector === "Architecture Studios" || input.sector === "Interior Design Studios"
    ? "The portfolio is present but likely under-serves what a sophisticated client evaluates during vendor selection"
    : "The site is present but its conversion architecture likely under-serves the brand";
  return `${sectorTone}. A premium redesign with immersive photography, a better booking or enquiry flow, and stronger storytelling would meaningfully improve first impressions and time-on-site — the two signals that most predict enquiry rate in this sector.`;
}

function opportunityFor(input: AuditInput): string {
  const cityBit = input.city ? ` in ${input.city}` : "";
  const sectorLine = OPPORTUNITY_LINES[input.sector] ?? OPPORTUNITY_LINES.__default;
  const contactStrength = [input.hasPhone, input.hasEmail, input.hasInstagram].filter(Boolean).length;
  const reachability =
    contactStrength >= 2
      ? "Reachable through multiple channels — a coordinated email + WhatsApp sequence would land."
      : contactStrength === 1
      ? "Only one open contact channel — worth confirming a second before running outreach."
      : "Contact channels are thin — start with the single-most-reliable channel and don't over-invest until validated.";
  return `${sectorLine}${cityBit ? ` The location${cityBit} adds a discovery advantage — buyers still search "${input.sector.toLowerCase()}${cityBit}".` : ""} ${reachability}`;
}

const OPPORTUNITY_LINES: Record<string, string> = {
  "Luxury Hotels":
    "Luxury properties leak margin to OTAs; a strong direct site captures both bookings and the brand narrative.",
  "Hotels":
    "Independent hotels are structurally over-reliant on OTAs; a stronger direct site meaningfully improves gross margin.",
  "Web Agencies":
    "Agencies with a strong local reputation but stretched delivery capacity are ideal white-label partners.",
  "Architecture Studios":
    "Architecture studios often win commissions through PDFs and referrals; a stronger web presence lifts inbound RFP quality.",
  "Interior Design Studios":
    "Interior designers benefit disproportionately from a portfolio that pre-qualifies aesthetic fit before the enquiry.",
  "Premium Restaurants":
    "Premium restaurants leave direct-booking revenue on the table; a reservation-first site pays for itself.",
  "Jewelry Houses":
    "Editorial e-commerce lets independent houses compete for private-appointment traffic against larger maisons.",
  "Real Estate":
    "Agencies that qualify leads before the first call convert far higher; that qualification lives on the website.",
  "Wineries":
    "Domain sales — especially to allocation buyers — are increasingly digital-first; the story sells the vintage.",
  "Yacht Brokers":
    "Charter clients qualify heavily online before they enquire; a strong fleet showcase shortens the sales cycle.",
  "Law Firms":
    "Referrals still dominate legal, but referrers verify credibility online first; that verification lives on your site.",
  "Spa & Wellness":
    "Booking-first sites lift wellness revenue mostly by capturing off-hours discovery when the phone doesn't ring.",
  __default:
    "Businesses in this sector benefit from a web presence engineered specifically for their buyer's decision path, not a generic template.",
};

/* ─────────────────────────── Outreach ─────────────────────────── */

function outreachEmail(input: OutreachInput): EmailDraft {
  const { businessName, sector, city, country, suggestedOffer, language } = input;
  const loc = [city, country].filter(Boolean).join(", ");

  if (language === "fr") {
    const subject = `${businessName} — une piste rapide pour ${sector.toLowerCase()}`;
    const body =
`Bonjour,

Je suis Ayoub, fondateur d'Ibda3 Digital. Nous concevons des sites web premium pour des maisons dans votre secteur (${sector.toLowerCase()}), avec un focus sur la narration visuelle et la conversion directe.

En regardant ${businessName}${loc ? ` (${loc})` : ""}, une chose est nette : la marque mérite un site à la hauteur du produit. Concrètement, voici la piste que je proposerais :

${suggestedOffer}

Si l'idée vous parle, quinze minutes suffisent pour voir si on est alignés — sans engagement. Répondez juste à cet email avec un créneau qui vous arrange, ou dites-moi de vous rappeler.

Bien à vous,
Ayoub Khyat
Ibda3 Digital
https://ibda3-digital.vercel.app`;
    return { subject, body };
  }

  const subject = `${businessName} — a quick idea for ${sector.toLowerCase()}`;
  const body =
`Hi,

I'm Ayoub, founder of Ibda3 Digital. We build premium websites for brands in your space (${sector.toLowerCase()}), with a focus on cinematic storytelling and direct conversion.

Looking at ${businessName}${loc ? ` (${loc})` : ""}, one thing stood out: the brand deserves a site that matches the product. The angle I'd propose:

${suggestedOffer}

If the idea resonates, fifteen minutes is enough to see if we're aligned — no commitment. Just reply with a time that works, or ask me to call.

Best,
Ayoub Khyat
Ibda3 Digital
https://ibda3-digital.vercel.app`;
  return { subject, body };
}

function outreachWhatsApp(input: OutreachInput): string {
  const { businessName, suggestedOffer, language } = input;
  if (language === "fr") {
    return `Bonjour ! Je suis Ayoub d'Ibda3 Digital — nous concevons des sites premium pour des maisons comme ${businessName}. Idée rapide : ${suggestedOffer.replace(/\s+—\s+.*/, "")} Ça vous parlerait d'en discuter quinze minutes ? Voici notre travail : https://ibda3-digital.vercel.app`;
  }
  return `Hi! I'm Ayoub from Ibda3 Digital — we build premium websites for brands like ${businessName}. Quick idea: ${suggestedOffer.replace(/\s+—\s+.*/, "")} Open to a 15-minute chat? Here's our work: https://ibda3-digital.vercel.app`;
}

/* ─────────────────────────── Provider ─────────────────────────── */

export class MockAiProvider implements AiProvider {
  readonly name = "MOCK" as const;
  readonly isReal = false;

  async generateAudit(input: AuditInput): Promise<AuditOutput> {
    return {
      aiSummary: summaryFor(input),
      suggestedOffer: offerFor(input.sector),
      websiteSummary: websiteSummaryFor(input),
      opportunityExplanation: opportunityFor(input),
    };
  }

  async generateOutreachEmail(input: OutreachInput): Promise<EmailDraft> {
    return outreachEmail(input);
  }

  async generateOutreachWhatsApp(input: OutreachInput): Promise<string> {
    return outreachWhatsApp(input);
  }
}

