/**
 * Client testimonials on the homepage: only quotes an admin explicitly approved for publication.
 *
 * Testimonials are managed in Ibda3 OS (Projects → Edit → Testimonial; rules in
 * lib/testimonial-approval). A filled-in quote is NOT approval: a locale is published only
 * after an admin approves its exact quote, role and author, with a consent reference on
 * file, and any later edit revokes it. getPublishedTestimonials (lib/dal) already returns
 * approved rows only; this module re-checks every row before anything reaches the page:
 *   - the project is a visible CLIENT project (never a concept),
 *   - the locale has an approval date,
 *   - the quote, the author and the role are present and within the limits.
 * No approved testimonial: the homepage section is not rendered at all.
 * (Earlier invented testimonials were removed in d434799; never restore them.)
 */
import { isClientProject } from "./project-kind";
import { TESTIMONIAL_LIMITS } from "./testimonial-approval";

export type PublishedTestimonialInput = {
  slug: string;
  kind?: string | null;
  visible?: boolean;
  project: string;
  author: string | null;
  role: string | null;
  quote: string | null;
  approvedAt: Date | string | null;
};

export type Testimonial = { slug: string; project: string; quote: string; author: string; role: string };

export function publicTestimonials(rows: readonly PublishedTestimonialInput[]): Testimonial[] {
  const out: Testimonial[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const quote = r.quote?.trim() ?? "";
    const author = r.author?.trim() ?? "";
    const role = r.role?.trim() ?? "";
    const approved = r.approvedAt != null && !Number.isNaN(new Date(r.approvedAt).getTime());
    if (!approved || r.visible !== true || !isClientProject(r) || seen.has(r.slug)) continue;
    if (!quote || !author || !role) continue;
    if (quote.length > TESTIMONIAL_LIMITS.quote || author.length > TESTIMONIAL_LIMITS.author || role.length > TESTIMONIAL_LIMITS.role) continue;
    seen.add(r.slug);
    out.push({ slug: r.slug, project: r.project, quote, author, role });
  }
  return out;
}
