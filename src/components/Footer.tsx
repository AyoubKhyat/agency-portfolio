"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { tajawal } from "@/components/home-v2/fonts";
import s from "./footer.module.css";

// Compact Footer V2 (design-exploration/footer-v2). The previous footer is kept in
// src/components/footer-legacy/LegacyFooter.tsx for rollback.
const INSTAGRAM = "https://www.instagram.com/ibda3.digital0/";
const WHATSAPP = "https://wa.me/212625461645";

const SERVICES = ["service_web", "service_ecommerce", "service_mobile", "service_seo", "service_maintenance"] as const;
const COMPANY = [
  ["/about", "about"],
  ["/portfolio", "portfolio"],
  ["/blog", "blog"],
  ["/contact", "contact"],
] as const;

const ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M7 2.8h10A4.2 4.2 0 0 1 21.2 7v10a4.2 4.2 0 0 1-4.2 4.2H7A4.2 4.2 0 0 1 2.8 17V7A4.2 4.2 0 0 1 7 2.8Z" />
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.2 23.8l6-1.6A11.8 11.8 0 1 0 12 .2z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M3.5 6.5h17v11h-17z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="m3.8 7 8.2 6.2L20.2 7" />
    </svg>
  ),
};

export default function Footer() {
  const t = useTranslations("Footer");
  const nav = useTranslations("Nav");
  const contact = useTranslations("Contact");
  const rtl = useLocale() === "ar";
  const email = contact("info_email");

  const social = [
    // "Instagram" is a brand name: the same label in every language.
    { href: INSTAGRAM, icon: ICONS.instagram, label: "Instagram", value: "@ibda3.digital0", external: true },
    { href: WHATSAPP, icon: ICONS.whatsapp, label: contact("label_whatsapp"), value: contact("info_phone"), external: true },
    { href: `mailto:${email}`, icon: ICONS.email, label: contact("label_email"), value: email, external: false },
  ];

  return (
    <footer className={`${s.f} ${tajawal.variable}`} dir={rtl ? "rtl" : "ltr"}>
      <div className={s.wrap}>
        <div className={s.cols}>
          <div className={s.brand}>
            <Image src="/logo_ibda3.png" alt="Ibda3 Digital" width={44} height={44} />
            <p>{t("description")}</p>
            <span className={s.city}>{contact("info_address")}</span>
          </div>

          <nav aria-labelledby="footer-services">
            <h2 className={s.colH} id="footer-services">{t("services")}</h2>
            <ul className={s.links}>
              {/* Same destination as before: every service links to the services page. */}
              {SERVICES.map((k) => (
                <li key={k}>
                  <Link href="/services">{t(k)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 className={s.colH} id="footer-company">{t("company")}</h2>
            <ul className={s.links}>
              {COMPANY.map(([href, key]) => (
                <li key={href}>
                  <Link href={href}>{nav(key)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={s.follow}>
            <h2 className={s.colH}>{t("follow")}</h2>
            <ul className={s.social}>
              {social.map((item) => (
                <li key={item.href}>
                  <a href={item.href} {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    <span className={s.ico}>{item.icon}</span>
                    <span>
                      <b>{item.label}</b>
                      <small>{item.value}</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={s.mark} aria-hidden="true">
          <p>
            IBDA3 <span>DIGITAL</span>
          </p>
        </div>

        <div className={s.legal}>
          <p>
            <bdi dir="ltr">&copy; {new Date().getFullYear()} Ibda3 Digital.</bdi> {t("rights")}
          </p>
          <nav aria-label="Legal">
            <Link href="/privacy">{t("privacy")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
