import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  HiOutlineGlobeAlt,
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";

export default function HomePage() {
  const t = useTranslations("Home");
  const sTranslations = useTranslations("Services");

  const services = [
    { icon: HiOutlineGlobeAlt, key: "web", num: "01" },
    { icon: HiOutlineShoppingCart, key: "ecommerce", num: "02" },
    { icon: HiOutlineDevicePhoneMobile, key: "mobile", num: "03" },
    { icon: HiOutlineWrenchScrewdriver, key: "maintenance", num: "04" },
  ];

  const stats = [
    { value: "50+", label: t("stats_projects") },
    { value: "40+", label: t("stats_clients") },
    { value: "3+", label: t("stats_years") },
    { value: "24/7", label: t("stats_support") },
  ];

  return (
    <>
      {/* Hero — Cover */}
      <section className="relative bg-secondary overflow-hidden min-h-[90vh] flex flex-col justify-end">
        <div className="grid-bg" />
        <div className="glow w-[700px] h-[700px] bg-primary-dark -top-48 -right-48 opacity-35" />
        <div className="glow w-[500px] h-[500px] bg-accent -bottom-44 -left-32 opacity-18" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 w-full">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-8">
            Web Studio <span className="text-line mx-3">/</span> Marrakech, MA
          </p>
          <h1 className="font-serif text-6xl sm:text-7xl md:text-[120px] lg:text-[160px] leading-[0.92] tracking-tight text-white">
            Ibda<span className="text-primary italic">3</span><br />Digital.
          </h1>
          <p className="mt-8 font-serif italic text-2xl md:text-4xl text-white max-w-3xl leading-snug">
            {t("hero_title")}.
          </p>
          <p className="mt-3 text-lg text-text-muted max-w-2xl">
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
              className="px-8 py-3.5 bg-white/5 backdrop-blur text-white rounded-xl font-semibold hover:bg-white/10 transition-colors text-center border border-line-soft"
            >
              {t("hero_cta2")}
            </Link>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full flex justify-between items-end">
          <span className="font-mono text-xs tracking-[0.16em] uppercase text-text-muted">
            <strong className="text-white font-normal">إبداع</strong> · ibdaa · <em className="italic text-text-muted">creation</em>
          </span>
          <span className="font-mono text-xs tracking-[0.16em] uppercase text-text-muted text-right hidden sm:block">
            Marrakech · Morocco
          </span>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-secondary border-t border-line-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-line-soft">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`py-8 md:py-10 ${i < 3 ? "border-r border-line-soft" : ""} text-center`}
              >
                <p className="font-serif text-5xl md:text-6xl text-primary">{stat.value}</p>
                <p className="text-sm text-text-muted mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services preview */}
      <section className="relative py-24 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">
            <div>
              <span className="pill">◆ {t("services_title")}</span>
              <h2 className="mt-6 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-white">
                {t("services_title").split(" ")[0]} <span className="text-primary italic">{t("services_title").split(" ").slice(1).join(" ")}</span>
              </h2>
            </div>
            <p className="font-serif italic text-xl text-text-muted max-w-md leading-relaxed">
              {t("services_subtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s) => (
              <Link
                key={s.key}
                href="/services"
                className="group border border-line rounded-2xl p-8 bg-gradient-to-b from-primary/5 to-transparent hover:border-primary/30 transition-all flex flex-col gap-4 min-h-[260px]"
              >
                <span className="font-mono text-xs tracking-[0.18em] text-primary">{s.num}</span>
                <h3 className="font-serif text-3xl md:text-4xl text-white">
                  {sTranslations(`${s.key}_title`)}
                </h3>
                <p className="mt-auto text-sm text-text-muted leading-relaxed">
                  {sTranslations(`${s.key}_desc`)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 bg-secondary overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary bottom-[-200px] right-[-100px] opacity-25" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl text-white leading-[0.95] tracking-tight">
            {t("cta_title").split("?")[0]}
            <span className="text-primary italic">?</span>
          </h2>
          <p className="mt-6 font-serif italic text-xl md:text-2xl text-text-muted max-w-2xl mx-auto">
            {t("cta_subtitle")}
          </p>
          <Link
            href="/contact"
            className="inline-block mt-10 px-10 py-4 bg-primary text-secondary rounded-xl font-semibold text-lg hover:bg-primary-dark transition-colors"
          >
            {t("cta_button")}
          </Link>
        </div>
      </section>
    </>
  );
}
