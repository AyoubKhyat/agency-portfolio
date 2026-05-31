"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";

type StatCardProps = {
  value: number;
  label: string;
  icon: ReactNode;
  href?: string;
  accent?: boolean;
  suffix?: string;
  index?: number;
  className?: string;
};

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else { setCount(Math.floor(current)); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <>{count}{suffix}</>;
}

export function StatCard({ value, label, icon, href, accent, suffix, index = 0, className }: StatCardProps) {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "group relative rounded-2xl border p-5 transition-all duration-200 shadow-sm",
        accent
          ? "border-purple-200/60 bg-gradient-to-br from-purple-50 to-violet-50/50 hover:shadow-md hover:shadow-purple-500/[0.06]"
          : "border-[var(--os-border)] bg-white/75 backdrop-blur-xl hover:shadow-md hover:shadow-purple-500/[0.04]",
        href && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-xl",
          accent ? "bg-purple-100 text-purple-600" : "bg-gray-50 text-gray-500"
        )}>
          {icon}
        </div>
      </div>
      <div className={cn("text-3xl font-semibold tracking-tight", accent ? "text-purple-700" : "text-gray-900")}>
        <Counter value={value} suffix={suffix} />
      </div>
      <div className="text-[13px] text-gray-500 mt-1">{label}</div>
    </motion.div>
  );
  if (href) return <Link href={href}>{card}</Link>;
  return card;
}
