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
        "w-full px-4 py-3 bg-white border rounded-xl resize-y min-h-[96px]",
        "text-[14px] leading-relaxed text-[#0F172A] placeholder:text-[#94A3B8]",
        "focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/15 focus:border-[#8B00FF]",
        "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        invalid ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-[#E2E8F0]",
        className,
      )}
      {...props}
    />
  );
});
