"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-center", className)}>
      <div className="relative mb-6">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--os-hover)] border border-[var(--os-border)] text-[var(--os-text-muted)] os-dark:text-[var(--os-text-soft)] shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--os-text)] mb-1.5">{title}</h3>
      {description && <p className="text-[13px] text-[var(--os-text-soft)] mb-5 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
