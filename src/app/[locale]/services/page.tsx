import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HiOutlineCheck } from "react-icons/hi2";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Services" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}

export default function ServicesPage() {
  const t = useTranslations("Services");

  const solutions = [
    { num: "01", key: "web", en: "Websites that load fast." },
    { num: "02", key: "ecommerce", en: "Shops that convert." },
    { num: "03", key: "mobile", en: "Apps that scale." },
    { num: "04", key: "seo", en: "Rank higher. Grow faster." },
    { num: "05", key: "maintenance", en: "Always up to date." },
  ];


  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">◆ {t("title")}</span>
          </FadeIn>
          <FadeIn delay={0.15}>
            <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[132px] leading-[0.95] tracking-tight text-foreground max-w-[1200px]">
              Du code <span className="text-primary italic">moderne</span>,<br />
              pensé pour les entreprises <span className="text-accent italic">marocaines.</span>
            </h1>
          </FadeIn>
        </div>
      </section>

      {/* Solution Cards */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((s) => {
              const features = t(`${s.key}_features`).split(",").map((f) => f.trim());
              return (
                <StaggerItem key={s.key}>
                  <div className="border border-line rounded-2xl p-8 md:p-10 bg-gradient-to-b from-primary/5 to-transparent flex flex-col gap-5 min-h-[320px] hover:border-primary/30 transition-all hover:-translate-y-1">
                    <span className="font-mono text-xs tracking-[0.18em] text-primary">{s.num}</span>
                    <h2 className="font-serif text-4xl md:text-5xl text-foreground">{t(`${s.key}_title`)}</h2>
                    <span className="font-serif italic text-lg text-text-muted">{s.en}</span>
                    <p className="text-text-muted leading-relaxed">{t(`${s.key}_desc`)}</p>
                    <ul className="mt-auto space-y-2">
                      {features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2 text-sm text-text-muted">
                          <HiOutlineCheck className="w-4 h-4 text-accent flex-shrink-0" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <FadeIn className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-6xl text-background leading-tight">{t("cta_title")}</h2>
          <p className="mt-4 text-lg text-background/70">{t("cta_desc")}</p>
          <Link
            href="/contact"
            className="inline-block mt-8 px-10 py-4 bg-background text-foreground rounded-xl font-semibold hover:bg-background/90 transition-colors active:scale-95"
          >
            {t("cta_button")}
          </Link>
        </FadeIn>
      </section>
    </>
  );
}
