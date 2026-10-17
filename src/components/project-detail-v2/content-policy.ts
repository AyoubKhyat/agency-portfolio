// What the case-study page may present as fact. The database content is never changed; these
// rules only decide what is displayed until the owner verifies or rewrites it in the admin.

/** Projects whose Results & Impact figures are documented and verified. Empty until verified:
 *  no figure (performance score, load time, business outcome) is shown as an established result. */
export const VERIFIED_RESULTS: ReadonlySet<string> = new Set<string>([]);

export type CaseField = "challenge" | "solution" | "step1" | "step2" | "step3";

/** Concept projects: statements that claim real-world delivery or a real business's situation,
 *  which a concept cannot support. Withheld in every locale (the translations carry the same claim). */
export const WITHHELD: Readonly<Record<string, Partial<Record<CaseField, string>>>> = {
  "hammam-nour": {
    step1: "Claims on-site photography of the hammam.",
    step3: "Claims a launch with SEO targeting wellness tourism.",
  },
  goudoukh: {
    challenge: "Describes the business's existing online presence and clientele.",
  },
  "asrar-lalla": {
    challenge: "States that the brand wanted to digitise its business.",
    step3: "Claims cash-on-delivery, national delivery and customer reviews were set up.",
  },
};

export function isWithheld(slug: string, field: CaseField) {
  return Boolean(WITHHELD[slug]?.[field]);
}
