"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FaWhatsapp } from "react-icons/fa";
import { HiXMark } from "react-icons/hi2";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { OPTIONS, type AssistantOption } from "./script";

/** One exchange: the option the visitor tapped, and the scripted reply to it. */
type Exchange = { option: AssistantOption };

export default function AssistantPanel({
  id,
  onClose,
  labelledBy,
}: {
  id: string;
  onClose: () => void;
  labelledBy: string;
}) {
  const t = useTranslations("Assistant");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Move focus into the panel when it opens, so keyboard and screen-reader
  // users land on the dialog rather than staying behind it.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape closes from anywhere inside the panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Keep the newest reply in view without yanking the whole page.
  useEffect(() => {
    if (exchanges.length === 0) return;
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [exchanges.length]);

  const label = (o: AssistantOption) => `${o.emoji} ${t(`${o.id}_label`)}`;
  const lastOption = exchanges[exchanges.length - 1]?.option;

  // The pre-filled WhatsApp message echoes the option the visitor tapped, so
  // it is their own words rather than a claim we put in their mouth.
  const prefill = (o: AssistantOption) =>
    o.hasReply ? `${t("prefill_intro")} ${t(`${o.id}_label`)}` : t("prefill_intro");

  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={labelledBy}
      className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-background shadow-2xl overflow-hidden flex flex-col max-h-[min(70vh,30rem)]"
      style={{ animation: "cookie-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-line-soft bg-surface-2">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="w-9 h-9 shrink-0 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-serif text-primary text-sm"
          >
            iD
          </span>
          <p id={labelledBy} className="font-semibold text-sm text-foreground truncate">
            Ibda3 Digital
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("aria_close_panel")}
          className="shrink-0 text-text-muted hover:text-foreground transition-colors rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <HiXMark size={20} />
        </button>
      </div>

      {/* Conversation. Logical radii and margins so Arabic mirrors correctly. */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <p className="bg-surface-2 rounded-2xl rounded-ss-sm px-4 py-3 text-sm text-foreground">
          {t("greeting")}
        </p>

        {/* Replies are announced politely rather than interrupting. */}
        <div aria-live="polite" className="space-y-3">
          {exchanges.map(({ option }, i) => (
            <div key={`${option.id}-${i}`} className="space-y-3">
              <p className="ms-auto w-fit max-w-[85%] bg-primary text-white rounded-2xl rounded-ee-sm px-4 py-2.5 text-sm">
                {label(option)}
              </p>
              {option.hasReply && (
                <p className="bg-surface-2 rounded-2xl rounded-ss-sm px-4 py-3 text-sm text-foreground leading-relaxed">
                  {t(`${option.id}_reply`)}
                </p>
              )}
            </div>
          ))}
        </div>
        <div ref={endRef} />
      </div>

      {/* Options + hand-off */}
      <div className="shrink-0 border-t border-line-soft p-3 space-y-2 bg-background">
        {lastOption && (
          <a
            href={buildWhatsAppUrl(prefill(lastOption))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FaWhatsapp size={18} aria-hidden="true" />
            {t("cta_whatsapp")}
          </a>
        )}

        <div className="max-h-40 overflow-y-auto space-y-2">
          {OPTIONS.filter((o) => o.id !== lastOption?.id).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setExchanges((prev) => [...prev, { option }])}
              className="w-full text-start px-4 py-2.5 rounded-xl border border-line text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {label(option)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
