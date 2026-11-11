/**
 * P6B Stage 1: a first message for an existing prospect, written by code from a fresh check of their website.
 *
 * No AI. Every sentence about the site comes from a fixed table, keyed by an audit check that failed, and is
 * used only when the observation has the exact shape that check writes. Nothing is stored or sent here: the
 * person edits the text, sends it themselves, and records it with the existing "Yes, sent" flow.
 *
 * A draft is refused when the prospect was already contacted, has no channel a person marked VERIFIED,
 * may be the same business as another prospect, or the site couldn't be read well enough to say anything.
 */
import { qualifyWebsite, matchProspects, type ProspectRow, type ProblemEvidence, type QualifyDeps, type ProspectMatch } from "@/lib/prospect-qualification";
import { isContacted, latestSendAt } from "@/lib/prospect-stages";
import { whatsappUrl, instagramUrl, type SendChannel } from "@/lib/next-action";
import { analyzeMessage, type Warning } from "@/lib/message-quality";
import { repairInstagram } from "@/lib/discovery/validate";
import { contactOpenUrl } from "@/lib/contact-check";

export type DraftLanguage = "fr" | "en" | "ar";
export const MAX_FINDINGS = 2;

type Sentences = Record<DraftLanguage, string>;
/** Returns the sentence when `observed` is exactly what a failure of this check looks like, else null. */
type FindingRule = (observed: string) => Sentences | null;

const NONE_FOUND = /^None found/;
const none = (s: Sentences): FindingRule => (observed) => (NONE_FOUND.test(observed) ? s : null);

/** Checks a business owner cares about, most important first. Technical ones (HSTS, canonical, sitemap...) are left out. */
export const FINDINGS: [id: string, rule: FindingRule][] = [
  ["E_HTTPS", (observed) => (/^http:\/\//i.test(observed) ? {
    fr: "le site ne s'ouvre pas en connexion sécurisée (https), et les navigateurs l'affichent comme « non sécurisé »",
    en: "the site doesn't open over a secure connection (https), so browsers show it as \"not secure\"",
    ar: "الموقع لا يفتح عبر اتصال آمن (https)، لذلك تعرضه المتصفحات على أنه «غير آمن»",
  } : null)],
  ["E_VIEWPORT", none({
    fr: "la page n'indique pas aux téléphones comment s'afficher, elle risque donc d'apparaître en tout petit sur mobile",
    en: "the page doesn't tell phones how to display it, so it may show up tiny on mobile",
    ar: "الصفحة لا تحدد للهواتف طريقة عرضها، لذلك قد تظهر صغيرة جداً على الجوال",
  })],
  ["E_CONTACT", none({
    fr: "je n'ai trouvé sur la page d'accueil ni formulaire, ni lien e-mail, téléphone ou WhatsApp",
    en: "I couldn't find a form, or an email, phone or WhatsApp link, on the home page",
    ar: "لم أجد في الصفحة الرئيسية نموذج تواصل ولا رابط بريد أو هاتف أو واتساب",
  })],
  ["E_RESPONSE_TIME", (observed) => {
    const ms = /^(\d{1,7}) ms$/.exec(observed);
    if (!ms) return null;
    const s = (Number(ms[1]) / 1000).toFixed(1);
    return {
      fr: `la page a mis environ ${s.replace(".", ",")} secondes à répondre lors de mon test`,
      en: `the page took about ${s} seconds to respond when I checked it`,
      ar: `استغرقت الصفحة حوالي ${s} ثانية للاستجابة عند فحصها`,
    };
  }],
  ["E_DESCRIPTION", none({
    fr: "la page n'a pas de description pour Google, qui choisit donc lui-même le texte affiché sous votre lien",
    en: "the page has no description for Google, so Google picks the text shown under your link itself",
    ar: "الصفحة لا تحتوي على وصف لمحرك Google، لذلك يختار Google بنفسه النص الذي يظهر تحت رابطكم",
  })],
  ["E_TITLE", none({
    fr: "la page n'a pas de titre, celui qui s'affiche dans l'onglet et dans les résultats Google",
    en: "the page has no title, the one shown in the browser tab and in Google results",
    ar: "الصفحة بلا عنوان، وهو الذي يظهر في تبويب المتصفح وفي نتائج Google",
  })],
  ["E_OPEN_GRAPH", none({
    fr: "quand on partage le lien sur WhatsApp ou Facebook, aucun aperçu (image, titre) n'est prévu",
    en: "when the link is shared on WhatsApp or Facebook, no preview (image, title) is set up",
    ar: "عند مشاركة الرابط على واتساب أو فيسبوك، لا تظهر أي معاينة (صورة أو عنوان)",
  })],
  ["E_HTTP_REDIRECT", (observed) => (/^HTTP \d{3}$/.test(observed) ? {
    fr: "l'adresse en http:// ne renvoie pas automatiquement vers la version sécurisée",
    en: "the http:// address doesn't send visitors on to the secure version",
    ar: "العنوان http:// لا يحوّل الزوار تلقائياً إلى النسخة الآمنة",
  } : null)],
];

export type UsedFinding = ProblemEvidence & { sentence: string };

/** Up to two failed checks, in the order above, each with the sentence its evidence supports. */
export function pickFindings(problems: ProblemEvidence[], language: DraftLanguage): UsedFinding[] {
  const out: UsedFinding[] = [];
  for (const [id, rule] of FINDINGS) {
    const p = problems.find((e) => e.id === id);
    const s = p ? rule(p.observed) : null;
    if (p && s) out.push({ ...p, sentence: s[language] });
    if (out.length === MAX_FINDINGS) break;
  }
  return out;
}

const TEXT: Record<DraftLanguage, { hello: string; intro: (d: string, n: number) => string; ask: string; team: string }> = {
  fr: {
    hello: "Bonjour {name},",
    intro: (d, n) => `En visitant la page d'accueil de ${d}, j'ai remarqué ${n > 1 ? "deux points" : "un point"} :`,
    ask: "Ce sont des corrections simples. Voulez-vous que je vous envoie le détail ?",
    team: "Ibda3 Digital",
  },
  en: {
    hello: "Hello {name},",
    intro: (d, n) => `I visited the home page of ${d} and noticed ${n > 1 ? "two things" : "one thing"}:`,
    ask: "Both are simple to fix. Would you like me to send you the details?",
    team: "Ibda3 Digital",
  },
  ar: {
    hello: "مرحباً {name}،",
    intro: (d, n) => `زرت الصفحة الرئيسية لموقع ${d} ولاحظت ${n > 1 ? "نقطتين" : "نقطة واحدة"}:`,
    ask: "تصحيحها بسيط. هل تودون أن أرسل لكم التفاصيل؟",
    team: "Ibda3 Digital",
  },
};

/** The message: greeting with the business name from the CRM, the evidenced findings, one question, the sender. */
export function composeDraft(input: { language: DraftLanguage; businessName: string; domain: string; findings: UsedFinding[]; senderName: string }): string {
  const t = TEXT[input.language];
  const first = input.senderName.trim().split(/\s+/)[0] ?? "";
  const one = input.findings.length === 1;
  const ask = !one ? t.ask
    : input.language === "en" ? "It's simple to fix. Would you like me to send you the details?"
    : input.language === "fr" ? "C'est une correction simple. Voulez-vous que je vous envoie le détail ?"
    : t.ask;
  return [
    t.hello.replace("{name}", input.businessName.trim()),
    "",
    t.intro(input.domain, input.findings.length),
    ...input.findings.map((f) => `- ${f.sentence}`),
    "",
    ask,
    "",
    first ? `${first}, ${t.team}` : t.team,
  ].join("\n");
}

/* ───────────────── Gates ───────────────── */

export type DraftProspect = ProspectRow & {
  status: string;
  sector: string;
  neighborhood: string;
  sentAt: Date | string | null;
  /** Latest outreach message or send activity, if any. */
  lastSendAt: Date | string | null;
};

export type Blocker = { code: "NO_WEBSITE" | "ALREADY_CONTACTED" | "NO_VERIFIED_CHANNEL" | "POSSIBLE_DUPLICATE" | "CRM_NOT_CHECKED" | "SITE_NOT_READ" | "NO_EVIDENCED_FINDING"; message: string };

/**
 * Channels a person marked VERIFIED after opening the saved address in the contact check. A WhatsApp check
 * without a saved link was done on a bare phone number nobody opened here, so it doesn't count.
 */
export function verifiedChannels(p: Pick<DraftProspect, "whatsappStatus" | "instagramStatus" | "whatsappLink" | "phone" | "instagram">): SendChannel[] {
  const out: SendChannel[] = [];
  if (p.whatsappStatus === "VERIFIED" && contactOpenUrl("WHATSAPP", p.whatsappLink) && whatsappUrl(p)) out.push("WHATSAPP");
  if (p.instagramStatus === "VERIFIED" && contactOpenUrl("INSTAGRAM", p.instagram) && instagramUrl(p.instagram)) out.push("INSTAGRAM");
  return out;
}

/** Other prospects sharing this one's own number or Instagram account. The website is checked with the audit. */
export function ownContactMatches(p: DraftProspect, all: ProspectRow[]): ProspectMatch[] {
  // The shared classifier compares the last 9 digits, so raw numbers are enough.
  const phones = [p.phone, p.whatsappLink.replace(/\D/g, "")].filter((v) => v.replace(/\D/g, "").length >= 8);
  const ig = repairInstagram(p.instagram);
  return matchProspects({ websites: [], phones, instagramHandles: ig.valid ? [ig.handle] : [] }, all).filter((m) => m.prospectId !== p.id);
}

function duplicateBlocker(matches: ProspectMatch[]): Blocker | null {
  if (matches.length === 0) return null;
  const list = matches.slice(0, 3).map((m) => `${m.prospectName || "(no name)"} (${m.reasons.join(", ")})`).join("; ");
  return { code: "POSSIBLE_DUPLICATE", message: `This may be the same business as ${list}. Resolve that before writing to them.` };
}

/* ───────────────── The draft ───────────────── */

export type DraftResult =
  | { ok: false; blockers: Blocker[] }
  | {
    ok: true;
    language: DraftLanguage;
    channel: SendChannel;
    channels: SendChannel[];
    body: string;
    warnings: Warning[];
    findings: UsedFinding[];
    finalUrl: string;
  };

export type DraftDeps = QualifyDeps & {
  loadProspect?: (id: string) => Promise<DraftProspect | null>;
};

async function loadProspectFromDb(id: string): Promise<DraftProspect | null> {
  const { prisma } = await import("@/lib/prisma");
  const p = await prisma.prospect.findUnique({
    where: { id },
    select: {
      id: true, name: true, phone: true, email: true, website: true, instagram: true, whatsappLink: true,
      whatsappStatus: true, instagramStatus: true, status: true, sector: true, neighborhood: true, sentAt: true,
      outreachMessages: { select: { sentAt: true }, orderBy: { sentAt: "desc" }, take: 1 },
      activities: { where: { actionType: { in: ["SENT_WHATSAPP", "SENT_INSTAGRAM"] } }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!p) return null;
  const { outreachMessages, activities, ...row } = p;
  return { ...row, lastSendAt: latestSendAt([outreachMessages[0]?.sentAt, activities[0]?.createdAt]) };
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * Checks the gates that need no network first, then re-reads the saved website. Reads only: nothing is written,
 * nothing is sent, and no AI is called.
 */
export async function draftForProspect(
  prospectId: string,
  input: { language: DraftLanguage; channel?: SendChannel; senderName: string },
  deps: DraftDeps = {},
): Promise<DraftResult | null> {
  const p = await (deps.loadProspect ?? loadProspectFromDb)(prospectId);
  if (!p) return null;

  const blockers: Blocker[] = [];
  if (!p.website.trim()) blockers.push({ code: "NO_WEBSITE", message: "No website is saved for this prospect." });
  if (isContacted(p)) blockers.push({ code: "ALREADY_CONTACTED", message: "Already contacted. This draft is only for a first message." });
  const channels = verifiedChannels(p);
  const channel = input.channel ?? channels[0];
  if (!channel || !channels.includes(channel)) {
    blockers.push({ code: "NO_VERIFIED_CHANNEL", message: "No WhatsApp or Instagram contact marked VERIFIED from its saved link. Save the link, open it in Contact checks and check it first." });
  }
  if (blockers.length) return { ok: false, blockers };

  // One read of the CRM, used for both duplicate checks.
  let rows: ProspectRow[] | null = null;
  const loadProspects = async () => {
    rows = await (deps.loadProspects ?? (async () => (await import("@/lib/prisma")).prisma.prospect.findMany({
      select: { id: true, name: true, phone: true, email: true, website: true, instagram: true, whatsappLink: true, whatsappStatus: true, instagramStatus: true },
      take: 5000,
    })))();
    return rows;
  };

  const q = await qualifyWebsite(p.website, { fetcher: deps.fetcher, loadProspects });
  if (!q.duplicates.checked || !rows) return { ok: false, blockers: [{ code: "CRM_NOT_CHECKED", message: "The CRM couldn't be checked for duplicates, so no draft was made." }] };

  const seen = new Set<string>();
  const others = [...q.duplicates.matches.filter((m) => m.prospectId !== p.id), ...ownContactMatches(p, rows)]
    .filter((m) => (seen.has(m.prospectId) ? false : (seen.add(m.prospectId), true)));
  const dup = duplicateBlocker(others);
  if (dup) return { ok: false, blockers: [dup] };

  if (q.outcome !== "COMPLETE" || !q.finalUrl) {
    return { ok: false, blockers: [{ code: "SITE_NOT_READ", message: "The website couldn't be read well enough to say anything about it." }] };
  }
  const findings = pickFindings(q.problems, input.language);
  if (findings.length === 0) {
    return { ok: false, blockers: [{ code: "NO_EVIDENCED_FINDING", message: "The check found nothing a business owner would care about, so there's nothing honest to write." }] };
  }

  const body = composeDraft({ language: input.language, businessName: p.name, domain: host(q.finalUrl), findings, senderName: input.senderName });
  return {
    ok: true, language: input.language, channel: channel!, channels, body, findings, finalUrl: q.finalUrl,
    warnings: analyzeMessage(body, { name: p.name, sector: p.sector, neighborhood: p.neighborhood, instagram: p.instagram }),
  };
}
