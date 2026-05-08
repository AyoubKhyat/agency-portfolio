import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}
import {
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineHandRaised,
  HiOutlineBanknotes,
  HiOutlineCheckBadge,
  HiOutlineClock,
  HiOutlineLightBulb,
  HiOutlineHeart,
} from "react-icons/hi2";

export default function AboutPage() {
  const t = useTranslations("About");

  const reasons = [
    { key: "why1", icon: HiOutlineMapPin },
    { key: "why2", icon: HiOutlineSparkles },
    { key: "why3", icon: HiOutlineHandRaised },
    { key: "why4", icon: HiOutlineBanknotes },
  ];

  const values = [
    { key: "value1", icon: HiOutlineCheckBadge },
    { key: "value2", icon: HiOutlineClock },
    { key: "value3", icon: HiOutlineLightBulb },
    { key: "value4", icon: HiOutlineHeart },
  ];

  return (
    <>
      <section className="bg-secondary py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white">{t("title")}</h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-6">
            {t("story_title")}
          </h2>
          <p className="text-gray-400 leading-relaxed text-lg">{t("story_p1")}</p>
          <p className="mt-4 text-gray-400 leading-relaxed text-lg">{t("story_p2")}</p>
        </div>
      </section>

      <section className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            {t("why_title")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reasons.map((r) => (
              <div
                key={r.key}
                className="bg-surface rounded-2xl p-6 border border-white/5 text-center hover:border-primary/20 transition-colors"
              >
                <r.icon className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold text-white text-lg">
                  {t(`${r.key}_title`)}
                </h3>
                <p className="mt-2 text-sm text-gray-400">{t(`${r.key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            {t("values_title")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="text-center">
                <v.icon className="w-8 h-8 text-accent mx-auto mb-3" />
                <p className="font-medium text-gray-300">{t(v.key)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
