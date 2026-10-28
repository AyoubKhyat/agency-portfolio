/**
 * Import the 30-day Instagram calendar into the Content Planner (content_posts).
 *
 * DRY RUN BY DEFAULT: parses the file, shows every post it would create and changes nothing.
 *
 *   npx tsx scripts/import-content-calendar.ts --file <calendar.csv|.json> --start YYYY-MM-DD \
 *     [--time 18:00] [--tz +01:00] [--prefix ibda3-30d] [--by "Ibda3 import"] [--apply]
 *
 * Columns and mapping: src/lib/content-calendar-import.ts (example: scripts/content-calendar.example.csv).
 *
 * Database safety:
 * - The target is CONTENT_IMPORT_DATABASE_URL only. This script never reads DATABASE_URL and never
 *   loads .env, so it cannot reach the production database by default.
 * - Only localhost / 127.0.0.1 / ::1 are accepted. Any other host additionally needs
 *   --allow-remote-host=<that exact host name>, a deliberate, separately approved step.
 * - --apply only creates rows. Rows whose source key already exists are skipped; nothing is updated,
 *   deleted or published (the import can never produce PUBLISHED).
 * - Without CONTENT_IMPORT_DATABASE_URL the dry run works offline.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  applyCalendarImport,
  planCalendarImport,
  readCalendar,
  type ImportStore,
} from "../src/lib/content-calendar-import";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function args(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const opt = args(process.argv.slice(2));
const str = (k: string, fallback?: string) => (typeof opt[k] === "string" ? (opt[k] as string) : fallback);

const file = str("file") ?? die("--file <calendar.csv|calendar.json> is required.");
const startDate = str("start") ?? die("--start YYYY-MM-DD (the date of Day 1) is required.");
const apply = opt.apply === true;
const kind = extname(file).toLowerCase() === ".json" ? "json" : "csv";

/* ---------- plan ---------- */

let records: Record<string, string>[];
try {
  records = readCalendar(readFileSync(file, "utf8"), kind);
} catch (e) {
  die(`Could not read ${file}: ${e instanceof Error ? e.message : String(e)}`);
}

const plan = planCalendarImport(records, {
  startDate,
  defaultTime: str("time", "18:00")!,
  tzOffset: str("tz", "+01:00")!,
  keyPrefix: str("prefix", "ibda3-30d")!,
});

console.log(`Calendar: ${file} (${records.length} rows) — Day 1 = ${startDate}`);
for (const p of plan.posts) {
  const when = p.data.plannedAt!.toISOString().replace(".000Z", "Z");
  console.log(`  ${p.sourceKey.padEnd(28)} ${when}  ${p.data.format.padEnd(8)} ${p.data.status.padEnd(9)} ${p.data.title}`);
  for (const w of p.warnings) console.log(`      ! ${w}`);
}
if (plan.errors.length) {
  console.error(`\n${plan.errors.length} error(s) — nothing can be imported until they are fixed:`);
  for (const e of plan.errors) console.error(`  - ${e}`);
  process.exit(1);
}
const flagged = plan.posts.filter((p) => p.sourceSaysPublished);
if (flagged.length) {
  console.log(`\n${flagged.length} post(s) marked published in the source are imported as NOT published; confirm each in the planner:`);
  for (const p of flagged) console.log(`  - ${p.sourceKey}  ${p.data.title}`);
}

/* ---------- database (optional for a dry run) ---------- */

const url = process.env.CONTENT_IMPORT_DATABASE_URL ?? "";
if (!url) {
  if (apply) die("--apply needs CONTENT_IMPORT_DATABASE_URL (this script never uses DATABASE_URL).");
  console.log(`\nDry run, offline: ${plan.posts.length} post(s) would be created. Nothing was written.`);
  process.exit(0);
}

let host = "";
try {
  host = new URL(url).hostname;
} catch {
  die("CONTENT_IMPORT_DATABASE_URL is not a valid URL.");
}
const allowedRemote = str("allow-remote-host");
if (!LOCAL_HOSTS.has(host) && allowedRemote !== host) {
  die(`Refusing non-local database host "${host}". Pass --allow-remote-host=${host} only with explicit approval.`);
}
console.log(`\nDatabase host: ${host}${LOCAL_HOSTS.has(host) ? " (local)" : " (REMOTE, explicitly allowed)"}`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const store: ImportStore = {
  existingKeys: async (keys) =>
    (await prisma.contentPost.findMany({ where: { sourceKey: { in: keys } }, select: { sourceKey: true } }))
      .map((r) => r.sourceKey)
      .filter((k): k is string => k !== null),
  createMany: async (rows) => (await prisma.contentPost.createMany({ data: rows, skipDuplicates: true })).count,
};

async function main() {
  try {
    if (!apply) {
      const existing = new Set(await store.existingKeys(plan.posts.map((p) => p.sourceKey)));
      const fresh = plan.posts.filter((p) => !existing.has(p.sourceKey)).length;
      console.log(`Dry run: ${fresh} post(s) would be created, ${existing.size} already exist and would be skipped. Nothing was written.`);
      console.log("Re-run with --apply to create them.");
    } else {
      const result = await applyCalendarImport(store, plan, str("by", "Calendar import")!);
      console.log(`Created ${result.created} post(s); skipped ${result.skipped.length} that already existed.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
