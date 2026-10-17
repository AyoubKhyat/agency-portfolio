"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HiChevronRight } from "react-icons/hi2";
import { SITE_URL } from "@/lib/site";

const BASE_URL = SITE_URL;

const PAGE_KEYS: Record<string, string> = {
  services: "services",
  portfolio: "portfolio",
  blog: "blog",
  about: "about",
  contact: "contact",
};

// Case-study pages render their own instance with the project title from the database
// (projectTitle); the layout instance stays out of the way on those routes.
export default function Breadcrumbs({ projectTitle }: { projectTitle?: string } = {}) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Nav");

  const segments = pathname.replace(/^\//, "").split("/");
  const slug = segments[0];
  const subSlug = segments[1];
  const pageKey = PAGE_KEYS[slug];

  if (!pageKey || pathname === "/") return null;

  const onCaseStudyRoute = slug === "portfolio" && Boolean(subSlug);
  if (onCaseStudyRoute && !projectTitle) return null;
  const isCaseStudy = onCaseStudyRoute && Boolean(projectTitle);

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

  if (isCaseStudy && projectTitle) {
    items.push({
      "@type": "ListItem" as const,
      position: 3,
      name: projectTitle,
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
                <span className="text-foreground">{projectTitle}</span>
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
