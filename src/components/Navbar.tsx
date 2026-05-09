"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import Image from "next/image";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { HiMenu, HiX } from "react-icons/hi";
import { motion, AnimatePresence } from "./motion";

export default function Navbar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const links = [
    { href: "/", label: t("home") },
    { href: "/services", label: t("services") },
    { href: "/portfolio", label: t("portfolio") },
    { href: "/blog", label: t("blog") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ] as const;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-line-soft" style={{ background: "var(--nav-bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={dark ? "/Logo_horizontal.png" : "/logo_transparent.png"}
              alt="Ibda3 Digital"
              width={160}
              height={40}
              className="hidden md:block"
            />
            <Image
              src="/logo_ibda3.png"
              alt="Ibda3 Digital"
              width={48}
              height={48}
              className="md:hidden rounded-lg"
            />
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
            <ThemeToggle />
            <Link
              href="/contact"
              className="ml-3 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors active:scale-95"
            >
              {t("cta")}
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg text-text-muted hover:bg-foreground/5"
          >
            {open ? <HiX size={24} /> : <HiMenu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="md:hidden border-t border-line-soft bg-background overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {links.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                >
                  <Link
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
                </motion.div>
              ))}
              <div className="pt-2 flex items-center gap-3">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="block mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold text-center hover:bg-primary-dark transition-colors"
              >
                {t("cta")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
