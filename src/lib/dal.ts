/**
 * Data access layer, split by domain under ./dal/. This file only re-exports, so existing
 * `@/lib/dal` imports keep working; new code can import the domain module it needs.
 */
export * from "./dal/projects";
export * from "./dal/leads";
export * from "./dal/users";
export * from "./dal/prospects";
export * from "./dal/stats";
