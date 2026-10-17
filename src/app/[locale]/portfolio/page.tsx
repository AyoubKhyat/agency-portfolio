import type { Metadata } from "next";
import PortfolioV2 from "@/components/portfolio-v2/PortfolioV2";
import { localeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale, "/portfolio") };
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
