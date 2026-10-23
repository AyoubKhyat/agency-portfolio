/**
 * Thin wrappers around the Notification model that handle deduping recipients,
 * @mention fan-out, and the common "don't ping yourself" rule.
 */

import { prisma, hasPrisma } from "@/lib/prisma";
import { extractMentions, type MentionableUser } from "@/lib/mentions";

export type NotifyPayload = {
  type: string;       // MENTION | TASK_ASSIGNED | TASK_DUE | CLIENT_STATUS | PROPOSAL_ACCEPTED | etc.
  title: string;
  body?: string | null;
  link?: string | null;
};

/** Send to a single user. Silent if Prisma is unavailable or ID is empty. */
export async function notifyUser(userId: string | null | undefined, data: NotifyPayload) {
  if (!userId || !hasPrisma()) return;
  try {
    await prisma.notification.create({
      data: { userId, type: data.type, title: data.title, body: data.body ?? null, link: data.link ?? null },
    });
  } catch {
    // swallow — notifications shouldn't break the underlying action
  }
}

/** Send to a list of users, dedup'd. */
export async function notifyUsers(userIds: string[], data: NotifyPayload) {
  if (!hasPrisma()) return;
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((id) => ({ userId: id, type: data.type, title: data.title, body: data.body ?? null, link: data.link ?? null })),
    });
  } catch {
    // swallow
  }
}

/**
 * In-app alert for a new website inquiry: to the team member it was assigned
 * to, or to every active admin when nobody was assigned. Idempotent per lead
 * (keyed on the lead's admin link), so a retried request never alerts twice.
 * Returns how many users were notified.
 */
export async function notifyNewLead(lead: {
  id: string;
  fullName: string;
  subject: string;
  assignedToId?: string | null;
}): Promise<number> {
  if (!hasPrisma()) return 0;
  const link = `/admin/leads/${lead.id}`;
  try {
    const already = await prisma.notification.count({ where: { type: "NEW_LEAD", link } });
    if (already > 0) return 0;
    const recipients = lead.assignedToId
      ? [lead.assignedToId]
      : (
          await prisma.user.findMany({
            where: { isActive: true, role: { in: ["admin", "Admin"] } },
            select: { id: true },
          })
        ).map((u) => u.id);
    const ids = Array.from(new Set(recipients.filter(Boolean)));
    if (ids.length === 0) return 0;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: "NEW_LEAD",
        title: `Nouvelle demande : ${lead.subject}`,
        body: `${lead.fullName} — formulaire de contact du site`,
        link,
      })),
    });
    return ids.length;
  } catch {
    return 0;
  }
}

/**
 * Parse @mentions out of `content`, resolve to user IDs and fire a notification
 * for each. Excludes the author so writers don't ping themselves.
 */
export async function notifyMentionsInText(args: {
  content: string;
  authorId: string;
  authorName: string;
  link: string;
  contextLabel: string; // e.g. "Luxury Copro" or "Aylani Parfums prospect"
}) {
  if (!hasPrisma()) return [];
  const users: MentionableUser[] = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, avatarInitials: true },
  });
  const { mentionedUserIds } = extractMentions(args.content, users, args.authorId);
  if (mentionedUserIds.length === 0) return [];
  await notifyUsers(mentionedUserIds, {
    type: "MENTION",
    title: `${args.authorName} mentioned you in ${args.contextLabel}`,
    body: args.content.slice(0, 200),
    link: args.link,
  });
  return mentionedUserIds;
}
