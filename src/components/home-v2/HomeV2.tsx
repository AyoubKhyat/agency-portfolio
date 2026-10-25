import type { CSSProperties } from "react";
import Image from "next/image";
import { preconnect } from "react-dom";
import { getTranslations } from "next-intl/server";
import { FaWhatsapp } from "react-icons/fa";
import { Link } from "@/i18n/navigation";
import { getHomepageProjects, type HomepageProject } from "@/lib/dal";
import { isClientProject } from "@/lib/project-kind";
import { isRenderableProjectImage } from "@/lib/project-image";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { SERVICE_GROUPS, groupHref } from "@/lib/services-catalog";
import { approvedTestimonials } from "@/lib/testimonials";
import { TestimonialsColumns } from "@/components/ui/testimonials-columns-1";
import DiagnosisForm from "./DiagnosisForm";
import RevealController from "./RevealController";
import { alexandria, tajawal } from "./fonts";
import s from "./home.module.css";

const ROOT_ID = "home-v2";
const PHONE = "+212 625 461 645";
const EMAIL = "ibda3.digital0@gmail.com";

const REASONS = ["w1", "w2", "w3", "w4"] as const;

const num = (i: number) => String(i + 1).padStart(2, "0");

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default async function HomeV2({ locale }: { locale: string }) {
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = await getTranslations({ locale, namespace: "HomeV2" });
  const d = await getTranslations({ locale, namespace: "Diagnosis" });
  const wa = await getTranslations({ locale, namespace: "WhatsApp" });
  const sv = await getTranslations({ locale, namespace: "Services" });
  const pf = await getTranslations({ locale, namespace: "Portfolio" });
  const waUrl = buildWhatsAppUrl(wa("prefill_general"));
  // The four service groups from the shared catalog; the Services page lists every service.
  const groups = SERVICE_GROUPS.map((g) => ({
    id: g.id,
    href: groupHref(g.id),
    title: sv(`group_${g.msg}_title`),
    desc: sv(`group_${g.msg}_desc`),
  }));
  const viewCase = pf("view_case_study");
  const rtl = locale === "ar";

  const projects = await getHomepageProjects(locale);
  // Clients: alphabetical by slug, so the order is stable across locales. Concepts: admin order.
  const clients = projects.filter(isClientProject).sort((a, b) => a.slug.localeCompare(b.slug));
  const concepts = projects.filter((p) => !isClientProject(p));
  // Only explicitly approved quotes (lib/testimonials); none means no section at all.
  const testimonials = approvedTestimonials(projects, locale);
  const cards = testimonials.map((q) => ({ text: q.quote, name: q.author, role: `${q.role} · ${q.project}` }));

  // Numbered sections in page order; optional ones count only when they render.
  const numbered = ["offer", clients.length > 0 && "work", "why", cards.length > 0 && "testimonials", "contact"].filter(Boolean);
  const n = (sec: string) => num(numbered.indexOf(sec));

  const secLabel = (n: string, text: string, className = s.label) => (
    <span className={className}>
      <span dir="ltr" className={s.secNum}>({n})</span>
      {text}
    </span>
  );

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} lang={locale} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* 1. Who IBDA3 is, and the free website diagnosis */}
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
          <div className={`${s.grid12} ${s.heroBody}`}>
            <div className={s.heroCopy}>
              <h2 className={s.heroTitle}>{t("hero_title")}</h2>
              <p className={s.heroSub} id="home-v2-value">{t("hero_sub")}</p>
            </div>
            <div className={s.heroForm} data-assistant-avoid>
              <DiagnosisForm waUrl={waUrl} />
              <p className={s.heroAlt}>
                <a className={s.linkU} href={waUrl} target="_blank" rel="noopener noreferrer" data-wa-placement="home_hero">
                  <FaWhatsapp aria-hidden="true" />
                  <span>{d("or_wa")}</span>
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What we do: the four service groups */}
      <section className={s.sec} id="offer">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} data-reveal>
            {secLabel(n("offer"), t("offer_kicker"))}
            <h2 className={s.disp}>{t("offer_title")}</h2>
            <p>{t("offer_intro")}</p>
          </div>
          <ol className={s.offer}>
            {groups.map((g, i) => (
              <li key={g.id}>
                <Link className={s.row} href={g.href}>
                  <span className={`${s.rowNum} ${s.idxNum}`} dir="ltr">{num(i)}</span>
                  <h3 className={`${s.rowName} ${s.disp}`}>{g.title}</h3>
                  <p className={s.rowDesc}>{g.desc}</p>
                  <span className={s.go} aria-hidden="true"><span className={s.flip}>→</span></span>
                </Link>
              </li>
            ))}
          </ol>
          <p className={`${s.label} ${s.offerAlso}`}>
            <Link href="/services" className={s.offerLink}>
              {t("offer_link")} <span className={s.flip} aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      {/* 3. Selected work: real clients, then the concept lab */}
      {(clients.length > 0 || concepts.length > 0) && (
        <section className={`${s.sec} ${s.secTight}`} id="work">
          <div className={s.wrap}>
            {clients.length > 0 && (
              <>
                <div className={`${s.grid12} ${s.secHead}`} data-reveal>
                  {secLabel(n("work"), t("work_kicker"))}
                  <h2 className={s.disp}>{t("work_title")}</h2>
                  <p>{t("work_intro", { count: clients.length })}</p>
                </div>
                <div className={s.work} data-count={clients.length}>
                  {clients.map((p) => (
                    <ClientFigure key={p.slug} p={p} cta={viewCase} tag={t("tag_client")} count={clients.length} />
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
                      <Link href={`/portfolio/${p.slug}`} aria-label={`${p.title} — ${viewCase}`}>
                        <span className={s.thumb}>
                          {isRenderableProjectImage(p.image) && (
                            <Image src={p.image} alt="" fill sizes="(max-width: 760px) 46vw, 16vw" />
                          )}
                        </span>
                        <span className={`${s.tag} ${s.labTag}`}>{t("tag_concept")}</span>
                        <span className={s.nm}>{p.title}</span>
                        <span className={s.sc}>{p.sector}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. Why IBDA3 */}
      <section className={s.sec} id="why">
        <div className={s.wrap}>
          <div className={`${s.grid12} ${s.secHead}`} style={{ marginBottom: 28 }}>
            {secLabel(n("why"), t("why_kicker"))}
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

      {/* 5. Brand story: إبداع */}
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

      {/* 6. Testimonials: only approved quotes (lib/testimonials), in scrolling columns; otherwise not rendered at all */}
      {cards.length > 0 && (
        <section className={s.sec} id="testimonials">
          <div className={s.wrap}>
            <div className={`${s.grid12} ${s.secHead} ${s.tstHead}`} data-reveal>
              {secLabel(n("testimonials"), t("tst_kicker"))}
              <h2 className={s.disp}>{t("tst_title")}</h2>
              <p>{t("tst_intro")}</p>
            </div>
            <div className={s.quotes}>
              <TestimonialsColumns cardClassName={s.tCard} testimonials={cards} />
            </div>
          </div>
        </section>
      )}

      {/* 7. Contact */}
      <section className={s.cta} id="contact">
        <div className={s.wrap}>
          <p className={`${s.label} ${s.ctaLabel}`}>
            <span dir="ltr" className={s.secNum}>({n("contact")})</span>
            {t("cta_kicker")}
          </p>
          <h2 className={`${s.ctaBig} ${s.disp}`}>{t("cta_big")}</h2>
          <div className={`${s.grid12} ${s.ctaRow}`}>
            <p>{t("cta_sub")}</p>
            <div className={s.ctaActions}>
              <a className={`${s.pill} ${s.pillWhite}`} href={waUrl} target="_blank" rel="noopener noreferrer" data-wa-placement="home_cta">
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
            <a href={waUrl} target="_blank" rel="noopener noreferrer" dir="ltr" data-wa-placement="home_contact_info">{PHONE}</a>
            <a href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
            <span>{t("hours")}</span>
            <span>{t("place")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// The screenshot opens the internal case study (which keeps the external "visit site" link).
function ClientFigure({ p, cta, tag, count }: { p: HomepageProject; cta: string; tag: string; count: number }) {
  const host = hostname(p.url);
  const sizes = count >= 3 ? "(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" : "(max-width: 760px) 100vw, 50vw";
  return (
    <figure className={s.fig} data-reveal>
      <Link className={s.shot} href={`/portfolio/${p.slug}`} data-cta={cta} aria-label={`${p.title} — ${cta}`}>
        {isRenderableProjectImage(p.image) && <Image src={p.image} alt={p.title} fill sizes={sizes} />}
      </Link>
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
