/**
 * Client testimonials on the homepage: only quotes explicitly approved for publication.
 *
 * The quote is written per locale in the admin (Projects → "Client testimonial",
 * ProjectTranslation.testimonial). That field alone is NOT approval: it has no
 * author, no consent record and can be filled in by anyone with admin access.
 * A quote is shown only when ALL of these hold:
 *   - its project is a visible CLIENT project (never a concept),
 *   - the project is listed in APPROVED_TESTIMONIALS below, with the author's
 *     name, their role for that locale and the date the client approved it,
 *   - the stored quote for that locale is not empty.
 *
 * Adding an entry is a reviewed code change, made only with the client's
 * written permission to publish the exact quote, name and role. The list is
 * empty: no testimonial is approved yet, so the homepage section is hidden.
 * (Earlier invented testimonials were removed in d434799; never restore them.)
 */
import { isClientProject } from "./project-kind";

type Locale = "fr" | "en" | "ar";

export type TestimonialApproval = {
  /** Project.slug of the client project the quote belongs to. */
  slug: string;
  /** The person quoted, exactly as they approved it. */
  author: string;
  /** Their role per locale; a locale without a role is not approved. */
  roles: Partial<Record<Locale, string>>;
  /** When the client approved publication (YYYY-MM-DD). */
  approvedOn: string;
};

export const APPROVED_TESTIMONIALS: readonly TestimonialApproval[] = [];

export type Testimonial = { slug: string; project: string; quote: string; author: string; role: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function approvedTestimonials(
  projects: readonly { slug: string; kind?: string | null; title: string; testimonial?: string | null }[],
  locale: string,
  approvals: readonly TestimonialApproval[] = APPROVED_TESTIMONIALS,
): Testimonial[] {
  const out: Testimonial[] = [];
  for (const a of approvals) {
    const role = a.roles[locale as Locale]?.trim();
    const author = a.author.trim();
    if (!role || !author || !DATE.test(a.approvedOn) || Number.isNaN(Date.parse(a.approvedOn))) continue;
    const p = projects.find((x) => x.slug === a.slug);
    const quote = p?.testimonial?.trim();
    if (!p || !isClientProject(p) || !quote) continue;
    out.push({ slug: p.slug, project: p.title, quote, author, role });
  }
  return out;
}
