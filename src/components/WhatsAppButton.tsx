"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FaWhatsapp } from "react-icons/fa";
import { HiXMark } from "react-icons/hi2";

export default function WhatsAppButton() {
  const t = useTranslations("WhatsApp");
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[320px] rounded-2xl border border-line bg-background shadow-2xl overflow-hidden"
          style={{ animation: "cookie-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          <div className="bg-green-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <FaWhatsapp className="text-white" size={22} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Ibda3 Digital</p>
                <p className="text-green-100 text-xs">{t("online")}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-white/80 hover:text-white transition-colors"
            >
              <HiXMark size={20} />
            </button>
          </div>
          <div className="p-4">
            <div className="bg-surface-2 rounded-xl rounded-tl-sm p-3 mb-4">
              <p className="text-sm text-foreground">{t("greeting")}</p>
              <p className="text-xs text-text-muted mt-1">{t("reply_time")}</p>
            </div>
            <a
              href="https://wa.me/212625461645"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors"
            >
              <FaWhatsapp size={18} />
              {t("start_chat")}
            </a>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="WhatsApp"
        className="w-14 h-14 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 hover:scale-110 transition-all"
      >
        {open ? <HiXMark size={24} /> : <FaWhatsapp size={28} />}
      </button>
    </div>
  );
}
