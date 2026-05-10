"use client";

import { useTranslations } from "next-intl";
import { HiOutlineCheck, HiOutlineXMark } from "react-icons/hi2";
import { FadeIn } from "@/components/motion";

const SERVICES = ["web", "ecommerce", "mobile", "seo", "maintenance"] as const;

const FEATURES = [
  { key: "custom_design",     included: [true,  true,  true,  false, false] },
  { key: "responsive",        included: [true,  true,  true,  false, false] },
  { key: "cms",               included: [true,  true,  false, false, true]  },
  { key: "seo_optimization",  included: [true,  true,  false, true,  false] },
  { key: "payment",           included: [false, true,  false, false, false] },
  { key: "analytics",         included: [true,  true,  true,  true,  true]  },
  { key: "ssl",               included: [true,  true,  false, false, true]  },
  { key: "push_notifications",included: [false, false, true,  false, false] },
  { key: "performance",       included: [true,  true,  true,  true,  true]  },
  { key: "ongoing_support",   included: [false, false, false, true,  true]  },
  { key: "backups",           included: [false, false, false, false, true]  },
  { key: "security_monitoring",included:[false, false, false, false, true]  },
] as const;

export default function ServiceComparison() {
  const t = useTranslations("Comparison");
  const s = useTranslations("Services");

  return (
    <section className="relative py-20 bg-background overflow-hidden">
      <div className="grid-bg" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-12">
          <span className="pill">{t("pill")}</span>
          <h2 className="mt-6 font-serif text-4xl md:text-6xl text-foreground leading-tight">
            {t("heading")} <span className="text-primary italic">{t("heading_accent")}</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <th className="text-left py-4 px-4 md:px-6 font-mono text-xs tracking-[0.14em] uppercase text-text-muted min-w-[180px]">
                    {t("feature")}
                  </th>
                  {SERVICES.map((svc) => (
                    <th
                      key={svc}
                      className="py-4 px-3 md:px-4 text-center font-serif text-base md:text-lg text-foreground min-w-[100px]"
                    >
                      {s(`${svc}_title`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feat, i) => (
                  <tr
                    key={feat.key}
                    className={`border-t border-line ${i % 2 === 0 ? "bg-background" : "bg-surface-2/50"} hover:bg-primary/5 transition-colors`}
                  >
                    <td className="py-3.5 px-4 md:px-6 text-text-muted font-medium">
                      {t(feat.key)}
                    </td>
                    {feat.included.map((inc, j) => (
                      <td key={SERVICES[j]} className="py-3.5 px-3 md:px-4 text-center">
                        {inc ? (
                          <HiOutlineCheck className="w-5 h-5 text-accent mx-auto" />
                        ) : (
                          <HiOutlineXMark className="w-5 h-5 text-text-muted/30 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
