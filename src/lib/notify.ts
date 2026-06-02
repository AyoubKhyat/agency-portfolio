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
