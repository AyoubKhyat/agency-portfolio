import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/motion";
import ServicesV2 from "@/components/services-v2/ServicesV2";
import { localeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return {
    title: `${t("title")} — Ibda3 Digital`,
    description: t("subtitle"),
    alternates: localeAlternates(locale, "/services"),
  };
}

function FaqJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function ServicesPage() {
  const t = useTranslations("Services");

  const faqItems = [1, 2, 3, 4, 5].map((n) => ({
    question: t(`faq${n}_q`),
    answer: t(`faq${n}_a`),
  }));

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">◆ {t("title")}</span>
          </FadeIn>
          <FadeIn delay={0.15}>
            <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[132px] leading-[0.95] tracking-tight text-foreground max-w-[1200px]">
              {t("hero_headline")}
            </h1>
          </FadeIn>
        </div>
      </section>

      <ServicesV2 faqItems={faqItems} />
      <FaqJsonLd items={faqItems} />
    </>
  );
}
