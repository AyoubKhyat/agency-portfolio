/**
 * Erases one enquiry on request (src/lib/ai-workforce/retention.ts): clears and unlinks its AI runs, deletes
 * the lead, its notes and the notifications pointing at it, and writes an ERASE_LEAD audit entry holding
 * only IDs and counts. All or nothing.
 * Run rows stay, without content, so spend caps keep counting them.
 *
 * Owner only: OWNER_USER_ID must name an active user whose email is the one passed with --owner.
 * DRY RUN BY DEFAULT: it only shows what would happen. Nothing is written without --apply.
 *   AI_PRIVACY_DATABASE_URL=postgresql://... OWNER_USER_ID=<id> \
 *     npx tsx scripts/erase-lead.ts --lead <leadId> --owner <owner email> [--apply] [--allow-remote-host=<host>]
 *
 * It never reads DATABASE_URL, and it refuses any non-local host unless that exact host is passed.
 * Erasure can't be undone. Copies elsewhere (the EmailJS email, mailboxes, WhatsApp, backups) are not reached.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkMaintenanceDb, eraseLead, planLeadErasure, verifyOwner } from "../src/lib/ai-workforce/retention";

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const opts: Record<string, string | true> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) die(`unexpected argument: ${a}`);
  const [k, v] = a.slice(2).split("=", 2);
  if (v !== undefined) opts[k] = v;
  else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) opts[k] = argv[++i];
  else opts[k] = true;
}
const unknown = Object.keys(opts).filter((k) => !["lead", "owner", "apply", "allow-remote-host"].includes(k));
if (unknown.length) die(`unknown option(s): ${unknown.map((k) => `--${k}`).join(" ")}`);

const leadId = typeof opts.lead === "string" ? opts.lead : die("--lead <leadId> is required.");
const ownerEmail = typeof opts.owner === "string" ? opts.owner : die("--owner <owner email> is required.");
const apply = opts.apply === true;

const db = checkMaintenanceDb(process.env.AI_PRIVACY_DATABASE_URL ?? "", typeof opts["allow-remote-host"] === "string" ? opts["allow-remote-host"] : undefined);
if (!db.ok) die(`${db.reason}.`);
console.log(`Database host: ${db.host}${db.remote ? " (REMOTE, explicitly allowed)" : " (local)"}`);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.AI_PRIVACY_DATABASE_URL! }) });

async function main() {
  try {
    const owner = await verifyOwner(prisma, ownerEmail, process.env.OWNER_USER_ID);
    if (!owner.ok) die(`not allowed: ${owner.reason}.`);

    const plan = await planLeadErasure(prisma, leadId);
    if (!plan.found) die(`no lead with id ${leadId}.`);
    console.log(`Lead ${leadId}: ${plan.runs} AI run(s) to clear and unlink, ${plan.notes} note(s) and ${plan.notifications} notification(s) to delete.`);
    if (plan.runsInFlight > 0) die("an AI run for this lead is still in progress. Wait 5 minutes and try again.");

    if (!apply) {
      console.log("Dry run: nothing was written. Re-run with --apply to erase.");
      return;
    }
    const result = await eraseLead(prisma, leadId, owner.owner);
    if (!result.ok) die(result.code === "not_found" ? "the lead was already removed." : "an AI run for this lead started meanwhile. Try again in 5 minutes.");
    console.log(`Erased: lead deleted, ${result.notesDeleted} note(s) and ${result.notificationsDeleted} notification(s) deleted, ${result.runsCleared} AI run(s) cleared and unlinked.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
