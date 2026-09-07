"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { HiOutlineChatBubbleLeftRight, HiXMark } from "react-icons/hi2";

// The panel and its scripted copy are only fetched once someone opens the
// assistant, so the widget costs a button on first load.
const AssistantPanel = dynamic(() => import("./AssistantPanel"));

const TITLE_ID = "ibda3-assistant-title";
const PANEL_ID = "ibda3-assistant-panel";

export default function AssistantWidget() {
  const t = useTranslations("Assistant");
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Closing always returns focus to the launcher so keyboard users are not
  // dropped at the top of the document.
  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  return (
    // The only floating control on the page. Kept physically bottom-right in
    // every locale, and below the navbar (z-50) so it never covers navigation.
    <div className="fixed bottom-6 right-4 sm:right-6 z-[46] flex flex-col items-end gap-3">
      {open && <AssistantPanel id={PANEL_ID} onClose={close} labelledBy={TITLE_ID} />}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? PANEL_ID : undefined}
        aria-label={open ? t("aria_close") : t("aria_open")}
        className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary-dark hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {open ? (
          <HiXMark size={24} aria-hidden="true" />
        ) : (
          <HiOutlineChatBubbleLeftRight size={26} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
