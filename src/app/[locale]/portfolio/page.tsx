import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PortfolioV2 from "@/components/portfolio-v2/PortfolioV2";
import { pageMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Portfolio" });
  return pageMetadata({ locale, path: "/portfolio", title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") });
}

// The previous grid (src/components/PortfolioGrid.tsx) is kept for rollback.
export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PortfolioV2 locale={locale} />;
}
