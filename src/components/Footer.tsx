"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { HiOutlineEnvelope } from "react-icons/hi2";

export default function Footer() {
  const t = useTranslations("Footer");
  const nav = useTranslations("Nav");

  return (
    <footer className="bg-background border-t border-line-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-dark grid place-items-center font-serif italic text-xl text-white font-semibold">
                i
              </span>
              <span className="font-mono text-sm tracking-[0.12em] uppercase text-text-muted">
                Ibda3 Digital
              </span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">{t("description")}</p>
          </div>

          <div>
            <h3 className="font-mono text-xs tracking-[0.16em] uppercase text-primary mb-4">{t("services")}</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <Link href="/services" className="hover:text-primary transition-colors">
                  {t("service_web")}
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-colors">
                  {t("service_ecommerce")}
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-colors">
                  {t("service_mobile")}
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary transition-colors">
                  {t("service_maintenance")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs tracking-[0.16em] uppercase text-primary mb-4">{t("company")}</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  {nav("about")}
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="hover:text-primary transition-colors">
                  {nav("portfolio")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-primary transition-colors">
                  {nav("blog")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  {nav("contact")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs tracking-[0.16em] uppercase text-primary mb-4">{t("follow")}</h3>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/ibda3.digital0/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
              >
                <FaInstagram size={18} />
              </a>
              <a
                href="https://wa.me/212625461645"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
              >
                <FaWhatsapp size={18} />
              </a>
              <a
                href="mailto:ibda3.digital0@gmail.com"
                aria-label="Email"
                className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
              >
                <HiOutlineEnvelope size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-line-soft flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="font-mono text-xs tracking-[0.12em] uppercase text-text-muted">
            &copy; {new Date().getFullYear()} Ibda3 Digital. {t("rights")}
          </p>
          <span className="font-mono text-xs tracking-[0.12em] uppercase text-text-muted">
            Marrakech · Morocco
          </span>
        </div>
      </div>
    </footer>
  );
}
