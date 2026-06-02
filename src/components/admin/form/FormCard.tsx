"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FormCardProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  padding?: "default" | "compact" | "none";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

const PADDING = {
  default: "p-6",
  compact: "p-5",
  none: "",
};

export function FormCard({
  title,
  subtitle,
  icon,
  action,
  footer,
  padding = "default",
  className,
  bodyClassName,
  children,
}: FormCardProps) {
  const hasHeader = !!(title || subtitle || action);
  return (
    <section
      className={cn(
        "bg-white border border-[#E2E8F0] rounded-2xl shadow-sm shadow-slate-900/[0.02]",
        "transition-shadow hover:shadow-md hover:shadow-slate-900/[0.04]",
        className,
      )}
    >
      {hasHeader && (
        <div className={cn("flex items-start gap-3 px-6 pt-6 pb-4", padding === "compact" && "px-5 pt-5 pb-3")}>
          {icon && (
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF] shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-[15px] font-semibold text-[#0F172A] leading-tight">{title}</h3>
            )}
            {subtitle && (
              <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(PADDING[padding], hasHeader && padding !== "none" && "pt-0", bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] rounded-b-2xl">
          {footer}
        </div>
      )}
    </section>
  );
}
