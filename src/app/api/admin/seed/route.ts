import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import ar from "@/messages/ar.json";
import { withApiLogging } from "@/lib/api-logger";

const TEAM = [
  { name: "Ayoub Khyat", email: "ayoubkhyat@gmail.com", role: "admin", initials: "AK" },
  { name: "Mohammed Yousfi", email: "mohammed.yousfi@ibda3digital.com", role: "sales", initials: "MY" },
  { name: "Ismail Sarhir", email: "ismail.sarhir@ibda3digital.com", role: "sales", initials: "IS" },
  { name: "Soufiane El Kaabaoui", email: "soufiane.elkaabaoui@ibda3digital.com", role: "sales", initials: "SE" },
  { name: "Abderrahmane Ait Taleb", email: "abderrahmane.aittaleb@ibda3digital.com", role: "sales", initials: "AA" },
];

const CHANNELS = [
  { slug: "general", name: "General", description: "Discussion générale de l'équipe" },
  { slug: "projects", name: "Projets", description: "Suivi et coordination des projets" },
  { slug: "sales", name: "Ventes", description: "Pipeline commercial et prospection" },
];

const PROJECTS = [
  { slug: "hammam-nour", category: "web", url: "https://hammam-nour.vercel.app/", image: "/projects/hammam-nour.webp", tag: "Spa & Wellness", key: "project11" },
  { slug: "goudoukh", category: "web", url: "https://goudoukh-luxury-cars.vercel.app/", image: "/projects/goudoukh.webp", tag: "Luxury car rental", key: "project9" },
  { slug: "tannour", category: "web", url: "https://tannour.vercel.app/", image: "/projects/tannour.webp", tag: "E-commerce", key: "project10" },
  { slug: "terrene", category: "web", url: "https://terrene.webyms.com/", image: "/projects/terrene.webp", tag: "Architecture studio", key: "project7" },
  { slug: "victory-path", category: "app", url: "https://victory-path-beta.vercel.app/login", image: "/projects/victory-path-v2.webp", tag: "Web app", key: "project8" },
  { slug: "aylani-parfums", category: "web", url: "https://aylani-parfums.vercel.app", image: "/projects/aylani-parfums.webp", tag: "E-commerce Parfums", key: "project12" },
  { slug: "luxury-copro", category: "web", url: "https://luxurycopro.webyms.com/", image: "/projects/luxury-copro.webp", tag: "Immobilier", key: "project13" },
];

function getTranslation(messages: Record<string, Record<string, string>>, key: string, slug: string) {
  const p = messages.Portfolio ?? {};
  const c = messages.CaseStudy ?? {};
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

async function seedHandler(req: Request) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const password = body.password;
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Provide a password in request body" }, { status: 400 });
  }

  const results: string[] = [];

  for (const m of TEAM) {
    const hash = await bcrypt.hash(password, 12);

    await prisma.adminUser.upsert({
      where: { email: m.email },
      update: { passwordHash: hash, name: m.name },
      create: { email: m.email, passwordHash: hash, name: m.name },
    });

    try {
      await prisma.user.upsert({
        where: { email: m.email },
        update: { passwordHash: hash, fullName: m.name, role: m.role, avatarInitials: m.initials },
        create: { email: m.email, passwordHash: hash, fullName: m.name, role: m.role, avatarInitials: m.initials },
      });
      results.push(`${m.name} (${m.role})`);
    } catch (e) {
      results.push(`Error: ${m.name} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Seed default chat channels with all team members
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const channelResults: string[] = [];

  for (const ch of CHANNELS) {
    const existing = await prisma.channel.findUnique({ where: { slug: ch.slug } });
    if (existing) {
      channelResults.push(`#${ch.slug} (exists)`);
      continue;
    }

    await prisma.channel.create({
      data: {
        slug: ch.slug,
        name: ch.name,
        description: ch.description,
        isDm: false,
        members: {
          create: allUsers.map((u) => ({ userId: u.id })),
        },
      },
    });
    channelResults.push(`#${ch.slug} (created, ${allUsers.length} members)`);
  }

  // Seed portfolio projects with translations
  const projectResults: string[] = [];
  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i];
    const existing = await prisma.project.findUnique({ where: { slug: p.slug } });
    if (existing) {
      projectResults.push(`${p.slug} (exists)`);
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
        status: "PUBLISHED",
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
    projectResults.push(`${p.slug} (created)`);
  }

  return NextResponse.json({ results, channels: channelResults, projects: projectResults, seeded: results.length });
}

export const POST = withApiLogging("POST /api/admin/seed", seedHandler);
