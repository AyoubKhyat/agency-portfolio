/**
 * How a website finding is presented on a Today's leads card: a short title, what was seen, and a cautious
 * "may" impact. Presentation only: which findings exist, and their evidence, come from the P6A check unchanged.
 * Nothing here claims a measured loss; a speed figure is always one check. Client-safe (no server imports).
 */

export type IssueGroup = "CUSTOMER" | "TECHNICAL";
export type IssueCopy = { group: IssueGroup; title: string; explanation: string; impact: string | null };

type Finding = { id: string; sentence: string; observed: string };

const seconds = (observed: string) => {
  const ms = /^(\d{1,7}) ms$/.exec(observed);
  return ms ? (Number(ms[1]) / 1000).toFixed(1) : null;
};

const COPY: Record<string, (f: Finding) => IssueCopy> = {
  E_HTTPS: () => ({
    group: "CUSTOMER", title: "Not secure (no HTTPS)",
    explanation: "The site opened over plain http, so browsers can label it “Not secure”.",
    impact: "Some visitors may hesitate to book, call or share details.",
  }),
  E_VIEWPORT: () => ({
    group: "CUSTOMER", title: "Not set up for phones",
    explanation: "The page doesn't tell phones how to size it, so it may appear zoomed out on mobile.",
    impact: "Mobile visitors may find it harder to read.",
  }),
  E_CONTACT: () => ({
    group: "CUSTOMER", title: "No contact option on the home page",
    explanation: "No contact form, email, phone or WhatsApp link was found on the home page.",
    impact: "Interested visitors may not see an easy way to get in touch.",
  }),
  E_RESPONSE_TIME: (f) => {
    const s = seconds(f.observed);
    return {
      group: "CUSTOMER", title: "Slow to respond in one check",
      explanation: s ? `The home page took about ${s} s to respond in a single check. Speed can vary.` : "The home page was slow to respond in a single check. Speed can vary.",
      impact: "If this is typical, some visitors may leave before it loads.",
    };
  },
  E_DESCRIPTION: () => ({
    group: "TECHNICAL", title: "No Google description",
    explanation: "No meta description was found, so Google chooses the text shown under the link.",
    impact: "The search listing may read less clearly.",
  }),
  E_TITLE: () => ({
    group: "TECHNICAL", title: "No page title",
    explanation: "No title was found for the browser tab and search results.",
    impact: "Tabs and search results may show a generic name.",
  }),
  E_OPEN_GRAPH: () => ({
    group: "TECHNICAL", title: "No link preview for sharing",
    explanation: "No preview image or title is set for links shared on WhatsApp or Facebook.",
    impact: "Shared links may look plain.",
  }),
  E_HTTP_REDIRECT: () => ({
    group: "TECHNICAL", title: "http:// doesn't forward to https",
    explanation: "The http:// address answered directly instead of sending visitors to the secure version.",
    impact: "Old links may keep visitors on the insecure version.",
  }),
};

/** Unknown finding ids fall back to the check's own sentence, with no impact line: nothing is made up. */
export function issueCopy(f: Finding): IssueCopy {
  const make = COPY[f.id];
  if (make) return make(f);
  const s = f.sentence.trim();
  return { group: "TECHNICAL", title: s ? s.charAt(0).toUpperCase() + s.slice(1) : f.id, explanation: "", impact: null };
}

/** Customer-facing first, then minor technical/SEO, each keeping the check's own order. */
export function groupIssues<T extends Finding>(findings: readonly T[]) {
  const all = findings.map((f) => ({ finding: f, copy: issueCopy(f) }));
  return {
    customer: all.filter((x) => x.copy.group === "CUSTOMER"),
    technical: all.filter((x) => x.copy.group === "TECHNICAL"),
  };
}

export const KNOWN_ISSUE_IDS = Object.keys(COPY);
