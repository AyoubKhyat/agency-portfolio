import type { ReactNode } from "react";

// Page entrance (fade + 12px rise, 0.35s) driven by CSS (.page-enter in globals.css), so the
// server-rendered page is never held at opacity 0 waiting for JavaScript. The template remounts on
// every navigation, which replays the animation like the previous framer-motion version.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
