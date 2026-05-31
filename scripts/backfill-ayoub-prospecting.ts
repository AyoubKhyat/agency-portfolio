import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL not set.");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const CONTACTED_STATUSES = [
  "ENVOYE",
  "ENVOYÉ",
  "SENT",
  "CONTACTED",
  "REPONDU",
  "RÉPONDU",
  "REPLIED",
  "CONVERTI",
  "CONVERTED",
  "PAS_DE_WHATSAPP",
  "PAS DE WHATSAPP",
  "NO WHATSAPP",
  "NO_WHATSAPP",
];

const BACKFILL_ACTION_TYPE = "BACKFILL_OWNERSHIP";
const BACKFILL_DETAIL = "Historical prospecting action attributed to Ayoub Khyat before team launch.";

async function main() {
  console.log("=== Backfill Ayoub Khyat Prospecting Ownership ===\n");

  const ayoub = await prisma.user.findUnique({
    where: { email: "ayoubkhyat@gmail.com" },
  });

  if (!ayoub) {
    console.error("ERROR: User ayoubkhyat@gmail.com not found in users table.");
    console.error("Make sure the user exists before running this script.");
    process.exit(1);
  }

  console.log(`Found user: ${ayoub.fullName} (${ayoub.id}), role: ${ayoub.role}\n`);

  const prospects = await prisma.prospect.findMany({
    where: {
      status: { in: CONTACTED_STATUSES },
    },
    include: {
      activities: {
        where: { actionType: BACKFILL_ACTION_TYPE },
        select: { id: true },
      },
    },
  });

  console.log(`Found ${prospects.length} contacted prospects to process.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const p of prospects) {
    if (p.activities.length > 0) {
      skipped++;
      continue;
    }

    try {
      const contactedAt = p.sentAt || p.contactedAt || new Date();

      await prisma.prospect.update({
        where: { id: p.id },
        data: {
          ownerUserId: ayoub.id,
          sentByUserId: ayoub.id,
          sentByName: ayoub.fullName,
          contactedByUserId: ayoub.id,
          contactedByName: ayoub.fullName,
          contactedAt: contactedAt,
          lastActionByUserId: ayoub.id,
          lastActionByName: ayoub.fullName,
          lastActionAt: contactedAt,
          sentAt: p.sentAt || contactedAt,
        },
      });

      await prisma.prospectActivity.create({
        data: {
          prospectId: p.id,
          userId: ayoub.id,
          userName: ayoub.fullName,
          actionType: BACKFILL_ACTION_TYPE,
          details: BACKFILL_DETAIL,
        },
      });

      updated++;
      if (updated % 25 === 0) console.log(`  ... ${updated}/${prospects.length - skipped} updated`);
    } catch (err) {
      errors++;
      console.error(`ERROR updating prospect "${p.name}" (${p.id}):`, err);
    }
  }

  console.log("\n=== Results ===");
  console.log(`Updated:  ${updated}`);
  console.log(`Skipped:  ${skipped} (already backfilled)`);
  console.log(`Errors:   ${errors}`);
  console.log(`Total:    ${prospects.length}`);

  const uncontacted = await prisma.prospect.count({
    where: { status: "A_ENVOYER" },
  });
  console.log(`\nUncontacted "A_ENVOYER" prospects (untouched): ${uncontacted}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  prisma.$disconnect();
  process.exit(1);
});
