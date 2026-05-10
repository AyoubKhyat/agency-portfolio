import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import CinematicHero from "@/components/CinematicHero";
import ServicesScroll from "@/components/ServicesScroll";
import HeroParallax from "@/components/HeroParallax";

export default function HomePage() {
  const t = useTranslations("Home");
  const sTranslations = useTranslations("Services");

  const services = [
    { key: "web", num: "01", title: sTranslations("web_title"), desc: sTranslations("web_desc") },
    { key: "ecommerce", num: "02", title: sTranslations("ecommerce_title"), desc: sTranslations("ecommerce_desc") },
    { key: "mobile", num: "03", title: sTranslations("mobile_title"), desc: sTranslations("mobile_desc") },
    { key: "seo", num: "04", title: sTranslations("seo_title"), desc: sTranslations("seo_desc") },
    { key: "maintenance", num: "05", title: sTranslations("maintenance_title"), desc: sTranslations("maintenance_desc") },
  ];

  const stats = [
    { value: "50+", label: t("stats_projects") },
    { value: "40+", label: t("stats_clients") },
    { value: "5+", label: t("stats_years") },
    { value: "24/7", label: t("stats_support") },
  ];

  const products = [
    { title: "Gestion de Stock", link: "https://github.com/AyoubKhyat/ManagementStockWeb", thumbnail: "https://opengraph.githubassets.com/7b0cc63b4492ad5d6d69e2be5aba26f51fb9a43f22949eda1a5929109c57f294/AyoubKhyat/ManagementStockWeb" },
    { title: "Gestion Scolaire", link: "https://github.com/AyoubKhyat/School", thumbnail: "https://opengraph.githubassets.com/c9eb563c2d914c701c536473c339515b5c8ffdf3bbc508ec21303ed5c9ca83f5/AyoubKhyat/School" },
    { title: "Rent-Car", link: "https://github.com/AyoubKhyat/Rent-Car", thumbnail: "https://opengraph.githubassets.com/570d2c2440f47d994401dc86fbf19abb8db5d953cee7dd1125797c842732027a/AyoubKhyat/Rent-Car" },
    { title: "Sykweb Agency", link: "https://github.com/AyoubKhyat/Sykweb_Site", thumbnail: "https://opengraph.githubassets.com/3aaf66b9b94f8446a993f15b885630d63f706becfafe506e7c5a725304eb4d92/AyoubKhyat/Sykweb_Site" },
    { title: "Terrene Studio", link: "https://terrene.webyms.com/", thumbnail: "/projects/terrene.jpg" },
    { title: "Baraka Idman", link: "https://github.com/AyoubKhyat/Main-Site-Baraka-Idman", thumbnail: "https://opengraph.githubassets.com/16e7e1c37c3434fa7dfc4afb1b35b18a56420bff01d4f8118861086835f42b8c/AyoubKhyat/Main-Site-Baraka-Idman" },
    { title: "Portal Football", link: "https://github.com/AyoubKhyat/portalAddons", thumbnail: "https://opengraph.githubassets.com/9a9b70d6c25a909623c0ccf6b95c54667d988ac1378bb68b9d60a68fff471eff/AyoubKhyat/portalAddons" },
    { title: "Gestion de Stock", link: "https://github.com/AyoubKhyat/ManagementStockWeb", thumbnail: "https://opengraph.githubassets.com/7b0cc63b4492ad5d6d69e2be5aba26f51fb9a43f22949eda1a5929109c57f294/AyoubKhyat/ManagementStockWeb" },
    { title: "Gestion Scolaire", link: "https://github.com/AyoubKhyat/School", thumbnail: "https://opengraph.githubassets.com/c9eb563c2d914c701c536473c339515b5c8ffdf3bbc508ec21303ed5c9ca83f5/AyoubKhyat/School" },
    { title: "Rent-Car", link: "https://github.com/AyoubKhyat/Rent-Car", thumbnail: "https://opengraph.githubassets.com/570d2c2440f47d994401dc86fbf19abb8db5d953cee7dd1125797c842732027a/AyoubKhyat/Rent-Car" },
    { title: "Sykweb Agency", link: "https://github.com/AyoubKhyat/Sykweb_Site", thumbnail: "https://opengraph.githubassets.com/3aaf66b9b94f8446a993f15b885630d63f706becfafe506e7c5a725304eb4d92/AyoubKhyat/Sykweb_Site" },
    { title: "Terrene Studio", link: "https://terrene.webyms.com/", thumbnail: "/projects/terrene.jpg" },
    { title: "Baraka Idman", link: "https://github.com/AyoubKhyat/Main-Site-Baraka-Idman", thumbnail: "https://opengraph.githubassets.com/16e7e1c37c3434fa7dfc4afb1b35b18a56420bff01d4f8118861086835f42b8c/AyoubKhyat/Main-Site-Baraka-Idman" },
    { title: "Portal Football", link: "https://github.com/AyoubKhyat/portalAddons", thumbnail: "https://opengraph.githubassets.com/9a9b70d6c25a909623c0ccf6b95c54667d988ac1378bb68b9d60a68fff471eff/AyoubKhyat/portalAddons" },
    { title: "Sykweb Agency", link: "https://github.com/AyoubKhyat/Sykweb_Site", thumbnail: "https://opengraph.githubassets.com/3aaf66b9b94f8446a993f15b885630d63f706becfafe506e7c5a725304eb4d92/AyoubKhyat/Sykweb_Site" },
  ];

  return (
    <>
      <CinematicHero
        tagline="Web Studio / Marrakech"
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
      <ServicesScroll
        title={t("services_title")}
        subtitle={t("services_subtitle")}
        services={services}
      />

      {/* Portfolio Parallax */}
      <HeroParallax products={products} />

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
