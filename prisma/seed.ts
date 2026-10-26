import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import en from "../src/messages/en.json";
import fr from "../src/messages/fr.json";
import ar from "../src/messages/ar.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TEAM_MEMBERS = [
  { fullName: "Ayoub Khyat", email: "ayoubkhyat@gmail.com", role: "admin", avatarInitials: "AK" },
  { fullName: "Mohammed Yousfi", email: "mohammed.yousfi@ibda3digital.com", role: "sales", avatarInitials: "MY" },
  { fullName: "Ismail Sarhir", email: "ismail.sarhir@ibda3digital.com", role: "sales", avatarInitials: "IS" },
  { fullName: "Soufiane El Kaabaoui", email: "soufiane.elkaabaoui@ibda3digital.com", role: "sales", avatarInitials: "SE" },
  { fullName: "Abderrahmane Ait Taleb", email: "abderrahmane.aittaleb@ibda3digital.com", role: "developer", avatarInitials: "AA" },
];

const PROJECTS = [
  { slug: "hammam-nour", category: "web", url: "https://hammam-nour.vercel.app/", image: "/projects/hammam-nour.webp", tag: "Spa & Wellness", key: "project11" },
  { slug: "goudoukh", category: "web", url: "https://goudoukh-luxury-cars.vercel.app/", image: "/projects/goudoukh.webp", tag: "Luxury car rental", key: "project9" },
  { slug: "tannour", category: "web", url: "https://tannour.vercel.app/", image: "/projects/tannour.webp", tag: "E-commerce", key: "project10" },
  { slug: "terrene", category: "web", url: "https://terrene.webyms.com/", image: "/projects/terrene.webp", tag: "Architecture studio", key: "project7" },
  { slug: "victory-path", category: "app", url: "https://victory-path-beta.vercel.app/login", image: "/projects/victory-path-v2.webp", tag: "Web app", key: "project8" },
  { slug: "aylani-parfums", category: "web", url: "https://aylani-parfums.vercel.app", image: "/projects/aylani-parfums.webp", tag: "E-commerce Parfums", key: "project12" },
];

function getTranslation(
  messages: Record<string, Record<string, string>>,
  key: string,
  slug: string
) {
  const p = messages.Portfolio;
  const c = messages.CaseStudy;
  return {
    title: p[`${key}_title`] || slug,
    desc: p[`${key}_desc`] || "",
    tags: p[`${key}_tags`] || "",
    tagline: c[`${slug}_tagline`] || null,
    metaDesc: c[`${slug}_meta_desc`] || null,
    client: c[`${slug}_client`] || null,
    industry: c[`${slug}_industry`] || null,
    challenge: c[`${slug}_challenge`] || null,
    solution: c[`${slug}_solution`] || null,
    step1Title: c[`${slug}_step1_title`] || null,
    step1Desc: c[`${slug}_step1_desc`] || null,
    step2Title: c[`${slug}_step2_title`] || null,
    step2Desc: c[`${slug}_step2_desc`] || null,
    step3Title: c[`${slug}_step3_title`] || null,
    step3Desc: c[`${slug}_step3_desc`] || null,
    features: c[`${slug}_features`] || null,
    tech: c[`${slug}_tech`] || null,
    result1Value: c[`${slug}_result1_value`] || null,
    result1Label: c[`${slug}_result1_label`] || null,
    result2Value: c[`${slug}_result2_value`] || null,
    result2Label: c[`${slug}_result2_label`] || null,
    result3Value: c[`${slug}_result3_value`] || null,
    result3Label: c[`${slug}_result3_label`] || null,
  };
}

async function main() {
  console.log("Seeding database...");

  // Team members (new User model). Passwords are never seeded: existing rows keep theirs and new
  // rows get a random unusable hash. Set real passwords with the admin "reset password" action.
  for (const member of TEAM_MEMBERS) {
    const unusableHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
    await prisma.user.upsert({
      where: { email: member.email },
      update: { fullName: member.fullName, role: member.role, avatarInitials: member.avatarInitials },
      create: {
        fullName: member.fullName,
        email: member.email,
        passwordHash: unusableHash,
        role: member.role,
        avatarInitials: member.avatarInitials,
      },
    });
    console.log(`  User: ${member.fullName} (${member.email}) — role: ${member.role}`);
  }

  // Legacy admin user (keep for backward compat). Only from env; there is no default password.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && adminPassword.length >= 12) {
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: { passwordHash: adminHash },
      create: { email: adminEmail, passwordHash: adminHash, name: "Ayoub Khyat" },
    });
  } else {
    console.log("  Skip admin login: set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) to create it.");
  }

  // Projects
  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i];
    const existing = await prisma.project.findUnique({ where: { slug: p.slug } });

    if (existing) {
      console.log(`  Skip (exists): ${p.slug}`);
      continue;
    }

    await prisma.project.create({
      data: {
        slug: p.slug,
        category: p.category,
        url: p.url,
        image: p.image,
        tag: p.tag,
        visible: true,
        sortOrder: i,
        translations: {
          create: [
            { locale: "en", ...getTranslation(en as never, p.key, p.slug) },
            { locale: "fr", ...getTranslation(fr as never, p.key, p.slug) },
            { locale: "ar", ...getTranslation(ar as never, p.key, p.slug) },
          ],
        },
      },
    });
    console.log(`  Created: ${p.slug}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
