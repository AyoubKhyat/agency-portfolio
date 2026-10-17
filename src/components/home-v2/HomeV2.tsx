import type { CSSProperties } from "react";
import Image from "next/image";
import { preconnect } from "react-dom";
import { getTranslations } from "next-intl/server";
import { FaWhatsapp } from "react-icons/fa";
import { Link } from "@/i18n/navigation";
import { getHomepageProjects, type HomepageProject } from "@/lib/dal";
import { CLIENT_SLUGS } from "@/lib/homepage-clients";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import RevealController from "./RevealController";
import { alexandria, tajawal } from "./fonts";
import s from "./home.module.css";

// Cabinet Grotesk is served by Fontshare's CSS API (ITF Free Font License): the repo is
// public, so the font files must not be committed.
const CABINET_CSS = "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&display=swap";
const ROOT_ID = "home-v2";
const PHONE = "+212 625 461 645";
const EMAIL = "ibda3.digital0@gmail.com";

const SERVICES = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
const REASONS = ["w1", "w2", "w3", "w4"] as const;
// Ascending bars: height (px) and added opacity per step.
const STEPS = [
  { key: "st1", h: 36, o: 0 },
  { key: "st2", h: 72, o: 0.25 },
  { key: "st3", h: 112, o: 0.45 },
  { key: "st4", h: 160, o: 0.7 },
] as const;

const num = (i: number) => String(i + 1).padStart(2, "0");

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isLocalImage(src: string) {
  return src.startsWith("/");
}

export default async function HomeV2({ locale }: { locale: string }) {
  preconnect("https://api.fontshare.com");
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = await getTranslations({ locale, namespace: "HomeV2" });
  const wa = await getTranslations({ locale, namespace: "WhatsApp" });
  const waUrl = buildWhatsAppUrl(wa("prefill_message"));
  const rtl = locale === "ar";

  const projects = await getHomepageProjects(locale);
  // Clients: alphabetical by slug, so the order is stable across locales. Concepts: admin order.
  const clients = projects.filter((p) => CLIENT_SLUGS.has(p.slug)).sort((a, b) => a.slug.localeCompare(b.slug));
  const concepts = projects.filter((p) => !CLIENT_SLUGS.has(p.slug));

  const secLabel = (n: string, text: string, className = s.label) => (
    <span className={className}>
      <span dir="ltr" className={s.secNum}>({n})</span>
      {text}
    </span>
  );

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} lang={locale} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <link rel="stylesheet" href={CABINET_CSS} precedence="default" />
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* 1. Who IBDA3 is: slogan + plain value proposition */}
      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={`${s.heroTop} ${s.label}`}>
            <span>{t("kicker")}</span>
            <span className={s.heroHours}>{t("hours")}</span>
          </div>
          {/* The slogan is an English lockup in every locale; the lines follow the page
              direction (line 2 sits at the end edge) while the words stay LTR. */}
          <h1 className={`${s.slogan} ${s.disp}`} lang="en" aria-describedby="home-v2-value">
            <span className={s.srOnly} lang={locale}>{t("h1_sr")} </span>
            <span className={s.ln}>
              <span dir="ltr" style={{ "--d": "0.05s" } as CSSProperties}>
                We build<span className={s.stop}>.</span>
              </span>
            </span>{" "}
            <span className={`${s.ln} ${s.lnTwo}`}>
              <span dir="ltr" style={{ "--d": "0.16s" } as CSSProperties}>
                You grow<span className={`${s.stop} ${s.gradText}`}>.</span>
              </span>
            </span>
          </h1>
          <div className={`${s.grid12} ${s.value}`}>
            <div className={s.valueText}>
              <p className={s.valueMain} id="home-v2-value">{t("value")}</p>
              <p className={s.valueSub}>{t("value_sub")}</p>
            </div>
            <div className={s.valueCta}>
              <a className={`${s.pill} ${s.pillGrad}`} href={waUrl} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp aria-hidden="true" />
                <span>{t("cta_wa")}</span>
              </a>
              <Link className={s.linkU} href="/contact">
                <span>{t("cta_quote")}</span>
                <span className={s.flip} aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <ul className={s.svcIndex}>
            {SERVICES.map((k, i) => (
              <li key={k}>
                <a href="#offer">
                  <span className={s.idxNum} dir="ltr">{num(i)}</span>
                  <span>{t(k)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. What we build */}
      <section className={s.sec} id="offer">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal>
            {secLabel("01", t("offer_kicker"))}
            <h2 className={s.disp}>{t("offer_title")}</h2>
            <p>{t("offer_intro")}</p>
          </div>
          <ol className={s.offer}>
            {SERVICES.map((k, i) => (
              <li key={k}>
                <div className={s.row}>
                  <span className={`${s.rowNum} ${s.idxNum}`} dir="ltr">{num(i)}</span>
                  <h3 className={`${s.rowName} ${s.disp}`}>{t(k)}</h3>
                  <p className={s.rowDesc}>{t(`${k}_d`)}</p>
                  <span className={s.go} aria-hidden="true"><span className={s.flip}>→</span></span>
                </div>
              </li>
            ))}
          </ol>
          <p className={`${s.label} ${s.offerAlso}`}>{t("offer_also")}</p>
        </div>
      </section>

      {/* 3. Why IBDA3 */}
      <section className={`${s.sec} ${s.secTight}`} id="why">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} style={{ marginBottom: 28 }}>
            {secLabel("02", t("why_kicker"))}
          </div>
          <div className={s.grid12}>
            <p className={s.whyStatement} data-reveal>{t("why_statement")}</p>
            <ol className={s.reasons} data-reveal>
              {REASONS.map((k, i) => (
                <li key={k}>
                  <span className={`${s.reasonNum} ${s.gradText}`} dir="ltr">{num(i)}</span>
                  <div>
                    <h3>{t(k)}</h3>
                    <p>{t(`${k}_d`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Brand story: إبداع */}
      <section className={`${s.sec} ${s.name}`}>
        <div className={`${s.wrap} ${s.grid12} ${s.nameGrid}`} data-reveal>
          <p className={s.nameWord} lang="ar" dir="rtl"><span className={s.gradText}>إبداع</span></p>
          <div className={s.nameTxt}>
            <span className={s.label}>{t("name_kicker")}</span>
            <h2>{t("name_title")}</h2>
            <p>{t("name_body")}</p>
          </div>
        </div>
      </section>

      {/* 4. Selected work: real clients, then the concept lab */}
      <section className={s.sec} id="work">
        <div className={s.wrap}>
          {clients.length > 0 && (
            <>
              <div className={`${s.grid12} ${s.secHead}`} data-reveal>
                {secLabel("03", t("work_kicker"))}
                <h2 className={s.disp}>{t("work_title")}</h2>
                <p>{t("work_intro", { count: clients.length })}</p>
              </div>
              <div className={s.work} data-count={clients.length}>
                {clients.map((p) => (
                  <ClientFigure key={p.slug} p={p} visit={t("visit")} tag={t("tag_client")} count={clients.length} />
                ))}
              </div>
            </>
          )}

          {concepts.length > 0 && (
            <div className={`${s.lab} ${s.grid12}`} data-reveal>
              <div className={s.labHead}>
                <span className={s.tag}>{t("tag_concept")}</span>
                <h3>{t("lab_title")}</h3>
                <p>{t("lab_note")}</p>
              </div>
              <ul className={s.labList}>
                {concepts.map((p) => (
                  <li key={p.slug}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      <span className={s.thumb}>
                        {isLocalImage(p.image) && (
                          <Image src={p.image} alt="" fill sizes="(max-width: 760px) 46vw, 16vw" />
                        )}
                      </span>
                      <span className={`${s.tag} ${s.labTag}`}>{t("tag_concept")}</span>
                      <span className={s.nm}>{p.title}</span>
                      <span className={s.sc}>{p.sector}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 5. Process */}
      <section className={`${s.sec} ${s.secTight}`} id="process">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal>
            {secLabel(clients.length > 0 ? "04" : "03", t("proc_kicker"))}
            <h2 className={s.disp}>{t("proc_title")}</h2>
          </div>
          <ol className={s.steps} data-reveal>
            {STEPS.map((st, i) => (
              <li key={st.key} style={{ "--i": i, "--h": st.h, "--o": st.o } as CSSProperties}>
                <div className={s.bar} aria-hidden="true" />
                <div className={s.stepBody}>
                  <div className={s.stepTop}>
                    <span className={s.stepNum} dir="ltr">{num(i)}</span>
                    <span className={s.label}>{t(`${st.key}_t`)}</span>
                  </div>
                  <h3>{t(st.key)}</h3>
                  <p>{t(`${st.key}_d`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Contact */}
      <section className={s.cta} id="contact">
        <div className={s.wrap}>
          <p className={`${s.label} ${s.ctaLabel}`}>
            <span dir="ltr" className={s.secNum}>({clients.length > 0 ? "05" : "04"})</span>
            {t("cta_kicker")}
          </p>
          <h2 className={`${s.ctaBig} ${s.disp}`}>{t("cta_big")}</h2>
          <div className={`${s.grid12} ${s.ctaRow}`}>
            <p>{t("cta_sub")}</p>
            <div className={s.ctaActions}>
              <a className={`${s.pill} ${s.pillWhite}`} href={waUrl} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp aria-hidden="true" />
                <span>{t("cta_wa")}</span>
              </a>
              <Link className={`${s.linkU} ${s.ctaLink}`} href="/contact">
                <span>{t("cta_form")}</span>
                <span className={s.flip} aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div className={s.ctaInfo}>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" dir="ltr">{PHONE}</a>
            <a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
            <span>{t("hours")}</span>
            <span>{t("place")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ClientFigure({ p, visit, tag, count }: { p: HomepageProject; visit: string; tag: string; count: number }) {
  const host = hostname(p.url);
  const sizes = count >= 3 ? "(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" : "(max-width: 760px) 100vw, 50vw";
  return (
    <figure className={s.fig} data-reveal>
      <a className={s.shot} href={p.url} target="_blank" rel="noopener noreferrer" data-cta={visit} aria-label={`${p.title} — ${visit}`}>
        {isLocalImage(p.image) && <Image src={p.image} alt={p.title} fill sizes={sizes} />}
      </a>
      <figcaption className={s.figcap}>
        <div>
          <h3>{p.title}</h3>
          <span className={s.kind}>{p.sector}</span>
        </div>
        <div className={s.side}>
          <span className={`${s.tag} ${s.tagClient}`}>{tag}</span>
          {host && <span className={s.dom} dir="ltr">{host}</span>}
        </div>
      </figcaption>
    </figure>
  );
}
