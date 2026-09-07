"use client";

import { useState } from "react";

export default function LoadingScreen() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      // The fade is driven entirely by CSS and starts on first paint, so the
      // overlay is never held open on a timer. It unmounts once the fade ends.
      className="loading-screen"
      onAnimationEnd={() => setVisible(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg)",
      }}
    >
      <iframe
        src="/loading.html"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        title="Loading"
      />
    </div>
  );
}
