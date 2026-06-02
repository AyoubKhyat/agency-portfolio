/**
 * @-mention parsing + handle resolution.
 *
 * Handles are computed from a user's first name, lowercased, with diacritics
 * stripped, non-alphanumeric chars removed. "Ayoub Khyat" → "ayoub".
 * Ambiguities are resolved by full-name fallback ("ismailb" → user whose
 * lowercased fullName starts with that).
 */

export type MentionableUser = {
  id: string;
  fullName: string;
  avatarInitials?: string;
};

function strip(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

export function handleForUser(u: { fullName: string }): string {
  const first = u.fullName.trim().split(/\s+/)[0] ?? "";
  return strip(first);
}

export function userMatchesHandle(u: { fullName: string }, handle: string): boolean {
  const h = strip(handle);
  if (!h) return false;
  if (handleForUser(u) === h) return true;
  // Allow last-name and combined matches as fallback.
  const collapsed = strip(u.fullName);
  return collapsed.startsWith(h);
}

const MENTION_REGEX = /@([a-zA-Z0-9_-]+)/g;

/**
 * Pull `@handles` out of free text and resolve to user IDs.
 * Excludes the author from notifications so writers don't ping themselves.
 */
export function extractMentions(
  text: string,
  users: MentionableUser[],
  authorId?: string | null,
): { mentionedUserIds: string[]; mentionedHandles: string[] } {
  if (!text) return { mentionedUserIds: [], mentionedHandles: [] };
  const seenIds = new Set<string>();
  const handles: string[] = [];
  for (const m of text.matchAll(MENTION_REGEX)) {
    const raw = m[1];
    handles.push(raw);
    const match = users.find((u) => userMatchesHandle(u, raw));
    if (match && match.id !== authorId) seenIds.add(match.id);
  }
  return { mentionedUserIds: Array.from(seenIds), mentionedHandles: handles };
}

/**
 * Find users matching a partial @-handle prefix (used by the autocomplete UI).
 */
export function suggestForPrefix(
  users: MentionableUser[],
  prefix: string,
  limit = 6,
): MentionableUser[] {
  const p = strip(prefix);
  if (!p) return users.slice(0, limit);
  return users
    .filter((u) => {
      const h = handleForUser(u);
      const full = strip(u.fullName);
      return h.startsWith(p) || full.startsWith(p) || full.includes(p);
    })
    .slice(0, limit);
}
