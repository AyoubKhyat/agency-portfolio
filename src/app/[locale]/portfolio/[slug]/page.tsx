import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProjectDetailV2 from "@/components/project-detail-v2/ProjectDetailV2";
import { getProjectBySlug } from "@/lib/dal";
import { CLIENT_SLUGS } from "@/lib/homepage-clients";
import { SITE_URL, localeAlternates, localeUrl } from "@/lib/site";

const BASE_URL = SITE_URL;

function CaseStudyJsonLd({ locale, slug, name, description, image }: { locale: string; slug: string; name: string; description: string; image: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url: `${BASE_URL}/${locale}/portfolio/${slug}`,
    image: `${BASE_URL}${image}`,
    creator: {
      "@type": "ProfessionalService",
      name: "Ibda3 Digital",
      url: `${BASE_URL}/${locale}`,
      telephone: "+212625461645",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Marrakech",
        addressCountry: "MA",
      },
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

type Project = NonNullable<Awaited<ReturnType<typeof getProjectBySlug>>>;

// SEO title/description. Concepts are labelled as concepts and described by their neutral portfolio
// description (metaDesc reads like a client commission: "Comment nous avons créé … pour …").
async function seoText(project: Project, locale: string) {
  const tr = project.translation!;
  if (CLIENT_SLUGS.has(project.slug)) {
    return { title: `${tr.title} — Ibda3 Digital`, description: tr.metaDesc || tr.desc };
  }
  const cs = await getTranslations({ locale, namespace: "CaseStudy" });
  const home = await getTranslations({ locale, namespace: "HomeV2" });
  return {
    title: `${tr.title} (${home("tag_concept")}) — Ibda3 Digital`,
    description: [cs("concept_meta"), tr.desc].filter(Boolean).join(" "),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug, locale);
  if (!project || !project.translation) return {};

  const seo = await seoText(project, locale);

  return {
    title: seo.title,
    description: seo.description,
    alternates: localeAlternates(locale, `/portfolio/${slug}`),
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: localeUrl(locale, `/portfolio/${slug}`),
      images: [{ url: `${BASE_URL}${project.image}` }],
      type: "article",
    },
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const project = await getProjectBySlug(slug, locale);
  if (!project || !project.translation) notFound();
  const tr = project.translation;
  const seo = await seoText(project, locale);

  return (
    <>
      <CaseStudyJsonLd
        locale={locale}
        slug={slug}
        name={tr.title}
        description={seo.description}
        image={project.image}
      />

      {/* Same box as the layout instance, which is a flex item of <body> (shrink-wrapped, centred). */}
      <div className="flex flex-col">
        <Breadcrumbs projectTitle={tr.title} />
      </div>
      <ProjectDetailV2 project={project} locale={locale} />
    </>
  );
}
