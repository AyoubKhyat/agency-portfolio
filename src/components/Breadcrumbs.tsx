"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HiChevronRight } from "react-icons/hi2";

const BASE_URL = "https://ibda3-digital.vercel.app";

const PAGE_KEYS: Record<string, string> = {
  services: "services",
  portfolio: "portfolio",
  blog: "blog",
  about: "about",
  contact: "contact",
};

const CASE_STUDY_SLUGS = ["hammam-nour", "goudoukh", "tannour", "terrene", "victory-path"];

export default function Breadcrumbs() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Nav");
  const cs = useTranslations("CaseStudy");

  const segments = pathname.replace(/^\//, "").split("/");
  const slug = segments[0];
  const subSlug = segments[1];
  const pageKey = PAGE_KEYS[slug];

  if (!pageKey || pathname === "/") return null;

  const isCaseStudy = slug === "portfolio" && subSlug && CASE_STUDY_SLUGS.includes(subSlug);

  const items = [
    {
      "@type": "ListItem" as const,
      position: 1,
      name: t("home"),
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem" as const,
      position: 2,
      name: t(pageKey),
      item: `${BASE_URL}/${locale}/${slug}`,
    },
  ];

  if (isCaseStudy) {
    items.push({
      "@type": "ListItem" as const,
      position: 3,
      name: cs(`${subSlug}_title`),
      item: `${BASE_URL}/${locale}/${slug}/${subSlug}`,
    });
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <nav
        aria-label="Breadcrumb"
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4"
      >
        <ol className="flex items-center gap-1.5 text-xs font-mono tracking-wider uppercase text-text-muted">
          <li>
            <Link href="/" className="hover:text-primary transition-colors">
              {t("home")}
            </Link>
          </li>
          <li aria-hidden="true">
            <HiChevronRight className="w-3 h-3" />
          </li>
          {isCaseStudy ? (
            <>
              <li>
                <Link href="/portfolio" className="hover:text-primary transition-colors">
                  {t(pageKey)}
                </Link>
              </li>
              <li aria-hidden="true">
                <HiChevronRight className="w-3 h-3" />
              </li>
              <li>
                <span className="text-foreground">{cs(`${subSlug}_title`)}</span>
              </li>
            </>
          ) : (
            <li>
              <span className="text-foreground">{t(pageKey)}</span>
            </li>
          )}
        </ol>
      </nav>
    </>
  );
}
