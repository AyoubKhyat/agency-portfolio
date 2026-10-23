"use client";

import { useEffect, useRef, useState } from "react";
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
  const [yielding, setYielding] = useState(false);

  // Content marked data-assistant-avoid (the homepage hero's value text and CTAs)
  // must never sit under the launcher. While they overlap it, the closed launcher
  // fades out and is inert; it comes back as soon as they scroll away.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const btn = launcherRef.current?.getBoundingClientRect();
      if (!btn) return;
      const hit = [...document.querySelectorAll("[data-assistant-avoid]")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.left < btn.right && r.right > btn.left && r.top < btn.bottom && r.bottom > btn.top;
      });
      setYielding(hit);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Client-side navigation swaps the page content under the widget.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);
  const hidden = yielding && !open;

  // Closing always returns focus to the launcher so keyboard users are not
  // dropped at the top of the document.
  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  return (
    // The only floating control on the page. Kept physically bottom-right in
    // every locale, and below the navbar (z-50) so it never covers navigation.
    <div
      className={`fixed bottom-6 right-4 sm:right-6 z-[46] flex flex-col items-end gap-3 motion-safe:transition-[opacity,transform] motion-safe:duration-300 ${
        hidden ? "opacity-0 translate-y-2 pointer-events-none" : ""
      }`}
      inert={hidden}
      data-assistant-launcher={hidden ? "hidden" : "visible"}
    >
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
