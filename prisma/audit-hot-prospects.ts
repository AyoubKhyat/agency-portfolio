/**
 * Quick audit: pull 20 random HOT prospects + summary stats on contact data.
 * Run: npx tsx prisma/audit-hot-prospects.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const all = await prisma.prospect.findMany({
    select: {
      id: true, name: true, phone: true, whatsappLink: true,
      instagram: true, website: true, email: true,
      qualityLabel: true, score: true, scoreLabel: true,
    },
  });

  const counts = {
    total: all.length,
    HOT: all.filter((p) => p.qualityLabel === "HOT").length,
    WARM: all.filter((p) => p.qualityLabel === "WARM").length,
    COLD: all.filter((p) => p.qualityLabel === "COLD").length,
    nullLabel: all.filter((p) => !p.qualityLabel).length,
  };
  console.log("=== Counts ===");
  console.log(counts);

  const hot = all.filter((p) => p.qualityLabel === "HOT");
  const hotWithoutPhone = hot.filter((p) => !p.phone || !p.phone.trim());
  const hotWithoutWhatsapp = hot.filter((p) => !p.whatsappLink || !p.whatsappLink.trim());
  const hotWithoutInsta = hot.filter((p) => !p.instagram || !p.instagram.trim());
  const hotWithoutAnyContact = hot.filter((p) =>
    (!p.phone || !p.phone.trim()) &&
    (!p.whatsappLink || !p.whatsappLink.trim()) &&
    (!p.instagram || !p.instagram.trim())
  );
  const hotPhoneButNoWhatsapp = hot.filter((p) =>
    p.phone && p.phone.trim() && (!p.whatsappLink || !p.whatsappLink.trim())
  );

  console.log("\n=== HOT issues ===");
  console.log(`HOT prospects:                       ${hot.length}`);
  console.log(`HOT without phone:                   ${hotWithoutPhone.length}`);
  console.log(`HOT without whatsappLink:            ${hotWithoutWhatsapp.length}`);
  console.log(`HOT without instagram:               ${hotWithoutInsta.length}`);
  console.log(`HOT WITHOUT ANY CONTACT (broken!):   ${hotWithoutAnyContact.length}`);
  console.log(`HOT phone-but-no-whatsappLink (FIXABLE): ${hotPhoneButNoWhatsapp.length}`);

  console.log("\n=== 20 random HOT prospects ===");
  const sample = [...hot].sort(() => Math.random() - 0.5).slice(0, 20);
  for (const p of sample) {
    console.log(JSON.stringify({
      id: p.id.slice(0, 10),
      name: p.name.slice(0, 30),
      phone: p.phone || "—",
      whatsapp: p.whatsappLink ? p.whatsappLink.slice(0, 40) : "—",
      instagram: p.instagram || "—",
      website: p.website || "—",
      qualityLabel: p.qualityLabel,
      score: p.score,
    }));
  }

  if (hotWithoutAnyContact.length > 0) {
    console.log("\n=== Broken HOT (no contact at all) ===");
    for (const p of hotWithoutAnyContact.slice(0, 10)) {
      console.log({ id: p.id, name: p.name, phone: p.phone, whatsapp: p.whatsappLink, instagram: p.instagram });
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
