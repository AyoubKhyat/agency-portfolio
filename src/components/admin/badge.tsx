"use client";

import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  default: "bg-[#F1F5F9] text-[#475569] os-dark:bg-white/[0.06] os-dark:text-[var(--os-text-soft)]",
  purple: "bg-purple-100 text-[#7C3AED] os-dark:bg-purple-500/15 os-dark:text-purple-300",
  blue: "bg-blue-100 text-blue-700 os-dark:bg-blue-500/15 os-dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-700 os-dark:bg-emerald-500/15 os-dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 os-dark:bg-amber-500/15 os-dark:text-amber-300",
  red: "bg-red-100 text-red-700 os-dark:bg-red-500/15 os-dark:text-red-300",
  success: "bg-emerald-100 text-emerald-700 os-dark:bg-emerald-500/15 os-dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 os-dark:bg-amber-500/15 os-dark:text-amber-300",
  error: "bg-red-100 text-red-700 os-dark:bg-red-500/15 os-dark:text-red-300",
};

const dotColors: Record<string, string> = {
  default: "bg-gray-400", purple: "bg-purple-500", blue: "bg-blue-500",
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500",
  success: "bg-emerald-500", warning: "bg-amber-500", error: "bg-red-500",
};

type BadgeProps = {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  size?: "sm" | "md";
};

export function Badge({ variant = "default", children, className, dot, size = "sm" }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-medium rounded-lg",
      size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
      variants[variant] || variants.default,
      className
    )}>
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant] || dotColors.default)} />}
      {children}
    </span>
  );
}
