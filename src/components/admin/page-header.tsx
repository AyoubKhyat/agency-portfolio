"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  count?: number;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, count, actions, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8", className)}
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--os-text)] tracking-tight flex items-center gap-3">
          {title}
          {typeof count === "number" && (
            <span className="text-sm sm:text-base font-normal text-[var(--os-text-dim)]">({count})</span>
          )}
        </h1>
        {subtitle && <p className="text-xs sm:text-sm text-[var(--os-text-muted)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 shrink-0">{actions}</div>}
    </motion.div>
  );
}
