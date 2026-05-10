"use client";

import { useEffect, useState, useRef } from "react";

export default function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setFading(true);
      fadeRef.current = setTimeout(() => {
        setVisible(false);
      }, 800);
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        transition: "opacity 0.8s ease",
        opacity: fading ? 0 : 1,
        pointerEvents: "auto",
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
