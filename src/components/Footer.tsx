"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { HiOutlineEnvelope } from "react-icons/hi2";

export default function Footer() {
  const t = useTranslations("Footer");
  const nav = useTranslations("Nav");

  return (
    <footer className="bg-secondary border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <span className="text-2xl font-bold text-white">
              Ibda3<span className="text-primary"> Digital</span>
            </span>
            <p className="mt-3 text-sm text-gray-400">{t("description")}</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">{t("services")}</h3>
            <ul className="space-y-2 text-sm text-gray-400">
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
            <h3 className="font-semibold text-white mb-3">{t("company")}</h3>
            <ul className="space-y-2 text-sm text-gray-400">
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
            <h3 className="font-semibold text-white mb-3">{t("follow")}</h3>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/ibda3.digital0/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-secondary transition-colors"
              >
                <FaInstagram size={18} />
              </a>
              <a
                href="https://wa.me/212625461645"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-secondary transition-colors"
              >
                <FaWhatsapp size={18} />
              </a>
              <a
                href="mailto:ibda3.digital0@gmail.com"
                aria-label="Email"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-secondary transition-colors"
              >
                <HiOutlineEnvelope size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Ibda3 Digital. {t("rights")}</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-primary transition-colors">
              {t("privacy")}
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              {t("terms")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
