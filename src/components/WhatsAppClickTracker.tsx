"use client";

import { useEffect } from "react";
import { createClickDeduper, localeFromPath, pageTypeFromPath, trackEvent } from "@/lib/analytics";

/**
 * One delegated listener counts every WhatsApp link on the site (hero, footer,
 * contact page, case studies, service pages, assistant) as a `whatsapp_click`.
 * Placement and service come from the nearest `data-wa-placement` /
 * `data-wa-service` attribute. trackEvent does nothing without consent.
 */
export default function WhatsAppClickTracker() {
  useEffect(() => {
    const isFresh = createClickDeduper();
    const onInteract = (e: MouseEvent) => {
      if (e.type === "auxclick" && e.button !== 1) return;
      const link = (e.target as Element | null)?.closest?.('a[href*="wa.me/"]');
      if (!link || !isFresh(link)) return;
      const path = window.location.pathname;
      trackEvent("whatsapp_click", {
        placement: link.closest("[data-wa-placement]")?.getAttribute("data-wa-placement") ?? "other",
        service: link.closest("[data-wa-service]")?.getAttribute("data-wa-service"),
        page_type: pageTypeFromPath(path),
        locale: localeFromPath(path),
      });
    };
    document.addEventListener("click", onInteract, true);
    document.addEventListener("auxclick", onInteract, true);
    return () => {
      document.removeEventListener("click", onInteract, true);
      document.removeEventListener("auxclick", onInteract, true);
    };
  }, []);
  return null;
}
