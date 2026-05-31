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
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-50 text-purple-400 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-400 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
