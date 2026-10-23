"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Set by the ga-consent-gate script in the root layout.
type AnalyticsGate = { load: () => void; clear: () => void };
const analytics = () => (window as unknown as { __ibda3Analytics?: AnalyticsGate }).__ibda3Analytics;

export default function CookieConsent() {
  const t = useTranslations("Cookies");
  const f = useTranslations("Footer");
  const [visible, setVisible] = useState(false);
  const isHome = usePathname() === "/";

  useEffect(() => {
    // The privacy page can record a choice while the banner is open; hide it then.
    const hide = () => setVisible(false);
    window.addEventListener("cookie-consent-change", hide);
    if (!localStorage.getItem("cookie-consent")) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("cookie-consent-change", hide);
      };
    }
    return () => window.removeEventListener("cookie-consent-change", hide);
  }, []);

  // Analytics is opt-in: Accept starts it now; Decline keeps it off and removes any GA cookies.
  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    analytics()?.load();
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("cookie-consent", "declined");
    analytics()?.clear();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    // Kept clear of the homepage hero CTA, which sits at the end edge of the first screen:
    // from md up the card sits at the start edge (left in FR/EN, right in Arabic). Phones get
    // a tighter card (same message, same two buttons). On the homepage:
    // - short phones, where no bottom position avoids the CTA: just under the navbar, over
    //   the slogan, so navigation, the value text and the CTA stay visible;
    // - lg up, where the value text and CTA fill the bottom of the first screen: the end edge,
    //   in the empty space beside the first slogan line, just under the hero's top rule.
    <div
      className={`fixed inset-x-3 bottom-3 md:bottom-4 md:start-6 md:end-auto md:max-w-md z-[60] border border-line rounded-2xl bg-background/95 backdrop-blur-md px-3.5 py-3 md:p-5 shadow-2xl${
        isHome
          ? " [@media(max-width:767px)_and_(max-height:740px)]:top-[4.5rem] [@media(max-width:767px)_and_(max-height:740px)]:bottom-auto lg:top-[142px] lg:bottom-auto lg:start-auto lg:end-6 lg:p-4"
          : ""
      }`}
      style={{
        animation: "cookie-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <p className="text-[12.5px] leading-[1.4] md:text-sm md:leading-relaxed text-text-muted">{t("message")}{" "}
        <Link href="/privacy" className="underline underline-offset-2 text-foreground hover:text-primary">
          {f("privacy")}
        </Link>
      </p>
      <div className="flex items-center gap-2 mt-2 md:gap-3 md:mt-4">
        <button
          onClick={accept}
          className="flex-1 px-4 py-2 md:py-2.5 bg-[#7455d1] text-white rounded-xl text-sm font-semibold hover:bg-[#6a4bc4] transition-colors"
        >
          {t("accept")}
        </button>
        <button
          onClick={decline}
          className="flex-1 px-4 py-2 md:py-2.5 border border-line text-text-muted rounded-xl text-sm font-semibold hover:border-primary/30 transition-colors"
        >
          {t("decline")}
        </button>
      </div>
    </div>
  );
}
