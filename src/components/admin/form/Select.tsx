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
          "w-full h-12 pl-4 pr-10 bg-[var(--os-control-bg)] border rounded-xl appearance-none cursor-pointer",
          "text-[14px] text-[var(--os-text)]",
          "focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/15 focus:border-[#8B00FF]",
          "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          invalid ? "border-red-300 focus:ring-red-200 focus:border-red-500" : "border-[var(--os-control-border)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--os-text-faint)] pointer-events-none" />
    </div>
  );
});
