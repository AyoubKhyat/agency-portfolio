import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}
import {
  HiOutlineGlobeAlt,
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineWrenchScrewdriver,
  HiOutlineCheck,
} from "react-icons/hi2";

export default function ServicesPage() {
  const t = useTranslations("Services");

  const services = [
    { key: "web", icon: HiOutlineGlobeAlt },
    { key: "ecommerce", icon: HiOutlineShoppingCart },
    { key: "mobile", icon: HiOutlineDevicePhoneMobile },
    { key: "maintenance", icon: HiOutlineWrenchScrewdriver },
  ];

  const plans = [
    { key: "starter", popular: false },
    { key: "pro", popular: true },
    { key: "business", popular: false },
  ];

  return (
    <>
      <section className="bg-secondary py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white">{t("title")}</h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {services.map((s) => {
              const features = t(`${s.key}_features`).split(",").map((f) => f.trim());
              return (
                <div
                  key={s.key}
                  className="bg-secondary rounded-2xl p-8 border border-white/5 hover:border-primary/20 transition-colors"
                >
                  <s.icon className="w-12 h-12 text-primary mb-4" />
                  <h2 className="text-2xl font-bold text-white">
                    {t(`${s.key}_title`)}
                  </h2>
                  <p className="mt-3 text-gray-400 leading-relaxed">
                    {t(`${s.key}_desc`)}
                  </p>
                  <ul className="mt-5 space-y-2">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm text-gray-300">
                        <HiOutlineCheck className="w-5 h-5 text-accent flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            {t("pricing_title")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={`relative bg-surface rounded-2xl p-8 border ${
                  plan.popular
                    ? "border-primary shadow-xl shadow-primary/10 scale-105"
                    : "border-white/5"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-secondary text-xs font-semibold px-4 py-1 rounded-full">
                    {t("pricing_popular")}
                  </span>
                )}
                <h3 className="text-xl font-bold text-white">
                  {t(`pricing_${plan.key}`)}
                </h3>
                <p className="mt-2 text-2xl font-bold text-accent">
                  {t(`pricing_${plan.key}_price`)}
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  {t(`pricing_${plan.key}_desc`)}
                </p>
                <Link
                  href="/contact"
                  className={`block mt-6 text-center px-6 py-3 rounded-xl font-semibold transition-colors ${
                    plan.popular
                      ? "bg-primary text-secondary hover:bg-primary-dark"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {t("cta_button")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary">{t("cta_title")}</h2>
          <p className="mt-4 text-lg text-secondary/70">{t("cta_desc")}</p>
          <Link
            href="/contact"
            className="inline-block mt-8 px-8 py-3.5 bg-secondary text-white rounded-xl font-semibold hover:bg-secondary/90 transition-colors"
          >
            {t("cta_button")}
          </Link>
        </div>
      </section>
    </>
  );
}
