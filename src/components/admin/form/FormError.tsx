"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl [.os-dark_&]:bg-[var(--os-danger-bg)] [.os-dark_&]:border-[var(--os-danger-border)]",
        className,
      )}
    >
      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <p className="text-[13px] text-red-700 [.os-dark_&]:text-[var(--os-danger-fg)] leading-relaxed">{message}</p>
    </div>
  );
}
