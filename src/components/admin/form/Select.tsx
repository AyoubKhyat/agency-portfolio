"use client";

import { forwardRef, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full h-12 pl-4 pr-10 bg-white border rounded-xl appearance-none cursor-pointer",
          "text-[14px] text-[#0F172A]",
          "focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/15 focus:border-[#8B00FF]",
          "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          invalid ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-[#E2E8F0]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
    </div>
  );
});
