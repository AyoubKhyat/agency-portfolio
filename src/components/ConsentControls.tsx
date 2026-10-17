"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import s from "./privacy-v2/privacy.module.css";

// Set by the ga-consent-gate script in the root layout.
type AnalyticsGate = { load: () => void; clear: () => void };
const analytics = () => (window as unknown as { __ibda3Analytics?: AnalyticsGate }).__ibda3Analytics;

type Choice = "accepted" | "declined" | null;

const CHECK = (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
  </svg>
);

/** Lets visitors change their analytics choice from the privacy page at any time. */
export default function ConsentControls() {
  const t = useTranslations("Privacy");
  const c = useTranslations("Cookies");
  const [choice, setChoice] = useState<Choice>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("cookie-consent");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage after mount
      setChoice(v === "accepted" || v === "declined" ? v : null);
    } catch {}
  }, []);

  function set(next: "accepted" | "declined") {
    try {
      localStorage.setItem("cookie-consent", next);
    } catch {}
    if (next === "accepted") analytics()?.load();
    else analytics()?.clear();
    setChoice(next);
    window.dispatchEvent(new Event("cookie-consent-change"));
  }

  const status = choice === "accepted" ? t("consent_accepted") : choice === "declined" ? t("consent_declined") : t("consent_unset");

  return (
    <div className={s.prefs} id="cookie-preferences">
      <div className={s.prefsHead}>
        <h3 className={s.disp}>{t("consent_title")}</h3>
        <p className={s.status} data-consent-status={choice ?? "unset"} aria-live="polite">
          {t("consent_status")} <b>{status}</b>
        </p>
      </div>
      <div className={s.prefsBody}>
        <button type="button" onClick={() => set("accepted")} aria-pressed={choice === "accepted"} className={`${s.btn} ${s.btnGrad}`}>
          {CHECK}
          <span>{c("accept")}</span>
        </button>
        <button type="button" onClick={() => set("declined")} aria-pressed={choice === "declined"} className={`${s.btn} ${s.btnLine}`}>
          {CHECK}
          <span>{c("decline")}</span>
        </button>
      </div>
    </div>
  );
}
