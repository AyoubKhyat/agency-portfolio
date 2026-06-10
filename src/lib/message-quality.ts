/**
 * Heuristic quality checks for outreach messages.
 * Run client-side before logging. User can override.
 *
 * Goal: surface the obvious failure modes (generic, salesy, no personalization)
 * BEFORE the message is sent — most of these we can't fix server-side because
 * the user may edit the AI-generated text.
 */

export type WarningKind =
  | "too_long"
  | "too_short"
  | "missing_business_name"
  | "missing_specific_observation"
  | "too_generic"
  | "too_salesy"
  | "emoji_spam";

export type Warning = {
  kind: WarningKind;
  label: string;
  detail?: string;
  severity: "error" | "warn";
};

export type ProspectSignals = {
  name: string;
  sector?: string | null;
  neighborhood?: string | null;
  instagram?: string | null;
};

// Phrases that signal generic agency-pitch copy. Multilingual.
const GENERIC_PATTERNS = [
  /\bnous sommes une agence\b/i,
  /\bagence (web|digitale|de marketing)\b/i,
  /\bnotre agence\b/i,
  /\bwe are an agency\b/i,
  /\bour agency\b/i,
  /\bI hope this (message|finds you)\b/i,
  /\bj'espère que (vous allez bien|ce message vous trouve)\b/i,
  /\bj'aimerais vous présenter\b/i,
  /\bI'd like to introduce\b/i,
  /\bnous nous spécialisons\b/i,
  /\bwe specialize\b/i,
];

// Phrases that signal a sales pitch in the first message.
const SALESY_PATTERNS = [
  /\bdevis gratuit\b/i,
  /\bpromotion\b/i,
  /\boffre spéciale\b/i,
  /\bréduction\b/i,
  /\bnos services\b/i,
  /\bnos tarifs\b/i,
  /\bour services\b/i,
  /\bour pricing\b/i,
  /\bwe offer\b/i,
  /\bnous proposons\b/i,
  /\bsouhaitez-vous une démo\b/i,
  /\bwould you like a demo\b/i,
  /\bbook a (call|demo|meeting)\b/i,
  /\bréserver un rendez-vous\b/i,
  /\bplease let me know if you are interested\b/i,
  /\bn'hésitez pas à me contacter\b/i,
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countEmojis(text: string): number {
  const m = text.match(
    /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu
  );
  return m ? m.length : 0;
}

function mentionsSignal(text: string, prospect: ProspectSignals): boolean {
  const lower = text.toLowerCase();
  const checks: string[] = [];
  if (prospect.sector) checks.push(prospect.sector.toLowerCase());
  if (prospect.neighborhood) checks.push(prospect.neighborhood.toLowerCase());
  if (prospect.instagram) {
    checks.push(prospect.instagram.replace(/^@/, "").toLowerCase());
  }
  return checks.some((c) => c.length > 2 && lower.includes(c));
}

function mentionsName(text: string, name: string): boolean {
  if (!name) return true;
  const lower = text.toLowerCase();
  // Match the business name OR its first significant word (handles "Lkasmi & Co" → "lkasmi")
  if (lower.includes(name.toLowerCase())) return true;
  const firstWord = name.split(/\s+/).find((w) => w.length > 2);
  if (firstWord && lower.includes(firstWord.toLowerCase())) return true;
  return false;
}

export function analyzeMessage(body: string, prospect: ProspectSignals): Warning[] {
  const warnings: Warning[] = [];
  const wc = wordCount(body);

  if (wc > 130) {
    warnings.push({
      kind: "too_long",
      label: "Too long",
      detail: `${wc} words — keep it under 120 for outreach.`,
      severity: "warn",
    });
  }
  if (wc < 15) {
    warnings.push({
      kind: "too_short",
      label: "Too short",
      detail: `${wc} words — needs more context to land.`,
      severity: "warn",
    });
  }

  if (!mentionsName(body, prospect.name)) {
    warnings.push({
      kind: "missing_business_name",
      label: "Missing business name",
      detail: `"${prospect.name}" isn't mentioned.`,
      severity: "error",
    });
  }

  if (!mentionsSignal(body, prospect)) {
    warnings.push({
      kind: "missing_specific_observation",
      label: "No specific observation",
      detail: "Doesn't reference sector, neighborhood, or Instagram.",
      severity: "warn",
    });
  }

  const genericHits = GENERIC_PATTERNS.filter((p) => p.test(body));
  if (genericHits.length > 0) {
    warnings.push({
      kind: "too_generic",
      label: "Too generic",
      detail: "Contains agency-pitch boilerplate.",
      severity: "warn",
    });
  }

  const salesyHits = SALESY_PATTERNS.filter((p) => p.test(body));
  if (salesyHits.length > 0) {
    warnings.push({
      kind: "too_salesy",
      label: "Too salesy",
      detail: "Reads like a pitch, not a conversation opener.",
      severity: "warn",
    });
  }

  const emojiCount = countEmojis(body);
  if (emojiCount > 3) {
    warnings.push({
      kind: "emoji_spam",
      label: "Too many emojis",
      detail: `${emojiCount} emojis — keep it to 1.`,
      severity: "warn",
    });
  }

  return warnings;
}

export function hasBlockingError(warnings: Warning[]): boolean {
  return warnings.some((w) => w.severity === "error");
}
