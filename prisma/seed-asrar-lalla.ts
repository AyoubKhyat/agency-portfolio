import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import en from "../src/messages/en.json";
import fr from "../src/messages/fr.json";
import ar from "../src/messages/ar.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SLUG = "asrar-lalla";
const KEY = "project14";

function getTranslation(messages: Record<string, Record<string, string>>) {
  const p = messages.Portfolio;
  const c = messages.CaseStudy;
  return {
    title: p[`${KEY}_title`] || SLUG,
    desc: p[`${KEY}_desc`] || "",
    tags: p[`${KEY}_tags`] || "",
    tagline: c[`${SLUG}_tagline`] || null,
    metaDesc: c[`${SLUG}_meta_desc`] || null,
    client: c[`${SLUG}_client`] || null,
    industry: c[`${SLUG}_industry`] || null,
    challenge: c[`${SLUG}_challenge`] || null,
    solution: c[`${SLUG}_solution`] || null,
    step1Title: c[`${SLUG}_step1_title`] || null,
    step1Desc: c[`${SLUG}_step1_desc`] || null,
    step2Title: c[`${SLUG}_step2_title`] || null,
    step2Desc: c[`${SLUG}_step2_desc`] || null,
    step3Title: c[`${SLUG}_step3_title`] || null,
    step3Desc: c[`${SLUG}_step3_desc`] || null,
    features: c[`${SLUG}_features`] || null,
    tech: c[`${SLUG}_tech`] || null,
    result1Value: c[`${SLUG}_result1_value`] || null,
    result1Label: c[`${SLUG}_result1_label`] || null,
    result2Value: c[`${SLUG}_result2_value`] || null,
    result2Label: c[`${SLUG}_result2_label`] || null,
    result3Value: c[`${SLUG}_result3_value`] || null,
    result3Label: c[`${SLUG}_result3_label`] || null,
  };
}

async function main() {
  const existing = await prisma.project.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Already exists: ${SLUG} (id=${existing.id})`);
    return;
  }

  const maxOrder = await prisma.project.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const created = await prisma.project.create({
    data: {
      slug: SLUG,
      category: "web",
      url: "https://asrar-lalla.vercel.app/",
      image: "/projects/asrar-lalla.webp",
      tag: "E-commerce Beauté",
      visible: true,
      sortOrder,
      translations: {
        create: [
          { locale: "en", ...getTranslation(en as never) },
          { locale: "fr", ...getTranslation(fr as never) },
          { locale: "ar", ...getTranslation(ar as never) },
        ],
      },
    },
  });

  console.log(`Created: ${created.slug} (id=${created.id}, sortOrder=${sortOrder})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
