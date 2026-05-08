"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: "fr" | "en") => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center gap-1 bg-foreground/10 rounded-lg p-0.5">
      <button
        onClick={() => switchLocale("fr")}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          locale === "fr"
            ? "bg-primary text-white"
            : "text-text-muted hover:text-foreground"
        }`}
      >
        FR
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-primary text-white"
            : "text-text-muted hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
}
