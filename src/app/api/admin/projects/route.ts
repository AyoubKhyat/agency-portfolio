import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectsForAdmin, createProject } from "@/lib/dal";
import { z } from "zod";

const translationSchema = z.object({
  locale: z.string(),
  title: z.string(),
  desc: z.string(),
  tags: z.string().optional().default(""),
  tagline: z.string().optional().default(""),
  metaDesc: z.string().optional().default(""),
  client: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  challenge: z.string().optional().default(""),
  solution: z.string().optional().default(""),
  step1Title: z.string().optional().default(""),
  step1Desc: z.string().optional().default(""),
  step2Title: z.string().optional().default(""),
  step2Desc: z.string().optional().default(""),
  step3Title: z.string().optional().default(""),
  step3Desc: z.string().optional().default(""),
  features: z.string().optional().default(""),
  tech: z.string().optional().default(""),
  result1Value: z.string().optional().default(""),
  result1Label: z.string().optional().default(""),
  result2Value: z.string().optional().default(""),
  result2Label: z.string().optional().default(""),
  result3Value: z.string().optional().default(""),
  result3Label: z.string().optional().default(""),
});

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

const createSchema = z.object({
  slug: z.string().optional().default(""),
  category: z.enum(["web", "app", "plugin", "ecommerce"]),
  url: z.string().optional().default(""),
  image: z.string().optional().default(""),
  tag: z.string().optional().default(""),
  visible: z.boolean().optional().default(true),
  translations: z.array(translationSchema).min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await getProjectsForAdmin();
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msgs = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`);
    return NextResponse.json({ error: msgs.join("; ") || "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  const firstWithTitle = data.translations.find((t) => t.title.trim());
  if (!firstWithTitle) {
    return NextResponse.json({ error: "At least one translation must have a title" }, { status: 400 });
  }

  if (!data.slug || !data.slug.match(/^[a-z0-9-]+$/)) {
    data.slug = slugify(firstWithTitle.title);
  }

  if (!data.slug) {
    return NextResponse.json({ error: "Could not generate a valid slug" }, { status: 400 });
  }

  const allLocales = ["fr", "en", "ar"];
  const filledTranslations = allLocales.map((locale) => {
    const existing = data.translations.find((t) => t.locale === locale);
    if (existing && existing.title.trim()) return existing;
    return { ...firstWithTitle, locale };
  });

  const project = await createProject({
    ...data,
    translations: filledTranslations,
  });
  return NextResponse.json(project, { status: 201 });
}
