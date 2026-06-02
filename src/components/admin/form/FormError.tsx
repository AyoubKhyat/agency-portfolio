"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl",
        className,
      )}
    >
      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <p className="text-[13px] text-red-700 leading-relaxed">{message}</p>
    </div>
  );
}
