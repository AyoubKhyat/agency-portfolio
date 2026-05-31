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
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 blur-xl" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 text-[#8B00FF] shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-[#0F172A] mb-1.5">{title}</h3>
      {description && <p className="text-[13px] text-[#64748B] mb-5 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
