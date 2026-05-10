import { use } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HiOutlineCheck } from "react-icons/hi2";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";

const SLUGS = ["web", "ecommerce", "mobile", "seo", "maintenance"] as const;
type Slug = (typeof SLUGS)[number];

export async function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!SLUGS.includes(slug as Slug)) return {};
  const t = await getTranslations({ locale, namespace: "ServiceDetail" });
  return {
    title: `${t(`${slug}_title`)} — Ibda3 Digital`,
    description: t(`${slug}_intro`),
  };
}

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  if (!SLUGS.includes(slug as Slug)) notFound();

  const t = useTranslations("ServiceDetail");
  const nav = useTranslations("Nav");

  const features = t(`${slug}_features`).split(",").map((f) => f.trim());
  const steps = [1, 2, 3].map((n) => ({
    title: t(`${slug}_step${n}_title`),
    desc: t(`${slug}_step${n}_desc`),
  }));
  const tools = t(`${slug}_tools`).split(",").map((tool) => tool.trim());

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] uppercase text-text-muted hover:text-primary transition-colors mb-8"
            >
              ← {nav("services")}
            </Link>
            <h1 className="font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
              {t(`${slug}_title`)}
            </h1>
            <p className="mt-6 font-serif italic text-xl md:text-2xl text-primary max-w-xl">
              {t(`${slug}_tagline`)}
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="mt-8 text-lg text-text-muted leading-relaxed max-w-3xl">
              {t(`${slug}_intro`)}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <FadeIn>
              <span className="pill">◆ {t("features_label")}</span>
              <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight">
                {t(`${slug}_features_title`)}
              </h2>
            </FadeIn>
            <StaggerContainer className="space-y-4">
              {features.map((feat) => (
                <StaggerItem key={feat}>
                  <div className="flex items-start gap-4 p-5 border border-line rounded-xl bg-background hover:border-primary/30 transition-colors">
                    <HiOutlineCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-muted leading-relaxed">{feat}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-accent top-[30%] right-[-100px] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">→ {t("process_label")}</span>
            <h2 className="mt-8 font-serif text-4xl md:text-6xl text-foreground leading-tight mb-16">
              {t("process_title")}
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

      {/* Tools */}
      <section className="py-16 bg-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-10">
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-text-muted">
              {t("tools_label")}
            </span>
          </FadeIn>
          <FadeIn delay={0.1} className="flex flex-wrap justify-center gap-3">
            {tools.map((tool) => (
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
