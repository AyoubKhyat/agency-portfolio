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
import { SERVICE_GROUPS, contactHref, getService, servicesInGroup } from "@/lib/services-catalog";
import s from "./services.module.css";

const ROOT_ID = "services-v2";

// Everything below the Services hero: cards, comparison, FAQ and CTA
// (design-exploration/services-v2). Content comes from the Services and Comparison messages.
export default function ServicesV2({ faqItems }: { faqItems: { question: string; answer: string }[] }) {
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = useTranslations("Services");
  const c = useTranslations("Comparison");
  const nav = useTranslations("Nav");
  const rtl = useLocale() === "ar";

  const titles = SERVICE_KEYS.map((k) => t(`${getService(k).msg}_title`));
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
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* Service cards, by group (shared catalog). Services with a detail page link to it;
          the others link to the contact form with the service preselected. */}
      <div id="services">
        {SERVICE_GROUPS.map((g, gi) => {
          const items = servicesInGroup(g.id);
          return (
            <section key={g.id} className={`${s.sec} ${s.svc} ${s.svcGroup}`} id={`group-${g.id}`} aria-labelledby={`group-${g.id}-title`}>
              <div className={s.wrap}>
                <div className={`${s.grid12} ${s.secHead} ${s.groupHead}`} data-reveal="">
                  {secLabel(num(gi), <span>{t(`group_${g.msg}_title`)}</span>)}
                  <h2 className={s.disp} id={`group-${g.id}-title`}>{t(`group_${g.msg}_title`)}</h2>
                  <p>{t(`group_${g.msg}_desc`)}</p>
                </div>
                <ul className={s.cards} data-count={items.length}>
                  {items.map((svc, i) => {
                    const feats = t(`${svc.msg}_features`).split(",").map((f) => f.trim()).filter(Boolean);
                    return (
                      <li key={svc.id} id={`svc-${svc.id}`} data-reveal="">
                        <Link href={svc.detailPage ? `/services/${svc.id}` : contactHref(svc.id)} className={s.card}>
                          <div className={s.cardTop}>
                            <span className={s.label}>
                              <span className={s.secNum} dir="ltr">{num(i)}</span>
                            </span>
                            <span className={s.go} aria-hidden="true">
                              <span className={s.flip}>→</span>
                            </span>
                          </div>
                          <h3 className={s.disp}>{t(`${svc.msg}_title`)}</h3>
                          <p className={s.cardSub}>{t(`${svc.msg}_subtitle`)}</p>
                          <p className={s.cardDesc}>{t(`${svc.msg}_desc`)}</p>
                          <ul className={s.feats}>
                            {feats.map((f) => (
                              <li key={f}>
                                <span className={s.tick}><CheckIcon /></span>
                                {f}
                              </li>
                            ))}
                          </ul>
                          <span className={s.more}>
                            {svc.detailPage ? t("learn_more") : t("request_quote")} <span className={s.flip} aria-hidden="true">→</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      {/* Comparison: table on desktop, service picker on phones */}
      <section className={s.sec} id="compare">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
            {secLabel(num(SERVICE_GROUPS.length), <span>{c("pill")}</span>)}
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
            {secLabel(num(SERVICE_GROUPS.length + 1), "FAQ")}
            <h2 className={s.disp}>{t("faq_title")}</h2>
          </div>
          <FaqList items={faqItems} />
        </div>
      </section>

      {/* CTA */}
      <section className={s.cta} id="contact">
        <div className={s.wrap}>
          {secLabel(num(SERVICE_GROUPS.length + 2), <span>{nav("contact")}</span>)}
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
