"use client";

import { useEffect } from "react";

// Scroll reveals for the homepage. Content is visible by default; the hiding class is
// only added once JS runs and the visitor hasn't asked for reduced motion.
export default function RevealController({ rootId, hiddenClass }: { rootId: string; hiddenClass: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add(hiddenClass);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove(hiddenClass);
    };
  }, [rootId, hiddenClass]);
  return null;
}
