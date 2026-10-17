import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/site";
import PrivacyV2 from "@/components/privacy-v2/PrivacyV2";

// DRAFT: keep false until the owner and a legal adviser have approved the text. While false
// the page shows a draft notice, is noindex and stays out of the sitemap.
const PRIVACY_POLICY_APPROVED = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return {
    ...pageMetadata({ locale, path: "/privacy", title: t("meta_title"), description: t("meta_desc") }),
    ...(PRIVACY_POLICY_APPROVED ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PrivacyV2 locale={locale} draft={!PRIVACY_POLICY_APPROVED} />;
}
