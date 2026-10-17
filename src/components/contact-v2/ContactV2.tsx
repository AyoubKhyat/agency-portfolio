import type { ReactNode } from "react";
import { preconnect } from "react-dom";
import { getTranslations } from "next-intl/server";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import ContactForm from "./ContactForm";
import s from "./contact.module.css";

const ROOT_ID = "contact-v2";

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.2 23.8l6-1.6A11.8 11.8 0 1 0 12 .2z" />
  </svg>
);

export default async function ContactV2({ locale }: { locale: string }) {
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = await getTranslations({ locale, namespace: "Contact" });
  const h = await getTranslations({ locale, namespace: "HomeV2" });
  const wa = await getTranslations({ locale, namespace: "WhatsApp" });
  const rtl = locale === "ar";
  const waUrl = buildWhatsAppUrl(wa("prefill_message"));
  const phone = t("info_phone");
  const email = t("info_email");

  const rows: { label: string; value: ReactNode }[] = [
    { label: t("label_phone"), value: <a href={`tel:${phone.replace(/\s+/g, "")}`} dir="ltr">{phone}</a> },
    {
      label: t("label_whatsapp"),
      value: (
        <>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" dir="ltr">wa.me/212625461645</a>
          <span className={s.ext} aria-hidden="true">↗</span>
        </>
      ),
    },
    { label: t("label_email"), value: <a href={`mailto:${email}`} dir="ltr">{email}</a> },
    { label: t("label_city"), value: t("info_address") },
    // The site's published schedule (openingHoursSpecification in the layout JSON-LD).
    { label: t("label_hours"), value: t("info_hours") },
  ];

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* Hero: site surface, grid, glows, pill and Instrument Serif heading */}
      <section className={`relative bg-background text-foreground overflow-hidden ${s.hero}`}>
        <div className="grid-bg" />
        <div className={`glow w-[500px] h-[500px] -top-36 left-[10%] ${s.blueGlow}`} />
        <div className="glow w-[800px] h-[800px] bg-primary -bottom-72 -right-48" />
        <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${s.heroGrid}`}>
          <div className={s.heroIn}>
            <span className="pill">
              <span className={s.flip} aria-hidden="true">→</span> {t("title")}
            </span>
            <h1 className={`font-serif text-6xl md:text-8xl lg:text-[140px] leading-[0.9] tracking-tight ${s.h1}`}>{t("hero_heading")}</h1>
            <p className={`font-serif ${s.lede}`}>{h("cta_sub")}</p>
            <div className={s.acts}>
              <a href="#contact-form" className={`${s.btn} ${s.btnGrad}`}>
                <span>{h("cta_form")}</span>
                <span aria-hidden="true">↓</span>
              </a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.btnLine}`}>
                <span className={s.waIcon}>{WA_ICON}</span>
                <span>{h("cta_wa")}</span>
              </a>
            </div>
          </div>
          <div className={`${s.card} ${s.details} ${s.heroIn} ${s.d1}`}>
            <h2 className={s.disp}>{t("details_title")}</h2>
            <dl>
              {rows.map((r) => (
                <div key={r.label} className={s.drow}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Form + WhatsApp */}
      <section className={s.main} aria-label={t("title")}>
        <div className={s.mwrap}>
          <div className={`${s.card} ${s.formCard}`} id="contact-form" data-reveal="">
            <ContactForm waUrl={waUrl} />
          </div>
          <aside className={s.aside}>
            <div className={`${s.card} ${s.waCard}`} data-reveal="">
              <div className={s.waTop}>
                <span className={s.waIco}>{WA_ICON}</span>
                <span className={s.waKick}>{h("cta_kicker")}</span>
              </div>
              <h2 className={s.disp}>{t("whatsapp_cta")}</h2>
              <p className={s.waNum} dir="ltr">{phone}</p>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.waBtn}`}>
                <span>{h("cta_wa")}</span>
                <span className={s.flip} aria-hidden="true">→</span>
              </a>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
