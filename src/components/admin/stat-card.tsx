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
        "group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 shadow-sm hover:-translate-y-0.5",
        accent
          ? "border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 hover:shadow-md hover:shadow-purple-500/10"
          : "border-[var(--os-border)] bg-white hover:shadow-md hover:shadow-purple-900/[0.06]",
        href && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-xl",
          accent ? "bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]" : "bg-[#F1F5F9] text-[#475569]"
        )}>
          {icon}
        </div>
      </div>
      <div className={cn("text-2xl sm:text-3xl font-bold tracking-tight", accent ? "text-[#8B00FF]" : "text-[#0F172A]")}>
        <Counter value={value} suffix={suffix} />
      </div>
      <div className="text-[12px] sm:text-[13px] text-[#64748B] mt-1 font-medium">{label}</div>
    </motion.div>
  );
  if (href) return <Link href={href}>{card}</Link>;
  return card;
}
