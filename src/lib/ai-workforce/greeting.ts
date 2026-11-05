/**
 * The one decision about addressing a visitor by name. The greeting, the server's approval check and the
 * panel's warning all use it, so a draft is only required to mention a name when its greeting used one.
 * No database or server imports: the panel runs this in the browser.
 */

/** Titles and name particles. The word after them is the name, and greeting someone by these reads wrong. */
const NOT_A_FIRST_NAME = new Set([
  "mme", "mlle", "madame", "mademoiselle", "monsieur", "docteur", "professeur", "maitre", "maître",
  "mrs", "miss", "madam", "mister", "doctor", "prof", "professor", "sir",
  "abd", "abu", "abou", "ben", "bin", "ibn", "ould", "ait", "aït", "del", "des", "van", "von",
  "السيد", "السيدة", "الدكتور", "الدكتورة", "دكتور", "دكتورة", "الأستاذ", "الأستاذة", "أستاذ", "أستاذة",
  "عبد", "أبو", "ابو", "ابن",
]);

const PLAIN_NAME = /^[\p{L}\p{M}][\p{L}\p{M}'’-]{0,39}$/u;
const MIN_LETTERS = 3;

/**
 * The visitor's first name, or null when one can't be taken reliably from what they typed. Names shorter than
 * three letters are refused too: most are particles or titles ("El Mehdi", "Dr Sara"), and a neutral greeting
 * costs a real "Li" far less than "Bonjour El," costs everyone else.
 */
export function firstNameFrom(fullName: string): string | null {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (!PLAIN_NAME.test(first)) return null;
  if ((first.match(/\p{L}/gu) ?? []).length < MIN_LETTERS) return null;
  if (NOT_A_FIRST_NAME.has(first.normalize("NFC").toLowerCase())) return null;
  return first;
}

/** The name a draft has to mention to pass the quality check. Empty, meaning none, after a neutral greeting. */
export function requiredDraftName(fullName: string): string {
  return firstNameFrom(fullName) ?? "";
}
