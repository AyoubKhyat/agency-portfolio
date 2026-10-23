import type { ReactNode } from "react";
import { preconnect } from "react-dom";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import { getPortfolioProjects, type PortfolioCardProject } from "@/lib/dal";
import { isClientProject } from "@/lib/project-kind";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import ProjectCard, { type CardLabels } from "./ProjectCard";
import WorkFilter from "./WorkFilter";
import s from "./portfolio.module.css";

const ROOT_ID = "portfolio-v2";

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.2 23.8l6-1.6A11.8 11.8 0 1 0 12 .2z" />
  </svg>
);

// Keep hyphenated words (e.g. "d'eux-mêmes") on one line; the text itself is unchanged.
function noBreakHyphens(text: string): ReactNode[] {
  return text.split(/(\S+-\S+)/).map((part, i) => (i % 2 ? <span key={i} className={s.nw}>{part}</span> : part));
}

export default async function PortfolioV2({ locale }: { locale: string }) {
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = await getTranslations({ locale, namespace: "Portfolio" });
  const h = await getTranslations({ locale, namespace: "HomeV2" });
  const nav = await getTranslations({ locale, namespace: "Nav" });
  const wa = await getTranslations({ locale, namespace: "WhatsApp" });
  const rtl = locale === "ar";

  const projects = await getPortfolioProjects(locale);
  // Client work as classified in the admin (Project.kind); every other visible project is a concept.
  const clients = projects.filter(isClientProject);
  const concepts = projects.filter((p) => !isClientProject(p));

  const cardLabels: CardLabels = {
    client: h("tag_client"),
    concept: h("tag_concept"),
    caseStudy: t("view_case_study"),
    liveSite: t("live_site"),
    newTab: t("new_tab"),
  };
  const words = t("title").split(" ");

  const secLabel = (n: string, text: string) => (
    <span className={s.label}>
      <span dir="ltr" className={s.secNum}>({n})</span>
      <span>{text}</span>
    </span>
  );
  const list = (items: PortfolioCardProject[], isClient: boolean) => (
    <ul className={s.work}>
      {items.map((p, i) => (
        <li key={p.slug} data-reveal="">
          <ProjectCard project={p} isClient={isClient} labels={cardLabels} priority={isClient && i === 0} />
        </li>
      ))}
    </ul>
  );

  const clientSection = (
    <section className={`${s.sec} ${s.clients}`} id="clients" aria-labelledby="portfolio-clients-title">
      <div className={s.wrap}>
        <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
          {secLabel("01", h("tag_client"))}
          <div className={s.hd}>
            <h2 className={s.disp} id="portfolio-clients-title">{t("sec_clients")}</h2>
            <p className={s.secIntro}>{h("work_intro", { count: clients.length })}</p>
          </div>
        </div>
        {list(clients, true)}
      </div>
    </section>
  );
  const conceptSection = (
    <section className={`${s.sec} ${s.concepts}`} id="concepts" aria-labelledby="portfolio-concepts-title">
      <div className={s.wrap}>
        <div className={`${s.grid12} ${s.secHead}`} data-reveal="">
          {secLabel("02", h("tag_concept"))}
          <div className={s.hd}>
            <h2 className={s.disp} id="portfolio-concepts-title">{t("sec_concepts")}</h2>
          </div>
        </div>
        <div className={s.note} data-reveal="">
          <span className={`${s.badge} ${s.badgeConcept}`}>{h("tag_concept")}</span>
          <p>{h("lab_note")}</p>
        </div>
        {list(concepts, false)}
      </div>
    </section>
  );

  return (
    <>
      {/* Hero: the original headline, grid and glow; refined subtitle placement and spacing */}
      <section className="relative bg-background pt-[72px] pb-14 md:pt-[104px] md:pb-20 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[600px] h-[600px] bg-primary -bottom-32 left-20 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hero-enter">
            <div className="flex flex-col gap-[22px] md:gap-7">
              <h1 className="font-serif text-6xl md:text-8xl lg:text-[120px] leading-[0.95] tracking-tight text-foreground">
                <span className="text-primary italic">{words[0]}</span><br />{words.slice(1).join(" ")}.
              </h1>
              <p className={`font-serif ${s.heroSub} ${rtl ? s.heroSubAr : ""}`}>{noBreakHyphens(t("subtitle"))}</p>
            </div>
          </div>
        </div>
      </section>

      <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
        <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

        <WorkFilter
          clients={clientSection}
          concepts={conceptSection}
          counts={{ clients: clients.length, concepts: concepts.length }}
          labels={{
            group: t("filter_label"),
            all: t("filter_all"),
            clients: t("filter_clients"),
            concepts: t("filter_concepts"),
            tagClient: h("tag_client"),
            tagConcept: h("tag_concept"),
            secClients: t("sec_clients"),
            secConcepts: t("sec_concepts"),
          }}
        />

        {/* CTA */}
        <section className={s.cta} id="contact">
          <div className={s.wrap}>
            {secLabel("03", nav("contact"))}
            <h2 className={`${s.ctaTitle} ${s.disp}`}>{t("cta_title")}</h2>
            <div className={`${s.grid12} ${s.ctaRow}`}>
              <p>{h("cta_sub")}</p>
              <div className={s.act}>
                <a className={s.linkW} href={buildWhatsAppUrl(wa("prefill_message"))} target="_blank" data-wa-placement="portfolio_cta" rel="noopener noreferrer">
                  {WA_ICON}
                  <span>{h("cta_wa")}</span>
                  <span className={s.srOnly}>{t("new_tab")}</span>
                </a>
                <Link href="/contact" className={s.pillWhite}>
                  <span>{h("cta_quote")}</span>
                  <span className={s.flip} aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
