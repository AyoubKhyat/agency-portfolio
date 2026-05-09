import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return { title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") };
}

export default function AboutPage() {
  const t = useTranslations("About");

  const reasons = [
    { num: "/ 01", key: "why1", en: "Truly local." },
    { num: "/ 02", key: "why2", en: "Quality engineering." },
    { num: "/ 03", key: "why3", en: "Always reachable." },
    { num: "/ 04", key: "why4", en: "Fair pricing." },
  ];

  const steps = [
    { num: "01", key: "discovery", fr: "Découverte", en: "Discovery", desc: "Atelier sur place. On écoute, on cadre les objectifs, on définit le périmètre.", duration: "~ 1 semaine", accent: "primary" },
    { num: "02", key: "design", fr: "Design", en: "Design", desc: "Maquettes haute-fidélité, prototype cliquable, validation mobile et desktop.", duration: "~ 1–2 semaines", accent: "primary" },
    { num: "03", key: "dev", fr: "Développement", en: "Development", desc: "Sprints courts, démos hebdomadaires. Code versionné, tests à chaque étape.", duration: "~ 2–6 semaines", accent: "accent" },
    { num: "04", key: "launch", fr: "Lancement", en: "Launch & Support", desc: "Mise en production, formation, monitoring. Support continu.", duration: "∞ continu", accent: "accent" },
  ];

  return (
    <>
      {/* Story */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary -top-24 right-10 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">● {t("title")}</span>
            <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
              {t("subtitle").split(",")[0]},<br />
              <span className="text-primary italic">{t("subtitle").split(",").slice(1).join(",").trim()}</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="mt-12 max-w-3xl">
              <p className="text-lg text-text-muted leading-relaxed">{t("story_p1")}</p>
              <p className="mt-4 text-lg text-text-muted leading-relaxed">{t("story_p2")}</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Why Us */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-16">
            <FadeIn>
              <div>
                <span className="pill">★ Différenciation</span>
                <h2 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.92] tracking-tight text-foreground">
                  Pourquoi<br /><span className="text-primary italic">nous.</span>
                </h2>
                <p className="mt-8 font-serif italic text-xl text-text-muted leading-relaxed max-w-md">
                  Une agence qui vit à Marrakech, qui parle votre langue et qui livre du code propre.
                </p>
              </div>
            </FadeIn>

            <StaggerContainer className="border-t border-line-soft">
              {reasons.map((r) => (
                <StaggerItem key={r.key}>
                  <div className="grid grid-cols-[60px_1fr] gap-7 py-7 border-b border-line-soft items-start">
                    <span className="font-mono text-sm text-accent tracking-[0.16em] pt-4">{r.num}</span>
                    <div>
                      <h3 className="font-serif text-3xl md:text-4xl text-foreground">
                        {t(`${r.key}_title`)}. <span className="italic text-text-muted text-xl md:text-2xl ml-2">{r.en}</span>
                      </h3>
                      <p className="mt-2 text-text-muted leading-relaxed max-w-xl">{t(`${r.key}_desc`)}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* Process Flow */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[700px] h-[700px] bg-primary top-[20%] left-[30%] opacity-15" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-6">
              <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
                De l&apos;idée<br />au <span className="text-primary italic">lancement.</span>
              </h2>
              <div className="font-mono text-xs tracking-[0.14em] uppercase text-text-muted text-right leading-relaxed">
                Itératif &amp; transparent<br />
                Validation à chaque étape<br />
                Délais respectés
              </div>
            </div>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-4 gap-6 relative" delay={0.15}>
            <div className="hidden md:block absolute top-7 left-0 right-0 border-t border-dashed border-line z-0" />
            {steps.map((step) => (
              <StaggerItem key={step.key}>
                <div className="relative flex flex-col gap-5">
                  <div className={`relative z-10 w-14 h-14 rounded-full border flex items-center justify-center font-mono text-sm tracking-wider ${
                    step.accent === "accent"
                      ? "border-accent text-accent bg-background"
                      : "border-primary text-primary bg-background"
                  } ${step.num === "04" ? "!bg-accent !border-accent !text-white shadow-[0_0_40px_rgba(245,158,11,0.5)]" : ""}`}>
                    {step.num}
                  </div>
                  <h3 className="font-serif text-3xl md:text-4xl text-foreground">{step.fr}</h3>
                  <span className="font-serif italic text-text-muted">{step.en}</span>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                  <span className="mt-auto pt-4 border-t border-line-soft font-mono text-[11px] tracking-[0.16em] uppercase text-primary">
                    {step.duration}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-surface-2">
        <FadeIn className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-4xl md:text-6xl text-foreground mb-12">
            {t("values_title")}.
          </h2>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {["value1", "value2", "value3", "value4"].map((key) => (
              <StaggerItem key={key}>
                <div className="border border-line rounded-2xl p-6 bg-gradient-to-b from-primary/5 to-transparent hover:border-primary/30 transition-all">
                  <p className="font-serif text-lg text-text-muted">{t(key)}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </FadeIn>
      </section>
    </>
  );
}
