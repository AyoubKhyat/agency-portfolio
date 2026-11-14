/** Server wiring for the Daily Lead Agent: the real list, CRM, store and the cron secret check. */
import { createHash, timingSafeEqual } from "node:crypto";
import { runDailyLeads, type RunReport } from "@/lib/daily-leads";
import { prismaDailyStore } from "@/lib/daily-leads-store";
import { loadDataset } from "@/lib/osm-dataset";
import { loadCrmFromDb } from "@/lib/batch-discovery";

export const MIN_SECRET_LENGTH = 16;

/**
 * True only for `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends). Fails closed when the secret is
 * missing or too short. Compared in constant time on hashes, so the length isn't revealed either.
 */
export function cronAuthorized(header: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || !header) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(header), h(`Bearer ${secret}`));
}

export function runDailyLeadsNow(opts: { retry: boolean }): Promise<RunReport> {
  return runDailyLeads({ store: prismaDailyStore, dataset: loadDataset, loadCrm: loadCrmFromDb, retry: opts.retry });
}
