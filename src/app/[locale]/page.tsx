import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import LogoCarousel from "@/components/LogoCarousel";
import Testimonials from "@/components/Testimonials";
import ClientStrip from "@/components/ClientStrip";

const CinematicHero = dynamic(() => import("@/components/CinematicHero"));
const ServicesScroll = dynamic(() => import("@/components/ServicesScroll"));
const HeroParallax = dynamic(() => import("@/components/HeroParallax"));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return {
    title: `Ibda3 Digital — ${t("hero_title")}`,
    description: t("hero_subtitle"),
  };
}

export default function HomePage() {
  const t = useTranslations("Home");
  const sTranslations = useTranslations("Services");
  const about = useTranslations("About");

  const services = [
    { key: "web", num: "01", title: sTranslations("web_title"), desc: sTranslations("web_desc") },
    { key: "ecommerce", num: "02", title: sTranslations("ecommerce_title"), desc: sTranslations("ecommerce_desc") },
    { key: "mobile", num: "03", title: sTranslations("mobile_title"), desc: sTranslations("mobile_desc") },
    { key: "seo", num: "04", title: sTranslations("seo_title"), desc: sTranslations("seo_desc") },
    { key: "maintenance", num: "05", title: sTranslations("maintenance_title"), desc: sTranslations("maintenance_desc") },
  ];

  const stats = [
    { value: 50, suffix: "+", label: t("stats_projects") },
    { value: 40, suffix: "+", label: t("stats_clients") },
    { value: 5, suffix: "+", label: t("stats_years") },
    { value: 24, suffix: "/7", label: t("stats_support") },
  ];

  const products = [
    { title: "Hammam Nour", link: "https://hammam-nour.vercel.app/", thumbnail: "/projects/hammam-nour.webp" },
    { title: "Goudoukh Luxury Cars", link: "https://goudoukh-luxury-cars.vercel.app/", thumbnail: "/projects/goudoukh.webp" },
    { title: "Tannour", link: "https://tannour.vercel.app/", thumbnail: "/projects/tannour.webp" },
    { title: "Victory Path", link: "https://victory-path-beta.vercel.app/login", thumbnail: "/projects/victory-path-v2.webp" },
    { title: "Terrene Studio", link: "https://terrene.webyms.com/", thumbnail: "/projects/terrene.webp" },
    { title: "Hammam Nour", link: "https://hammam-nour.vercel.app/", thumbnail: "/projects/hammam-nour.webp" },
    { title: "Goudoukh Luxury Cars", link: "https://goudoukh-luxury-cars.vercel.app/", thumbnail: "/projects/goudoukh.webp" },
    { title: "Tannour", link: "https://tannour.vercel.app/", thumbnail: "/projects/tannour.webp" },
    { title: "Victory Path", link: "https://victory-path-beta.vercel.app/login", thumbnail: "/projects/victory-path-v2.webp" },
    { title: "Terrene Studio", link: "https://terrene.webyms.com/", thumbnail: "/projects/terrene.webp" },
    { title: "Hammam Nour", link: "https://hammam-nour.vercel.app/", thumbnail: "/projects/hammam-nour.webp" },
    { title: "Goudoukh Luxury Cars", link: "https://goudoukh-luxury-cars.vercel.app/", thumbnail: "/projects/goudoukh.webp" },
    { title: "Tannour", link: "https://tannour.vercel.app/", thumbnail: "/projects/tannour.webp" },
    { title: "Victory Path", link: "https://victory-path-beta.vercel.app/login", thumbnail: "/projects/victory-path-v2.webp" },
    { title: "Terrene Studio", link: "https://terrene.webyms.com/", thumbnail: "/projects/terrene.webp" },
  ];

  return (
    <>
      <CinematicHero
        tagline="Web Studio / Marrakech"
        subtitle={t("hero_title")}
        description={t("hero_subtitle")}
        ctaLabel={t("hero_cta")}
        cta2Label={t("hero_cta2")}
        cardHeadline={t("hero_card_headline")}
        cardDesc={t("hero_card_desc")}
        badge1Title={t("hero_badge1_title")}
        badge1Sub={t("hero_badge1_sub")}
        badge2Title={t("hero_badge2_title")}
        badge2Sub={t("hero_badge2_sub")}
        phoneDashboard={t("hero_phone_dashboard")}
        phoneProjects={t("hero_phone_projects")}
        rotatingWords={[
          t("hero_rotate1"),
          t("hero_rotate2"),
          t("hero_rotate3"),
          t("hero_rotate4"),
          t("hero_rotate5"),
        ]}
      />

      {/* Stats */}
      <section className="bg-background border-t border-line-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <StaggerContainer className="relative grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-line-soft">
            {stats.map((stat, i) => (
              <StaggerItem
                key={stat.label}
                className={`py-8 md:py-10 ${i % 2 === 0 ? "border-r border-line-soft" : ""} ${i === 1 ? "md:border-r md:border-line-soft" : ""} text-center`}
              >
                <p className="font-serif text-5xl md:text-6xl text-primary">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-text-muted mt-2">{stat.label}</p>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Tech Logos */}
      <LogoCarousel title={t("tech_title")} />

      {/* Services preview */}
      <ServicesScroll
        title={t("services_title")}
        subtitle={t("services_subtitle")}
        services={services}
      />

      {/* Portfolio Parallax */}
      <HeroParallax
        products={products}
        title={t("parallax_title")}
        subtitle={t("parallax_subtitle")}
      />

      {/* Client Projects — hidden for now
      <ClientStrip title={t("clients_title")} />
      */}

      {/* Process */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[700px] h-[700px] bg-primary top-[20%] left-[30%] opacity-15" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">
              <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
                {about("process_heading")}<br /><span className="text-primary italic">{about("process_heading_accent")}</span>
              </h2>
              <div className="font-mono text-xs tracking-[0.14em] uppercase text-text-muted text-right leading-relaxed">
                {about("process_tag1")}<br />
                {about("process_tag2")}<br />
                {about("process_tag3")}
              </div>
            </div>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-4 gap-6 relative" delay={0.15}>
            <div className="hidden md:block absolute top-7 left-0 right-0 border-t border-dashed border-line z-0" />
            {[
              { num: "01", stepKey: "step1", accent: "primary" },
              { num: "02", stepKey: "step2", accent: "primary" },
              { num: "03", stepKey: "step3", accent: "accent" },
              { num: "04", stepKey: "step4", accent: "accent" },
            ].map((step) => (
              <StaggerItem key={step.stepKey}>
                <div className="relative flex flex-col gap-5">
                  <div className={`relative z-10 w-14 h-14 rounded-full border flex items-center justify-center font-mono text-sm tracking-wider ${
                    step.accent === "accent"
                      ? "border-accent text-accent bg-background"
                      : "border-primary text-primary bg-background"
                  } ${step.num === "04" ? "!bg-accent !border-accent !text-white shadow-[0_0_40px_rgba(245,158,11,0.5)]" : ""}`}>
                    {step.num}
                  </div>
                  <h3 className="font-serif text-3xl md:text-4xl text-foreground">{about(`${step.stepKey}_title`)}</h3>
                  <span className="font-serif italic text-text-muted">{about(`${step.stepKey}_sub`)}</span>
                  <p className="text-sm text-text-muted leading-relaxed">{about(`${step.stepKey}_desc`)}</p>
                  <span className="mt-auto pt-4 border-t border-line-soft font-mono text-[11px] tracking-[0.16em] uppercase text-primary">
                    {about(`${step.stepKey}_duration`)}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

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
