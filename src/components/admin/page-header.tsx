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
      className={cn("flex items-center justify-between mb-8", className)}
    >
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
          {title}
          {typeof count === "number" && (
            <span className="text-base font-normal text-gray-400">({count})</span>
          )}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}
