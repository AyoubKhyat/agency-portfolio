"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full h-12 px-4 bg-white border rounded-xl",
        "text-[14px] text-[#0F172A] placeholder:text-[#94A3B8]",
        "focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/15 focus:border-[#8B00FF]",
        "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        invalid ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-[#E2E8F0]",
        className,
      )}
      {...props}
    />
  );
});
