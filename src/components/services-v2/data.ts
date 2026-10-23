// Comparison matrix for the services that have a detail page, in catalog order
// (DETAIL_PAGE_IDS in src/lib/services-catalog.ts; tests keep the two in sync).
export const SERVICE_KEYS = ["web", "ecommerce", "mobile", "seo", "maintenance"] as const;

export const FEATURES = [
  { key: "custom_design", included: [true, true, true, false, false] },
  { key: "responsive", included: [true, true, true, false, false] },
  { key: "cms", included: [true, true, false, false, true] },
  { key: "seo_optimization", included: [true, true, false, true, false] },
  { key: "payment", included: [false, true, false, false, false] },
  { key: "analytics", included: [true, true, true, true, true] },
  { key: "ssl", included: [true, true, false, false, true] },
  { key: "push_notifications", included: [false, false, true, false, false] },
  { key: "performance", included: [true, true, true, true, true] },
  { key: "ongoing_support", included: [false, false, false, true, true] },
  { key: "backups", included: [false, false, false, false, true] },
  { key: "security_monitoring", included: [false, false, false, false, true] },
] as const;

export const num = (i: number) => String(i + 1).padStart(2, "0");
