"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: "fr" | "en" | "ar") => {
    router.replace(pathname, { locale: newLocale });
  };

  const locales = [
    { code: "fr" as const, label: "FR", name: "Français" },
    { code: "en" as const, label: "EN", name: "English" },
    { code: "ar" as const, label: "ع", name: "العربية" },
  ];

  return (
    <div className="flex items-center gap-1 bg-foreground/10 rounded-lg p-0.5" role="group" aria-label="Language">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => switchLocale(l.code)}
          aria-label={l.name}
          aria-current={locale === l.code ? "true" : undefined}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            locale === l.code
              ? "bg-primary text-white"
              : "text-text-muted hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
