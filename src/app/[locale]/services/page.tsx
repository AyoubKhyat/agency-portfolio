import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HiOutlineCheck } from "react-icons/hi2";

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
  ];

  const rows = [
    { idx: "/ 01", key: "starter", priceKey: "pricing_starter_price" },
    { idx: "/ 02", key: "pro", priceKey: "pricing_pro_price" },
    { idx: "/ 03", key: "business", priceKey: "pricing_business_price" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="pill">◆ {t("title")}</span>
          <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[132px] leading-[0.95] tracking-tight text-foreground max-w-[1200px]">
            Du code <span className="text-primary italic">moderne</span>,<br />
            pensé pour les entreprises <span className="text-accent italic">marocaines.</span>
          </h1>
        </div>
      </section>

      {/* Solution Cards */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {solutions.map((s) => {
              const features = t(`${s.key}_features`).split(",").map((f) => f.trim());
              return (
                <div
                  key={s.key}
                  className="border border-line rounded-2xl p-8 md:p-10 bg-gradient-to-b from-primary/5 to-transparent flex flex-col gap-5 min-h-[320px]"
                >
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
              );
            })}
          </div>
        </div>
      </section>

      {/* Maintenance card */}
      <section className="relative py-16 bg-background overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border border-line rounded-2xl p-8 md:p-10 bg-gradient-to-b from-primary/5 to-transparent">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="font-mono text-xs tracking-[0.18em] text-primary">04</span>
                <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">{t("maintenance_title")}</h2>
                <p className="mt-3 text-text-muted max-w-xl leading-relaxed">{t("maintenance_desc")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {t("maintenance_features").split(",").map((f) => (
                  <span key={f.trim()} className="pill">{f.trim()}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14 gap-6">
            <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
              {t("pricing_title").split(" ")[0]}<br />&amp; <span className="text-primary italic">{t("pricing_title").split(" ").slice(1).join(" ") || "tarifs"}.</span>
            </h2>
            <div className="font-mono text-xs tracking-[0.14em] uppercase text-text-muted text-right leading-relaxed">
              Prix transparents<br />
              Devis détaillé sous 48h<br />
              Paiement échelonné possible
            </div>
          </div>

          <div className="border-t border-line-soft">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-1 md:grid-cols-[60px_1fr_1.2fr_auto] items-center py-8 border-b border-line-soft gap-4 md:gap-8"
              >
                <span className="font-mono text-sm text-primary tracking-[0.12em] hidden md:block">{row.idx}</span>
                <div>
                  <span className="font-serif text-3xl md:text-4xl text-foreground">{t(`pricing_${row.key}`)}</span>
                </div>
                <p className="text-text-muted leading-relaxed">{t(`pricing_${row.key}_desc`)}</p>
                <div className="text-right">
                  <span className="font-serif text-3xl md:text-4xl text-accent italic">
                    {t(row.priceKey)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-6xl text-background leading-tight">{t("cta_title")}</h2>
          <p className="mt-4 text-lg text-background/70">{t("cta_desc")}</p>
          <Link
            href="/contact"
            className="inline-block mt-8 px-10 py-4 bg-background text-foreground rounded-xl font-semibold hover:bg-background/90 transition-colors"
          >
            {t("cta_button")}
          </Link>
        </div>
      </section>
    </>
  );
}
