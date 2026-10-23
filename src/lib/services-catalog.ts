/**
 * The single list of what Ibda3 Digital offers. The homepage, Services page,
 * service detail routes, footer, contact form, assistant and structured data
 * all read from here, so a service is added or renamed in one place.
 *
 * Wording lives in the `Services` messages namespace as `<msg>_title`,
 * `<msg>_subtitle`, `<msg>_desc` and `<msg>_features`; group wording as
 * `group_<msg>_title` and `group_<msg>_desc`. Safe to import from client components.
 */

export const SERVICE_GROUPS = [
  { id: "web-digital", msg: "web_digital" },
  { id: "growth", msg: "growth" },
  { id: "creative", msg: "creative" },
] as const;

export type ServiceGroupId = (typeof SERVICE_GROUPS)[number]["id"];

export const SERVICES = [
  { id: "web", group: "web-digital", msg: "web", detailPage: true, schemaName: "Website Development" },
  { id: "ecommerce", group: "web-digital", msg: "ecommerce", detailPage: true, schemaName: "E-commerce Development" },
  { id: "mobile", group: "web-digital", msg: "mobile", detailPage: true, schemaName: "Web & Mobile Application Development" },
  { id: "booking", group: "web-digital", msg: "booking", detailPage: false, schemaName: "Booking & Reservation Systems" },
  { id: "automation", group: "web-digital", msg: "automation", detailPage: false, schemaName: "Business Process Automation" },
  { id: "ai", group: "web-digital", msg: "ai", detailPage: false, schemaName: "AI Solutions" },
  { id: "seo", group: "growth", msg: "seo", detailPage: true, schemaName: "SEO" },
  { id: "maintenance", group: "growth", msg: "maintenance", detailPage: true, schemaName: "Website Maintenance & Technical Support" },
  { id: "video-editing", group: "creative", msg: "video", detailPage: false, schemaName: "Video Editing" },
  { id: "reels-editing", group: "creative", msg: "reels", detailPage: false, schemaName: "Reels Editing" },
  { id: "graphic-design", group: "creative", msg: "graphic", detailPage: false, schemaName: "Graphic Design" },
] as const satisfies readonly { id: string; group: ServiceGroupId; msg: string; detailPage: boolean; schemaName: string }[];

export type Service = (typeof SERVICES)[number];
export type ServiceId = Service["id"];

/** Services that have their own /services/<id> page, in Services-page order. */
export const DETAIL_PAGE_IDS = SERVICES.filter((s): s is Extract<Service, { detailPage: true }> => s.detailPage).map((s) => s.id);
export type DetailPageId = (typeof DETAIL_PAGE_IDS)[number];

const BY_ID = new Map<string, Service>(SERVICES.map((s) => [s.id, s]));

export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === "string" && BY_ID.has(value);
}

export function getService(id: ServiceId): Service {
  return BY_ID.get(id)!;
}

export function servicesInGroup(group: ServiceGroupId): Service[] {
  return SERVICES.filter((s) => s.group === group);
}

/** Where a service links: its detail page, or its card on the Services page. */
export function serviceHref(id: ServiceId): string {
  return getService(id).detailPage ? `/services/${id}` : `/services#svc-${id}`;
}

export function groupHref(group: ServiceGroupId): string {
  return `/services#group-${group}`;
}

/** Contact form with the service preselected (see parseServiceParam). */
export function contactHref(id: ServiceId): string {
  return `/contact?service=${id}`;
}

/**
 * Validate a `?service=` value. Anything unknown, malformed or repeated yields
 * null, which means "nothing preselected".
 */
export function parseServiceParam(value: unknown): ServiceId | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const id = value.trim().toLowerCase();
  return isServiceId(id) ? id : null;
}
