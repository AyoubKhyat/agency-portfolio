"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[12px] font-semibold text-[#475569] uppercase tracking-[0.06em]"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-[#94A3B8]">{hint}</p>
      ) : null}
    </div>
  );
}
