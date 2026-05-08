"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import { HiMenu, HiX } from "react-icons/hi";

export default function Navbar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: t("home") },
    { href: "/services", label: t("services") },
    { href: "/portfolio", label: t("portfolio") },
    { href: "/blog", label: t("blog") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ] as const;

  return (
    <nav className="sticky top-0 z-50 bg-secondary/80 backdrop-blur-md border-b border-line-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-dark grid place-items-center font-serif italic text-xl text-secondary font-semibold shadow-[0_0_30px_rgba(167,139,250,0.4)]">
              i
            </span>
            <span className="font-mono text-sm tracking-[0.12em] uppercase text-text-muted">
              Ibda3 Digital
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === link.href
                    ? "text-primary font-medium"
                    : "text-text-muted hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <LanguageSwitcher />
            <Link
              href="/contact"
              className="ml-3 px-5 py-2 bg-primary text-secondary rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              {t("cta")}
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg text-text-muted hover:bg-white/5"
          >
            {open ? <HiX size={24} /> : <HiMenu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-line-soft bg-secondary max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  pathname === link.href
                    ? "text-primary font-medium"
                    : "text-text-muted hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 flex items-center gap-3">
              <LanguageSwitcher />
            </div>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="block mt-2 px-4 py-2 bg-primary text-secondary rounded-lg text-sm font-semibold text-center hover:bg-primary-dark transition-colors"
            >
              {t("cta")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
