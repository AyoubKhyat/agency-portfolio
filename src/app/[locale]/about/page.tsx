import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import { pageMetadata } from "@/lib/site";
import s from "./about.module.css";

const ROOT_ID = "about-v2";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return pageMetadata({ locale, path: "/about", title: `${t("title")} — Ibda3 Digital`, description: t("subtitle") });
}

const num = (i: number) => String(i + 1).padStart(2, "0");

export default function AboutPage() {
  const t = useTranslations("About");
  const rtl = useLocale() === "ar";

  // The h1 breaks after the first comma (Latin "," or Arabic "،"); the rest takes the brand gradient.
  const subtitle = t("subtitle");
  const split = subtitle.match(/^(.*?[,،])\s*(.+)$/);
  // Display only: the translated pill text carries a leading glyph ("★ "), not needed in a HomeV2 label.
  const whyLabel = t("why_pill").replace(/^[★●◆]\s*/, "");

  const reasons = ["why1", "why2", "why3", "why4"];
  const steps = ["step1", "step2", "step3", "step4"];
  const values = ["value1", "value2", "value3", "value4"];

  const secLabel = (n: string, text?: string) => (
    <span className={s.label}>
      <span dir="ltr" className={s.secNum}>({n})</span>
      {text}
    </span>
  );

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* Hero + story: HomeV2 hero scaffolding (label row, serif headline, ruled body) */}
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={`${s.heroTop} ${s.label} hero-enter`}>
            <span>{t("title")}</span>
          </div>
          <h1 className={`${s.pageTitle} hero-enter`} style={{ "--enter-delay": "0.15s" } as CSSProperties}>
            {split ? (
              <>
                {split[1]}
                <br />
                <span className={s.gradText}>{split[2]}</span>
              </>
            ) : (
              subtitle
            )}
          </h1>
          <div className={`${s.grid12} ${s.heroBody} hero-enter`} style={{ "--enter-delay": "0.3s" } as CSSProperties}>
            <p>{t("story_p1")}</p>
            <p>{t("story_p2")}</p>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className={`${s.sec} ${s.plate}`}>
        <div className={`${s.wrap} ${s.grid12}`}>
          <div className={s.whyHead} data-reveal="">
            {secLabel(num(0), whyLabel)}
            <h2 className={s.disp}>
              {t("why_heading")} <span className={s.gradText}>{t("why_heading_accent")}</span>
            </h2>
            <p>{t("why_tagline")}</p>
          </div>
          <ul className={s.reasons}>
            {reasons.map((key, i) => (
              <li key={key} data-reveal="">
                <span className={s.idx} dir="ltr">{num(i)}</span>
                <div>
                  <h3 className={s.rowTitle}>{t(`${key}_title`)}</h3>
                  <p>{t(`${key}_desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section className={s.sec}>
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
            {secLabel(num(1))}
            <h2 className={s.disp}>
              {t("process_heading")} <span className={s.gradText}>{t("process_heading_accent")}</span>
            </h2>
            <ul className={s.tags}>
              <li>{t("process_tag1")}</li>
              <li>{t("process_tag2")}</li>
              <li>{t("process_tag3")}</li>
            </ul>
          </div>
          <ol className={s.steps}>
            {steps.map((key, i) => (
              <li key={key} className={s.step} data-reveal="">
                <span className={s.idx} dir="ltr">{num(i)}</span>
                <h3 className={s.rowTitle}>{t(`${key}_title`)}</h3>
                <p className={`${s.label} ${s.stepSub}`}>{t(`${key}_sub`)}</p>
                <p>{t(`${key}_desc`)}</p>
                <span className={s.duration}>{t(`${key}_duration`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Values */}
      <section className={`${s.sec} ${s.plate}`}>
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
            {secLabel(num(2))}
            <h2 className={s.disp}>{t("values_title")}.</h2>
          </div>
          <ul className={s.values}>
            {values.map((key) => (
              <li key={key} data-reveal="">{t(key)}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
