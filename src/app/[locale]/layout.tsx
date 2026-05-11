import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SetLang from "@/components/SetLang";
import LoadingScreen from "@/components/LoadingScreen";
import ScrollProgress from "@/components/ScrollProgress";
import BackToTop from "@/components/BackToTop";
import CookieConsent from "@/components/CookieConsent";
import Breadcrumbs from "@/components/Breadcrumbs";

const BASE_URL = "https://ibda3-digital.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = {
    en: "Ibda3 Digital — Web Agency Marrakech | Websites, Apps & E-Commerce",
    fr: "Ibda3 Digital — Agence Web Marrakech | Sites Web, Apps & E-Commerce",
    ar: "إبداع ديجيتال — وكالة ويب مراكش | مواقع، تطبيقات وتجارة إلكترونية",
  };
  const descriptions: Record<string, string> = {
    en: "Professional web agency in Marrakech, Morocco. We build custom websites, mobile apps, e-commerce stores and SEO solutions. 5+ years of experience. Free quote.",
    fr: "Agence web professionnelle à Marrakech, Maroc. Création de sites web, applications mobiles, boutiques e-commerce et solutions SEO. +5 ans d'expérience. Devis gratuit.",
    ar: "وكالة ويب احترافية في مراكش، المغرب. نبني مواقع إلكترونية، تطبيقات موبايل، متاجر إلكترونية وحلول SEO. +5 سنوات خبرة. عرض سعر مجاني.",
  };
  const title = titles[locale] || titles.fr;
  const description = descriptions[locale] || descriptions.fr;
  const url = `${BASE_URL}/${locale}`;

  return {
    title,
    description,
    keywords: [
      "web agency", "agence web", "Marrakech", "Morocco", "Maroc",
      "website", "site web", "mobile app", "e-commerce", "SEO",
      "Ibda3 Digital", "إبداع ديجيتال",
    ],
    authors: [{ name: "Ibda3 Digital" }],
    creator: "Ibda3 Digital",
    publisher: "Ibda3 Digital",
    alternates: {
      canonical: url,
      languages: {
        "x-default": `${BASE_URL}/fr`,
        fr: `${BASE_URL}/fr`,
        en: `${BASE_URL}/en`,
        ar: `${BASE_URL}/ar`,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_MA" : locale === "en" ? "en_US" : "fr_FR",
      url,
      siteName: "Ibda3 Digital",
      title,
      description,
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: "Ibda3 Digital — Web Agency Marrakech",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

function JsonLd({ locale }: { locale: string }) {
  const names: Record<string, string> = {
    fr: "Ibda3 Digital — Agence Web Marrakech",
    en: "Ibda3 Digital — Web Agency Marrakech",
    ar: "إبداع ديجيتال — وكالة ويب مراكش",
  };
  const descs: Record<string, string> = {
    fr: "Agence web à Marrakech spécialisée en création de sites web, applications mobiles et e-commerce.",
    en: "Web agency in Marrakech specializing in website creation, mobile apps and e-commerce.",
    ar: "وكالة ويب في مراكش متخصصة في إنشاء المواقع الإلكترونية وتطبيقات الموبايل والتجارة الإلكترونية.",
  };

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Ibda3 Digital",
    alternateName: "إبداع ديجيتال",
    description: descs[locale] || descs.fr,
    url: `${BASE_URL}/${locale}`,
    logo: `${BASE_URL}/icon.png`,
    image: `${BASE_URL}/og-image.png`,
    telephone: "+212625461645",
    email: "ibda3.digital0@gmail.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Marrakech",
      addressCountry: "MA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 31.6295,
      longitude: -7.9811,
    },
    areaServed: [
      { "@type": "Country", name: "Morocco" },
      { "@type": "City", name: "Marrakech" },
    ],
    serviceType: [
      "Web Development",
      "Mobile App Development",
      "E-Commerce Solutions",
      "SEO",
      "Website Maintenance",
    ],
    priceRange: "$$",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    sameAs: [
      "https://www.instagram.com/ibda3.digital0",
      "https://wa.me/212625461645",
    ],
    inLanguage: [locale],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: names[locale] || names.fr,
    url: `${BASE_URL}/${locale}`,
    publisher: {
      "@type": "Organization",
      name: "Ibda3 Digital",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/icon.png` },
    },
    inLanguage: locale === "ar" ? "ar" : locale === "en" ? "en" : "fr",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "fr" | "en" | "ar")) {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={locale}>
      <SetLang locale={locale} />
      <JsonLd locale={locale} />
      <LoadingScreen />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <ScrollProgress />
      <Navbar />
      <Breadcrumbs />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <BackToTop />
      <CookieConsent />
    </NextIntlClientProvider>
  );
}
