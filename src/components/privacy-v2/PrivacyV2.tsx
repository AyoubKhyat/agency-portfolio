import type { ReactNode } from "react";
import { preconnect } from "react-dom";
import { getTranslations } from "next-intl/server";
import RevealController from "@/components/home-v2/RevealController";
import { alexandria, tajawal } from "@/components/home-v2/fonts";
import ConsentControls from "@/components/ConsentControls";
import s from "./privacy.module.css";

const ROOT_ID = "privacy-v2";
const PRIVACY_EMAIL = "ibda3.digital0@gmail.com";

type Section = { h: string; p?: string[]; items?: string[]; consent?: boolean };

// Approved text, unchanged; the privacy e-mail becomes a mailto link (its bidi isolates are
// dropped there because the link isolates itself).
function Text({ children }: { children: string }) {
  const parts = children.split(new RegExp(`\u2066?${PRIVACY_EMAIL.replace(/\./g, "\\.")}\u2069?`));
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <a className={s.mail} href={`mailto:${PRIVACY_EMAIL}`} dir="ltr">
              {PRIVACY_EMAIL}
            </a>
          )}
        </span>
      ))}
    </>
  );
}

// Last word in gradient italic (FR "confidentialité", EN "Policy"); Arabic keeps one colour run.
function Heading({ title, rtl }: { title: string; rtl: boolean }): ReactNode {
  const i = title.lastIndexOf(" ");
  if (rtl || i < 0) return title;
  return (
    <>
      {title.slice(0, i)} <em>{title.slice(i + 1)}</em>
    </>
  );
}

const num = (i: number) => String(i + 1).padStart(2, "0");

export default async function PrivacyV2({ locale, draft }: { locale: string; draft: boolean }) {
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  const t = await getTranslations({ locale, namespace: "Privacy" });
  const sections = t.raw("sections") as Section[];
  const rtl = locale === "ar";

  return (
    <div id={ROOT_ID} dir={rtl ? "rtl" : "ltr"} className={`${s.root} ${alexandria.variable} ${tajawal.variable}`}>
      <RevealController rootId={ROOT_ID} hiddenClass={s.jsReveal} />

      {/* Hero: site surface, grid, glows, pill and Instrument Serif heading */}
      <section className={`relative bg-background text-foreground overflow-hidden ${s.hero}`}>
        <div className="grid-bg" />
        <div className={`glow w-[500px] h-[500px] -top-36 left-[10%] ${s.blueGlow}`} />
        <div className="glow w-[800px] h-[800px] bg-primary -bottom-[420px] -right-48" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={s.heroIn}>
            <span className="pill">
              <span className={s.flip} aria-hidden="true">→</span> {t("kicker")}
            </span>
            <h1 className={`font-serif ${s.h1}`}>
              <Heading title={t("title")} rtl={rtl} />
            </h1>
            <div className={s.metaRow}>
              <span className={s.updated}>{t("updated")}</span>
              {draft && <span className={s.badge}>{t("draft_badge")}</span>}
            </div>
            <p className={`font-serif ${s.lede}`}>{t("intro")}</p>
          </div>
          <nav className={s.toc} aria-labelledby="privacy-toc">
            <span className={s.tocLabel} id="privacy-toc">{t("contents")}</span>
            <ol>
              {sections.map((sec, i) => (
                <li key={i}>
                  <a href={`#s${i + 1}`}>
                    <span className={s.tocN}>{num(i)}</span>
                    <span className={s.tocT}>{sec.h}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      {/* Policy */}
      <div className={s.body}>
        <div className={s.col}>
          {draft && (
            <div className={s.draft} role="note" data-reveal="">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v2.75c0 .41.34.75.75.75h1a.75.75 0 0 0 0-1.5h-.25V9.75A.75.75 0 0 0 10 9H9Z" clipRule="evenodd" />
              </svg>
              <p>{t("draft")}</p>
            </div>
          )}
          {sections.map((sec, i) => (
            <section key={i} className={s.sec} id={`s${i + 1}`} aria-labelledby={`h-s${i + 1}`} data-reveal="">
              <div className={s.num} aria-hidden="true">{num(i)}</div>
              <div>
                <h2 className={s.disp} id={`h-s${i + 1}`}>{sec.h}</h2>
                {sec.p?.map((para, j) => (
                  <p key={j} className={s.text}><Text>{para}</Text></p>
                ))}
                {sec.items && (
                  <ul className={s.list}>
                    {sec.items.map((item, j) => (
                      <li key={j}><Text>{item}</Text></li>
                    ))}
                  </ul>
                )}
                {sec.consent && <ConsentControls />}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
