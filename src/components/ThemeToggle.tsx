"use client";

import { useEffect, useState } from "react";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi2";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const doc = document.documentElement;
    doc.classList.add("theme-transition");
    doc.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setTimeout(() => doc.classList.remove("theme-transition"), 450);
  }

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-9 h-9 rounded-full border border-line flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors overflow-hidden"
    >
      <span
        key={dark ? "sun" : "moon"}
        className="animate-theme-icon"
      >
        {dark ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />}
      </span>
    </button>
  );
}
