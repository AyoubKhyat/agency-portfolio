import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { preconnect } from "react-dom";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import { getPortfolioProjects, type getProjectBySlug } from "@/lib/dal";
import { CLIENT_SLUGS } from "@/lib/homepage-clients";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { VERIFIED_RESULTS, isWithheld, type CaseField } from "./content-policy";
import s from "./detail.module.css";

const ROOT_ID = "project-detail-v2";

type Project = NonNullable<Awaited<ReturnType<typeof getProjectBySlug>>>;

const ICON_EXT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const ICON_CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const ICON_WA = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.2 23.8l6-1.6A11.8 11.8 0 1 0 12 .2z" />
  </svg>
);

const list = (v: string | null | undefined) => (v || "").split(",").map((x) => x.trim()).filter(Boolean);
const num = (n: number) => String(n).padStart(2, "0");
function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default async function ProjectDetailV2({ project, locale }: { project: Project; locale: string }) {
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = await getTranslations({ locale, namespace: "CaseStudy" });
  const h = await getTranslations({ locale, namespace: "HomeV2" });
  const p = await getTranslations({ locale, namespace: "Portfolio" });
  const nav = await getTranslations({ locale, namespace: "Nav" });
  const wa = await getTranslations({ locale, namespace: "WhatsApp" });
  const rtl = locale === "ar";
  const tr = project.translation!;
  const slug = project.slug;
  const isClient = CLIENT_SLUGS.has(slug);
  const show = (field: CaseField, value: string | null | undefined) => (value && !isWithheld(slug, field) ? value : "");

  const challenge = show("challenge", tr.challenge);
  const solution = show("solution", tr.solution);
  const steps = (["step1", "step2", "step3"] as const)
    .map((k, i) => ({ k, title: [tr.step1Title, tr.step2Title, tr.step3Title][i] || "", desc: [tr.step1Desc, tr.step2Desc, tr.step3Desc][i] || "" }))
    .filter((st) => st.title && !isWithheld(slug, st.k));
  // A single remaining step reads as an orphaned "01" in a three-column row: show Approach only with 2+ steps.
  const showApproach = steps.length >= 2;
  const features = list(tr.features);
  const tech = list(tr.tech);
  // Results & Impact only for verified client work (none yet): no unverified figure is shown as a result.
  const results = isClient && VERIFIED_RESULTS.has(slug)
    ? [
        { value: tr.result1Value || "", label: tr.result1Label || "" },
        { value: tr.result2Value || "", label: tr.result2Label || "" },
        { value: tr.result3Value || "", label: tr.result3Label || "" },
      ].filter((r) => r.value)
    : [];
  const host = hostname(project.url);

  // More work: two other visible projects, same type first, in admin order.
  const all = await getPortfolioProjects(locale);
  const others = all.filter((x) => x.slug !== slug);
  const related = [...others.filter((x) => CLIENT_SLUGS.has(x.slug) === isClient), ...others.filter((x) => CLIENT_SLUGS.has(x.slug) !== isClient)].slice(0, 2);

  // Section labels carry only the number (the heading names the section); the CTA keeps its word.
  const order = [
    challenge && "challenge",
    solution && "solution",
    showApproach && "approach",
    (features.length > 0 || tech.length > 0) && "features",
    results.length > 0 && "results",
    related.length > 0 && "more",
    "cta",
  ].filter(Boolean) as string[];
  // Section surfaces alternate plate / page over the sections that actually render, so hidden
  // sections (withheld approach, unverified results) never leave two plates side by side.
  const surfaces = [
    (challenge || solution) && "story",
    showApproach && "approach",
    (features.length > 0 || tech.length > 0) && "features",
    results.length > 0 && "results",
    related.length > 0 && "more",
  ].filter(Boolean) as string[];
  const secClass = (key: string) => (surfaces.indexOf(key) % 2 === 0 ? `${s.sec} ${s.plate}` : s.sec);
  const secLabel = (key: string, text?: string) => (
    <span className={s.label}>
      <span dir="ltr" className={s.secNum}>({num(order.indexOf(key) + 1)})</span>
      {text && <span>{text}</span>}
    </span>
  );
  const badge = (client: boolean) => (
    <span className={`${s.badge} ${client ? s.badgeClient : s.badgeConcept}`}>{client ? h("tag_client") : h("tag_concept")}</span>
  );

  const facts: { label: string; value: ReactNode }[] = [];
  if (isClient && tr.client) facts.push({ label: t("client_label"), value: tr.client });
  if (tr.industry) facts.push({ label: t("sector_label"), value: tr.industry });
  if (tech.length) facts.push({ label: t("stack_label"), value: tech.join(", ") });
  if (host)
    facts.push({
      label: t("live_label"),
      value: (
        <a href={project.url} target="_blank" rel="noopener noreferrer">
          <span dir="ltr">{host}</span>
          {ICON_EXT}
          <span className={s.srOnly}>{t("new_tab")}</span>
        </a>
      ),
    });

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* Hero: site surface, grid, glow and Instrument Serif title; refined hierarchy */}
      <section className={`relative bg-background text-foreground overflow-hidden ${s.hero}`}>
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={s.heroIn}>
            <Link href="/portfolio" className={s.back}>
              <span className={s.arr} aria-hidden="true">←</span>
              {t("back_to_portfolio")}
            </Link>
            <div className={s.heroMeta}>
              {badge(isClient)}
              {tr.industry && <span className={s.sector}>{tr.industry}</span>}
            </div>
            <h1 className={`font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight ${s.h1}`}>{tr.title}</h1>
            {tr.tagline && <p className={`font-serif ${s.tagline}`}>{tr.tagline}</p>}
            {facts.length > 0 && (
              <dl className={s.facts} style={{ "--cols": facts.length } as CSSProperties}>
                {facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {!isClient && (
              <div className={s.note}>
                {badge(false)}
                <p>{h("lab_note")}</p>
              </div>
            )}
          </div>
          {project.image?.startsWith("/") && (
            <div className={`${s.shot} ${s.heroIn} ${s.d1}`}>
              <Image src={project.image} alt={tr.title} fill preload fetchPriority="high" sizes="(max-width: 1280px) 100vw, 1216px" />
            </div>
          )}
        </div>
      </section>

      {/* Challenge / Solution */}
      {(challenge || solution) && (
        <section className={secClass("story")}>
          <div className={s.wrap}>
            {challenge && (
              <div className={`${s.grid12} ${s.story}`} data-reveal="">
                <div className={s.side}>
                  {secLabel("challenge")}
                  <h2 className={s.disp}>{t("challenge_label")}</h2>
                </div>
                <div className={s.body}>
                  <p className={s.lead}>{challenge}</p>
                </div>
              </div>
            )}
            {solution && (
              <div className={`${s.grid12} ${s.story}`} data-reveal="">
                <div className={s.side}>
                  {secLabel("solution")}
                  <h2 className={s.disp}>{t("solution_label")}</h2>
                </div>
                <div className={s.body}>
                  <p className={s.lead}>{solution}</p>
                  {project.url && (
                    <a className={s.pillDark} href={project.url} target="_blank" rel="noopener noreferrer">
                      {t("visit_site")}
                      {ICON_EXT}
                      <span className={s.srOnly}>{t("new_tab")}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Approach */}
      {showApproach && (
        <section className={secClass("approach")}>
          <div className={s.wrap}>
            <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
              {secLabel("approach")}
              <h2 className={s.disp}>{t("approach_label")}</h2>
            </div>
            <ol className={s.steps}>
              {steps.map((st, i) => (
                <li key={st.k} data-reveal="">
                  <span className={`${s.stepNum} ${s.gradText}`} dir="ltr">{num(i + 1)}</span>
                  <h3>{st.title}</h3>
                  {st.desc && <p>{st.desc}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Features + stack */}
      {(features.length > 0 || tech.length > 0) && (
        <section className={secClass("features")}>
          <div className={s.wrap}>
            <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
              {secLabel("features")}
              <h2 className={s.disp}>{t("features_label")}</h2>
            </div>
            {features.length > 0 && (
              <ul className={s.feats} data-reveal="">
                {features.map((f) => (
                  <li key={f}>
                    <span className={s.tick}>{ICON_CHECK}</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {tech.length > 0 && (
              <div className={s.stack} data-reveal="">
                <span className={s.label}>{t("tech_label")}</span>
                {tech.map((x) => (
                  <span key={x} className={s.chip}>{x}</span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Results (verified client work only) */}
      {results.length > 0 && (
        <section className={secClass("results")}>
          <div className={s.wrap}>
            <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
              {secLabel("results")}
              <h2 className={s.disp}>{t("results_label")}</h2>
            </div>
            <ul className={s.steps}>
              {results.map((r) => (
                <li key={r.label} data-reveal="">
                  <span className={`${s.stepNum} ${s.gradText}`} dir="auto">{r.value}</span>
                  <p>{r.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* More work */}
      {related.length > 0 && (
        <section className={secClass("more")}>
          <div className={s.wrap}>
            <div className={s.moreHead} data-reveal="">
              <div>
                {secLabel("more")}
                <h2 className={s.disp}>{t("more_work")}</h2>
              </div>
              <Link href="/portfolio" className={s.linkU}>
                {t("all_work")} <span className={s.flip} aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className={s.rel}>
              {related.map((r) => {
                const rClient = CLIENT_SLUGS.has(r.slug);
                return (
                  <li key={r.slug} data-reveal="">
                    <article className={s.rcard}>
                      <Link href={`/portfolio/${r.slug}`} className={s.rshot} tabIndex={-1} aria-hidden="true">
                        {r.image.startsWith("/") && <Image src={r.image} alt="" fill sizes="(max-width: 760px) 100vw, 760px" />}
                      </Link>
                      <div className={s.rbody}>
                        <div className={s.rmeta}>
                          {badge(rClient)}
                          {r.sector && <span className={s.sector}>{r.sector}</span>}
                        </div>
                        <h3 className={s.disp}>
                          <Link href={`/portfolio/${r.slug}`}>{r.title}</Link>
                        </h3>
                        <span className={s.more} aria-hidden="true">
                          {p("view_case_study")} <span className={s.flip}>→</span>
                        </span>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className={s.cta}>
        <div className={s.wrap}>
          {secLabel("cta", nav("contact"))}
          <h2 className={`${s.ctaTitle} ${s.disp}`}>{t("cta_title").replace(/ ([?!:;])/g, " $1")}</h2>
          <div className={`${s.grid12} ${s.ctaRow}`}>
            <p>{t("cta_desc")}</p>
            <div className={s.act}>
              <a className={s.linkW} href={buildWhatsAppUrl(wa("prefill_message"))} target="_blank" rel="noopener noreferrer">
                {ICON_WA}
                <span>{h("cta_wa")}</span>
                <span className={s.srOnly}>{t("new_tab")}</span>
              </a>
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
