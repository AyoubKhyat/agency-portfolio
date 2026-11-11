/**
 * A person's check of a prospect's WhatsApp or Instagram contact.
 *
 * Nothing here probes Instagram or WhatsApp: both answer 200 to real and made-up accounts, and Instagram's
 * robots.txt disallows automated reading. A person opens the link and records what they saw, using the prospect's
 * existing status fields. The prospect activity log keeps who checked and when.
 *
 *   VERIFIED    — opened, and it matches this business
 *   UNAVAILABLE — opened, but it can't be used (page not available, wrong business, not on WhatsApp)
 *   UNVERIFIED  — not checked yet
 *
 * FOUND_ON_SITE (from /admin/qualify) is never stored on a prospect: it only means a website links to it.
 */
export type ContactChannel = "WHATSAPP" | "INSTAGRAM";
export type ContactCheckStatus = "UNVERIFIED" | "VERIFIED" | "UNAVAILABLE";

const NAME: Record<ContactChannel, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };

const ACTION: Record<ContactChannel, Record<ContactCheckStatus, string>> = {
  WHATSAPP: { VERIFIED: "CONFIRMED_WHATSAPP", UNAVAILABLE: "UNAVAILABLE_WHATSAPP", UNVERIFIED: "UNCONFIRMED_WHATSAPP" },
  INSTAGRAM: { VERIFIED: "CONFIRMED_INSTAGRAM", UNAVAILABLE: "UNAVAILABLE_INSTAGRAM", UNVERIFIED: "UNCONFIRMED_INSTAGRAM" },
};

export const CHECK_TEXT: Record<ContactCheckStatus, string> = {
  VERIFIED: "Opened: it matches this business",
  UNAVAILABLE: "Opened: not usable",
  UNVERIFIED: "Not checked yet",
};

/** How each check reads in a prospect's activity history. */
export const CONTACT_CHECK_LABELS: Record<string, string> = {
  CONFIRMED_WHATSAPP: "opened WhatsApp: matches the business", UNAVAILABLE_WHATSAPP: "opened WhatsApp: not usable", UNCONFIRMED_WHATSAPP: "cleared the WhatsApp check",
  CONFIRMED_INSTAGRAM: "opened Instagram: matches the business", UNAVAILABLE_INSTAGRAM: "opened Instagram: not usable", UNCONFIRMED_INSTAGRAM: "cleared the Instagram check",
};

/** The activity row that records a person's check: the audit record of who, what and when. */
export function contactCheckActivity(channel: ContactChannel, previous: string | null | undefined, next: ContactCheckStatus) {
  return {
    actionType: ACTION[channel][next],
    previousStatus: previous ?? "UNVERIFIED",
    newStatus: next,
    details: `${NAME[channel]}: ${next === "UNVERIFIED" ? "check cleared" : CHECK_TEXT[next].toLowerCase()}`,
  };
}

type ActivityLike = { actionType: string; userName: string; createdAt: string | Date; newStatus?: string | null };

/** The latest recorded check of this channel, or null when no one has checked it. */
export function lastContactCheck(activities: ActivityLike[], channel: ContactChannel) {
  const types = new Set(Object.values(ACTION[channel]));
  const latest = activities
    .filter((a) => types.has(a.actionType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return latest ? { userName: latest.userName, at: new Date(latest.createdAt).toISOString(), status: latest.newStatus ?? null } : null;
}

/** The address a person should open to check. Only links we can rebuild on the real hosts; never a number from a phone field. */
export function contactOpenUrl(channel: ContactChannel, value: string): string | null {
  if (channel === "INSTAGRAM") {
    const handle = value.trim().replace(/^@/, "");
    return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
  }
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "");
    return url.protocol === "https:" && (host === "wa.me" || host === "api.whatsapp.com") ? url.toString() : null;
  } catch {
    return null;
  }
}
