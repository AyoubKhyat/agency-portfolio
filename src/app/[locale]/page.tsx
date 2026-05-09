import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  HiOutlineGlobeAlt,
  HiOutlineShoppingCart,
  HiOutlineDevicePhoneMobile,
  HiOutlineMagnifyingGlass,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import CinematicHero from "@/components/CinematicHero";

export default function HomePage() {
  const t = useTranslations("Home");
  const sTranslations = useTranslations("Services");

  const services = [
    { icon: HiOutlineGlobeAlt, key: "web", num: "01" },
    { icon: HiOutlineShoppingCart, key: "ecommerce", num: "02" },
    { icon: HiOutlineDevicePhoneMobile, key: "mobile", num: "03" },
    { icon: HiOutlineMagnifyingGlass, key: "seo", num: "04" },
    { icon: HiOutlineWrenchScrewdriver, key: "maintenance", num: "05" },
  ];

  const stats = [
    { value: "50+", label: t("stats_projects") },
    { value: "40+", label: t("stats_clients") },
    { value: "5+", label: t("stats_years") },
    { value: "24/7", label: t("stats_support") },
  ];

  return (
    <>
      <CinematicHero
        tagline="Web Studio / Marrakech, MA"
        subtitle={t("hero_title")}
        description={t("hero_subtitle")}
        ctaLabel={t("hero_cta")}
        cta2Label={t("hero_cta2")}
      />

      {/* Stats */}
      <section className="bg-background border-t border-line-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-line-soft">
            {stats.map((stat, i) => (
              <StaggerItem
                key={stat.label}
                className={`py-8 md:py-10 ${i < 3 ? "border-r border-line-soft" : ""} text-center`}
              >
                <p className="font-serif text-5xl md:text-6xl text-primary">{stat.value}</p>
                <p className="text-sm text-text-muted mt-2">{stat.label}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Services preview */}
      <section className="relative py-24 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">
              <div>
                <span className="pill">◆ {t("services_title")}</span>
                <h2 className="mt-6 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
                  {t("services_title").split(" ")[0]} <span className="text-primary italic">{t("services_title").split(" ").slice(1).join(" ")}</span>
                </h2>
              </div>
              <p className="font-serif italic text-xl text-text-muted max-w-md leading-relaxed">
                {t("services_subtitle")}
              </p>
            </div>
          </FadeIn>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s) => (
              <StaggerItem key={s.key}>
                <Link
                  href="/services"
                  className="group border border-line rounded-2xl p-8 bg-gradient-to-b from-primary/5 to-transparent hover:border-primary/30 transition-all flex flex-col gap-4 min-h-[260px] hover:-translate-y-1"
                >
                  <span className="font-mono text-xs tracking-[0.18em] text-primary">{s.num}</span>
                  <h3 className="font-serif text-3xl md:text-4xl text-foreground">
                    {sTranslations(`${s.key}_title`)}
                  </h3>
                  <p className="mt-auto text-sm text-text-muted leading-relaxed">
                    {sTranslations(`${s.key}_desc`)}
                  </p>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary bottom-[-200px] right-[-100px] opacity-25" />
        <FadeIn className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl text-foreground leading-[0.95] tracking-tight">
            {t("cta_title").split("?")[0]}
            <span className="text-primary italic">?</span>
          </h2>
          <p className="mt-6 font-serif italic text-xl md:text-2xl text-text-muted max-w-2xl mx-auto">
            {t("cta_subtitle")}
          </p>
          <Link
            href="/contact"
            className="inline-block mt-10 px-10 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary-dark transition-colors active:scale-95"
          >
            {t("cta_button")}
          </Link>
        </FadeIn>
      </section>
    </>
  );
}
