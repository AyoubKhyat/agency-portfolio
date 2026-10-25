import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import s from "./process.module.css";

const ROOT_ID = "web-process";
// Ascending bars: height (px) and added opacity per step (the original homepage values).
const STEPS = [
  { key: "s1", h: 36, o: 0 },
  { key: "s2", h: 72, o: 0.25 },
  { key: "s3", h: 112, o: 0.45 },
  { key: "s4", h: 160, o: 0.7 },
] as const;

const num = (i: number) => String(i + 1).padStart(2, "0");

// "De l'idée au lancement": how a website project runs. Copy in ServiceDetail.web_process_*;
// no fixed timelines (each project's schedule is agreed at the start).
export default async function ProcessBars({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "ServiceDetail" });
  return (
    <section id={ROOT_ID} dir={locale === "ar" ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />
      <div className={s.wrap}>
        <div className={`${s.grid12} ${s.secHead}`} data-reveal>
          <span className={s.label}>{t("web_process_kicker")}</span>
          <h2 className={s.disp}>{t("web_process_title")}</h2>
        </div>
        <ol className={s.steps} data-reveal>
          {STEPS.map((st, i) => (
            <li key={st.key} style={{ "--i": i, "--h": st.h, "--o": st.o } as CSSProperties}>
              <div className={s.bar} aria-hidden="true" />
              <div className={s.stepBody}>
                <span className={s.stepNum} dir="ltr">{num(i)}</span>
                <h3>{t(`web_process_${st.key}`)}</h3>
                <p>{t(`web_process_${st.key}_d`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
