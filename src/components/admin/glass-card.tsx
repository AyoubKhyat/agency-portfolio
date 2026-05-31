"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

type GlassCardProps = HTMLMotionProps<"div"> & {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  glow?: boolean;
};

const paddings = { none: "", sm: "p-3", md: "p-5", lg: "p-6" };

export function GlassCard({ className, hover, padding = "md", glow, children, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "rounded-2xl border border-[var(--os-border)] bg-white shadow-sm",
        paddings[padding],
        hover && "transition-all duration-200 hover:border-[var(--os-border-hover)] hover:shadow-md hover:shadow-purple-900/[0.06] hover:-translate-y-0.5",
        glow && "hover:shadow-lg hover:shadow-purple-500/[0.08]",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
