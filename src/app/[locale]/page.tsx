import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import HomeV2 from "@/components/home-v2/HomeV2";
import { localeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return {
    title: t("meta_title"),
    description: t("hero_subtitle"),
    alternates: localeAlternates(locale),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <HomeV2 locale={locale} />;
}
