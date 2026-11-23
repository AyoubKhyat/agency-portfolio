"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type FormButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[12px] rounded-lg gap-1.5",
  md: "h-11 px-5 text-[13px] rounded-xl gap-2",
  lg: "h-12 px-6 text-[14px] rounded-xl gap-2",
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--os-btn-a)] to-[var(--os-btn-b)] text-[var(--os-on-accent)] font-semibold hover:brightness-110 disabled:hover:brightness-100 disabled:opacity-60",
  secondary:
    "bg-[var(--os-control-bg)] border border-[var(--os-control-border)] text-[var(--os-text)] font-medium hover:bg-[var(--os-control-hover)] hover:border-[#CBD5E1] [.os-dark_&]:hover:border-[var(--os-border-hover)] disabled:opacity-60",
  ghost:
    "bg-transparent text-[var(--os-text-muted)] font-medium hover:text-[var(--os-text)] hover:bg-[var(--os-hover)] disabled:opacity-60",
  danger:
    "bg-red-50 text-red-600 font-medium border border-red-100 hover:bg-red-100 disabled:opacity-60",
};

export const FormButton = forwardRef<HTMLButtonElement, FormButtonProps>(function FormButton(
  { className, variant = "primary", size = "md", loading, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-200 select-none",
        SIZES[size],
        VARIANTS[variant],
        "disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});
