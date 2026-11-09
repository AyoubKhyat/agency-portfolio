/**
 * Clears AI Workforce run content that has passed its retention period (src/lib/ai-workforce/retention.ts):
 * content after 90 days, and the approved wording of SENT runs after 12 months. Usage and cost stay.
 *
 * DRY RUN BY DEFAULT: it only counts. Nothing is written without --apply. Run it by hand; it is not scheduled.
 *   AI_PRIVACY_DATABASE_URL=postgresql://... npx tsx scripts/redact-ai-runs.ts [--apply] [--allow-remote-host=<host>]
 *
 * It never reads DATABASE_URL, and it refuses any non-local host unless that exact host is passed.
 * Clearing can't be undone: take a Neon backup branch before the first --apply on production.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { applyRetention, checkMaintenanceDb } from "../src/lib/ai-workforce/retention";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const allowRemote = argv.find((a) => a.startsWith("--allow-remote-host="))?.split("=")[1];
const unknown = argv.filter((a) => a !== "--apply" && !a.startsWith("--allow-remote-host="));
if (unknown.length) {
  console.error(`ERROR: unknown option(s): ${unknown.join(" ")}`);
  process.exit(1);
}

const db = checkMaintenanceDb(process.env.AI_PRIVACY_DATABASE_URL ?? "", allowRemote);
if (!db.ok) {
  console.error(`ERROR: ${db.reason}.`);
  process.exit(1);
}
console.log(`Database host: ${db.host}${db.remote ? " (REMOTE, explicitly allowed)" : " (local)"}`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.AI_PRIVACY_DATABASE_URL! }) });

async function main() {
  try {
    const { applied, counts, cutoffs } = await applyRetention(prisma, { apply });
    console.log(`Content cutoff: before ${cutoffs.content.toISOString()} | SENT wording cutoff: before ${cutoffs.sentWording.toISOString()}`);
    const verb = applied ? "" : "would be ";
    console.log(`  ${counts.expired} actionable run(s) ${verb}expired`);
    console.log(`  ${counts.contentCleared} run(s) ${verb}cleared of content`);
    console.log(`  ${counts.unsentWordingCleared} unsent run(s) ${verb}cleared of approved wording`);
    console.log(`  ${counts.sentWordingCleared} SENT run(s) ${verb}cleared of approved wording`);
    console.log(applied ? "Done." : "Dry run: nothing was written. Re-run with --apply to clear.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
