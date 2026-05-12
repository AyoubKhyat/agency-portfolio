import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { HiOutlineCheck } from "react-icons/hi2";
import { FaExternalLinkAlt } from "react-icons/fa";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";

const SLUGS = ["hammam-nour", "goudoukh", "tannour", "terrene", "victory-path"] as const;
type CaseStudySlug = (typeof SLUGS)[number];

const BASE_URL = "https://ibda3-digital.vercel.app";

const PROJECT_DATA: Record<CaseStudySlug, { image: string; url: string }> = {
  "hammam-nour": { image: "/projects/hammam-nour.webp", url: "https://hammam-nour.vercel.app/" },
  goudoukh: { image: "/projects/goudoukh.webp", url: "https://goudoukh-luxury-cars.vercel.app/" },
  tannour: { image: "/projects/tannour.webp", url: "https://tannour.vercel.app/" },
  terrene: { image: "/projects/terrene.webp", url: "https://terrene.webyms.com/" },
  "victory-path": { image: "/projects/victory-path-v2.webp", url: "https://victory-path-beta.vercel.app/login" },
};

function CaseStudyJsonLd({ locale, slug, name, description }: { locale: string; slug: string; name: string; description: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url: `${BASE_URL}/${locale}/portfolio/${slug}`,
    image: `${BASE_URL}${PROJECT_DATA[slug as CaseStudySlug].image}`,
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!SLUGS.includes(slug as CaseStudySlug)) return {};
  const t = await getTranslations({ locale, namespace: "CaseStudy" });
  return {
    title: `${t(`${slug}_title`)} — Ibda3 Digital`,
    description: t(`${slug}_meta_desc`),
    alternates: {
      canonical: `${BASE_URL}/${locale}/portfolio/${slug}`,
      languages: {
        "x-default": `${BASE_URL}/fr/portfolio/${slug}`,
        fr: `${BASE_URL}/fr/portfolio/${slug}`,
        en: `${BASE_URL}/en/portfolio/${slug}`,
        ar: `${BASE_URL}/ar/portfolio/${slug}`,
      },
    },
    openGraph: {
      title: `${t(`${slug}_title`)} — Ibda3 Digital`,
      description: t(`${slug}_meta_desc`),
      images: [{ url: `${BASE_URL}${PROJECT_DATA[slug as CaseStudySlug].image}` }],
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

  if (!SLUGS.includes(slug as CaseStudySlug)) notFound();

  const t = await getTranslations({ locale, namespace: "CaseStudy" });
  const data = PROJECT_DATA[slug as CaseStudySlug];

  const features = t(`${slug}_features`).split(",").map((f) => f.trim());
  const steps = [1, 2, 3].map((n) => ({
    title: t(`${slug}_step${n}_title`),
    desc: t(`${slug}_step${n}_desc`),
  }));
  const tech = t(`${slug}_tech`).split(",").map((tool) => tool.trim());
  const results = [1, 2, 3].map((n) => ({
    value: t(`${slug}_result${n}_value`),
    label: t(`${slug}_result${n}_label`),
  }));

  return (
    <>
      <CaseStudyJsonLd
        locale={locale}
        slug={slug}
        name={t(`${slug}_title`)}
        description={t(`${slug}_meta_desc`)}
      />

      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] uppercase text-text-muted hover:text-primary transition-colors mb-8"
            >
              ← {t("back_to_portfolio")}
            </Link>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="pill">◆ {t(`${slug}_industry`)}</span>
              <span className="font-mono text-xs tracking-wider text-text-muted">{t(`${slug}_client`)}</span>
            </div>
            <h1 className="font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
              {t(`${slug}_title`)}
            </h1>
            <p className="mt-6 font-serif italic text-xl md:text-2xl text-primary max-w-xl">
              {t(`${slug}_tagline`)}
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-12 relative rounded-2xl overflow-hidden border border-line aspect-video">
              <Image
                src={data.image}
                alt={t(`${slug}_title`)}
                fill
                className="object-cover object-center"
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Challenge */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <FadeIn>
              <span className="pill">◆ {t("challenge_label")}</span>
              <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight">
                {t("challenge_label")}
              </h2>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="text-lg text-text-muted leading-relaxed">
                {t(`${slug}_challenge`)}
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="relative py-20 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <FadeIn>
              <span className="pill">◆ {t("solution_label")}</span>
              <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight">
                {t("solution_label")}
              </h2>
              <p className="mt-6 text-lg text-text-muted leading-relaxed">
                {t(`${slug}_solution`)}
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors active:scale-95"
              >
                {t("visit_site")} <FaExternalLinkAlt className="w-3.5 h-3.5" />
              </a>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Approach — 3 steps */}
      <section className="relative py-24 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-accent top-[30%] right-[-100px] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">→ {t("approach_label")}</span>
            <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight mb-16">
              {t("approach_label")}
            </h2>
          </FadeIn>
          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <StaggerItem key={i}>
                <div className="relative flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-full border border-primary text-primary bg-background flex items-center justify-center font-mono text-sm tracking-wider">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl text-foreground">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">◆ {t("features_label")}</span>
            <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight mb-12">
              {t("features_label")}
            </h2>
          </FadeIn>
          <StaggerContainer className="grid md:grid-cols-2 gap-4">
            {features.map((feat) => (
              <StaggerItem key={feat}>
                <div className="flex items-start gap-4 p-5 border border-line rounded-xl bg-surface-2 hover:border-primary/30 transition-colors">
                  <HiOutlineCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-text-muted leading-relaxed">{feat}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 bg-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-10">
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-text-muted">
              {t("tech_label")}
            </span>
          </FadeIn>
          <FadeIn delay={0.1} className="flex flex-wrap justify-center gap-3">
            {tech.map((tool) => (
              <span
                key={tool}
                className="px-4 py-2 border border-line rounded-full text-sm font-mono tracking-wider text-text-muted hover:border-primary/30 hover:text-primary transition-colors"
              >
                {tool}
              </span>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* Results */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary bottom-[-200px] left-[20%] opacity-15" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">◆ {t("results_label")}</span>
            <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight mb-16">
              {t("results_label")}
            </h2>
          </FadeIn>
          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {results.map((r, i) => (
              <StaggerItem key={i}>
                <div className="text-center p-8 border border-line rounded-2xl bg-surface-2">
                  <p className="font-serif text-5xl md:text-6xl text-primary">{r.value}</p>
                  <p className="mt-3 text-sm text-text-muted">{r.label}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <FadeIn className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-6xl text-background leading-tight">
            {t("cta_title")}
          </h2>
          <p className="mt-4 text-lg text-background/70">{t("cta_desc")}</p>
          <Link
            href="/contact"
            className="inline-block mt-8 px-10 py-4 bg-background text-foreground rounded-xl font-semibold hover:bg-background/90 transition-colors active:scale-95"
          >
            {t("cta_button")}
          </Link>
        </FadeIn>
      </section>
    </>
  );
}
