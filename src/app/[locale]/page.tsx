import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  HiOutlineGlobeAlt,
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineWrenchScrewdriver,
  HiOutlineCheckCircle,
  HiOutlineUserGroup,
  HiOutlineClock,
  HiOutlineChatBubbleLeftRight,
} from "react-icons/hi2";

export default function HomePage() {
  const t = useTranslations("Home");

  const services = [
    { icon: HiOutlineGlobeAlt, key: "web" },
    { icon: HiOutlineShoppingCart, key: "ecommerce" },
    { icon: HiOutlineDevicePhoneMobile, key: "mobile" },
    { icon: HiOutlineWrenchScrewdriver, key: "maintenance" },
  ];

  const sTranslations = useTranslations("Services");

  const stats = [
    { value: "50+", label: t("stats_projects"), icon: HiOutlineCheckCircle },
    { value: "40+", label: t("stats_clients"), icon: HiOutlineUserGroup },
    { value: "3+", label: t("stats_years"), icon: HiOutlineClock },
    { value: "24/7", label: t("stats_support"), icon: HiOutlineChatBubbleLeftRight },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-secondary overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white">
              {t("hero_title")}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed">
              {t("hero_subtitle")}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/contact"
                className="px-8 py-3.5 bg-primary text-secondary rounded-xl font-semibold hover:bg-primary-dark transition-colors text-center"
              >
                {t("hero_cta")}
              </Link>
              <Link
                href="/portfolio"
                className="px-8 py-3.5 bg-white/5 backdrop-blur text-white rounded-xl font-semibold hover:bg-white/10 transition-colors text-center border border-white/10"
              >
                {t("hero_cta2")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-12 -mt-12">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-surface rounded-2xl p-6 text-center border border-white/5"
              >
                <stat.icon className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services preview */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {t("services_title")}
            </h2>
            <p className="mt-3 text-gray-400 max-w-2xl mx-auto">
              {t("services_subtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s) => (
              <Link
                key={s.key}
                href="/services"
                className="group bg-secondary rounded-2xl p-6 border border-white/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                <s.icon className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-white text-lg">
                  {sTranslations(`${s.key}_title`)}
                </h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  {sTranslations(`${s.key}_desc`)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary">{t("cta_title")}</h2>
          <p className="mt-4 text-lg text-secondary/70">{t("cta_subtitle")}</p>
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
