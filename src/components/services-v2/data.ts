// Comparison matrix for the services that have a detail page, in catalog order
// (DETAIL_PAGE_IDS in src/lib/services-catalog.ts; tests keep the two in sync).
// Column titles come from Services.<msg>_title (see getService).
export const SERVICE_KEYS = ["web", "ecommerce", "mobile", "seo", "maintenance", "website-repair"] as const;

// Website repair is a one-time project: no ongoing support, backups or monitoring
// (that is Maintenance), and no new custom design or CMS from scratch.
export const FEATURES = [
  { key: "custom_design", included: [true, true, true, false, false, false] },
  { key: "responsive", included: [true, true, true, false, false, true] },
  { key: "cms", included: [true, true, false, false, true, false] },
  { key: "seo_optimization", included: [true, true, false, true, false, false] },
  { key: "payment", included: [false, true, false, false, false, false] },
  { key: "analytics", included: [true, true, true, true, true, false] },
  { key: "ssl", included: [true, true, false, false, true, false] },
  { key: "push_notifications", included: [false, false, true, false, false, false] },
  { key: "performance", included: [true, true, true, true, true, true] },
  { key: "ongoing_support", included: [false, false, false, true, true, false] },
  { key: "backups", included: [false, false, false, false, true, false] },
  { key: "security_monitoring", included: [false, false, false, false, true, false] },
] as const;

export const num = (i: number) => String(i + 1).padStart(2, "0");
