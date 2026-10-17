import type { ReactNode } from "react";
import { preconnect } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import ComparePicker from "./ComparePicker";
import FaqList from "./FaqList";
import { CheckIcon, Mark } from "./Marks";
import { FEATURES, SERVICE_KEYS, num } from "./data";
import s from "./services.module.css";

// Cabinet Grotesk is served by Fontshare's CSS API (ITF Free Font License): the repo is
// public, so the font files must not be committed.
const CABINET_CSS = "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&display=swap";
const ROOT_ID = "services-v2";

// Everything below the Services hero: cards, comparison, FAQ and CTA
// (design-exploration/services-v2). Content comes from the Services and Comparison messages.
export default function ServicesV2({ faqItems }: { faqItems: { question: string; answer: string }[] }) {
  preconnect("https://api.fontshare.com");
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = useTranslations("Services");
  const c = useTranslations("Comparison");
  const nav = useTranslations("Nav");
  const rtl = useLocale() === "ar";

  const titles = SERVICE_KEYS.map((k) => t(`${k}_title`));
  const features = FEATURES.map((f) => ({ label: c(f.key), included: f.included }));
  const yes = c("included");
  const no = c("not_included");

  const secLabel = (n: string, text: ReactNode) => (
    <span className={s.label}>
      <span dir="ltr" className={s.secNum}>({n})</span>
      {text}
    </span>
  );

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <link rel="stylesheet" href={CABINET_CSS} precedence="default" />
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* Service cards */}
      <section className={`${s.sec} ${s.svc}`} id="services">
        <div className={s.wrap}>
          <ul className={s.cards}>
            {SERVICE_KEYS.map((k, i) => {
              const feats = t(`${k}_features`).split(",").map((f) => f.trim()).filter(Boolean);
              return (
                <li key={k} id={`svc-${k}`} data-reveal="">
                  <Link href={`/services/${k}`} className={s.card}>
                    <div className={s.cardTop}>
                      <span className={s.label}>
                        <span className={s.secNum} dir="ltr">{num(i)}</span>
                      </span>
                      <span className={s.go} aria-hidden="true">
                        <span className={s.flip}>→</span>
                      </span>
                    </div>
                    <h2 className={s.disp}>{titles[i]}</h2>
                    <p className={s.cardSub}>{t(`${k}_subtitle`)}</p>
                    <p className={s.cardDesc}>{t(`${k}_desc`)}</p>
                    <ul className={s.feats}>
                      {feats.map((f) => (
                        <li key={f}>
                          <span className={s.tick}><CheckIcon /></span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <span className={s.more}>
                      {t("learn_more")} <span className={s.flip} aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Comparison: table on desktop, service picker on phones */}
      <section className={s.sec} id="compare">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
            {secLabel("01", <span>{c("pill")}</span>)}
            <h2 className={s.disp}>
              <span>{c("heading")}</span> <span className={s.gradText}>{c("heading_accent")}</span>
            </h2>
          </div>
          <div className={s.cmpDesk} data-reveal="">
            <div className={s.cmpWrap}>
              <table className={s.cmp}>
                <caption className={s.srOnly}>{`${c("heading")} ${c("heading_accent")}`}</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className={s.label}>{c("feature")}</span>
                    </th>
                    {titles.map((name, i) => (
                      <th scope="col" key={name}>
                        <span className={s.idx} dir="ltr">{num(i)}</span>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.label}>
                      <th scope="row">{f.label}</th>
                      {f.included.map((on, j) => (
                        <td key={SERVICE_KEYS[j]}>
                          <Mark on={on} yes={yes} no={no} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ComparePicker services={titles} features={features} pickLabel={c("choose_service")} yes={yes} no={no} />
        </div>
      </section>

      {/* FAQ */}
      <section className={`${s.sec} ${s.faq}`} id="faq">
        <div className={`${s.wrap} ${s.grid12}`}>
          <div className={s.faqHead} data-reveal="">
            {secLabel("02", "FAQ")}
            <h2 className={s.disp}>{t("faq_title")}</h2>
          </div>
          <FaqList items={faqItems} />
        </div>
      </section>

      {/* CTA */}
      <section className={s.cta} id="contact">
        <div className={s.wrap}>
          {secLabel("03", <span>{nav("contact")}</span>)}
          <h2 className={`${s.ctaTitle} ${s.disp}`}>{t("cta_title")}</h2>
          <div className={`${s.grid12} ${s.ctaRow}`}>
            <p>{t("cta_desc")}</p>
            <div className={s.act}>
              <Link href="/contact" className={s.pillWhite}>
                <span>{t("cta_button")}</span>
                <span className={s.flip} aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
