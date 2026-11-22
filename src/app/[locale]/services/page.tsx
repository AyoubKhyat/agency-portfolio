import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import ServicesV2 from "@/components/services-v2/ServicesV2";
import { pageMetadata } from "@/lib/site";
import { serializeJsonLd } from "@/lib/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return pageMetadata({ locale, path: "/services", title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") });
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
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
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
      {/* The hero (label row + serif h1, HomeV2 scaffolding) is rendered inside ServicesV2's .root. */}
      <ServicesV2 faqItems={faqItems} />
      <FaqJsonLd items={faqItems} />
    </>
  );
}
