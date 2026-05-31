"use client";

import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  default: "bg-gray-100 text-gray-600",
  purple: "bg-purple-50 text-purple-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-600",
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
