"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export default function CookieConsent() {
  const t = useTranslations("Cookies");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("cookie-consent", "declined");
    setVisible(false);
    window.location.reload();
  }

  if (!visible) return null;

  return (
    // Phones get a tighter card (same message, same two 40px buttons) so it covers less of the
    // first screen; from md up the layout is unchanged.
    <div
      className="fixed bottom-3 left-3 right-3 md:bottom-4 md:left-auto md:right-6 md:max-w-md z-[60] border border-line rounded-2xl bg-background/95 backdrop-blur-md px-4 py-3.5 md:p-5 shadow-2xl"
      style={{
        animation: "cookie-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <p className="text-[13px] leading-[1.45] md:text-sm md:leading-relaxed text-text-muted">{t("message")}</p>
      <div className="flex items-center gap-2 mt-2.5 md:gap-3 md:mt-4">
        <button
          onClick={accept}
          className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          {t("accept")}
        </button>
        <button
          onClick={decline}
          className="flex-1 px-4 py-2.5 border border-line text-text-muted rounded-xl text-sm font-semibold hover:border-primary/30 transition-colors"
        >
          {t("decline")}
        </button>
      </div>
    </div>
  );
}
