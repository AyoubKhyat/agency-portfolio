"use client";

import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full px-4 py-3 bg-[var(--os-control-bg)] border rounded-xl resize-y min-h-[96px]",
        "text-[14px] leading-relaxed text-[var(--os-text)] placeholder:text-[var(--os-text-faint)]",
        "focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/15 focus:border-[#8B00FF]",
        "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        invalid ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-[var(--os-control-border)]",
        className,
      )}
      {...props}
    />
  );
});
