import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SetLang from "@/components/SetLang";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = {
    en: "Ibda3 Digital — Web Agency Marrakech",
    fr: "Ibda3 Digital — Agence Web Marrakech",
    ar: "إبداع ديجيتال — وكالة ويب مراكش",
  };
  const descriptions: Record<string, string> = {
    en: "Web agency in Marrakech — Custom websites, mobile apps and e-commerce solutions.",
    fr: "Agence web à Marrakech — Création de sites web, applications mobiles et solutions e-commerce sur mesure.",
    ar: "وكالة ويب في مراكش — مواقع إلكترونية، تطبيقات موبايل وحلول تجارة إلكترونية مخصصة.",
  };
  return {
    title: titles[locale] || titles.fr,
    description: descriptions[locale] || descriptions.fr,
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "fr" | "en" | "ar")) {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={locale}>
      <SetLang locale={locale} />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </NextIntlClientProvider>
  );
}
