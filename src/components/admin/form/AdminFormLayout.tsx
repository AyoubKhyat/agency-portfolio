"use client";

import { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormButton } from "./Button";
import { FormError } from "./FormError";

export type AdminFormLayoutProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  primaryLabel: string;
  primaryLoadingLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onSubmit: (e: FormEvent) => void;
  saving?: boolean;
  dirty?: boolean;
  error?: string | null;
  secondaryAction?: ReactNode;
  children: ReactNode;
};

export function AdminFormLayout({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  primaryLabel,
  primaryLoadingLabel,
  cancelLabel = "Cancel",
  onCancel,
  onSubmit,
  saving,
  dirty,
  error,
  secondaryAction,
  children,
}: AdminFormLayoutProps) {
  return (
    <form onSubmit={onSubmit} className="pb-24 lg:pb-0">
      {/* Sticky header */}
      <div
        className={cn(
          "sticky top-0 lg:top-0 z-30",
          "-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6",
          "bg-[#F8FAFC]/85 backdrop-blur-xl border-b border-[#E2E8F0]",
        )}
      >
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#8B00FF] transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {backLabel}
          </Link>
        )}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F172A] tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {dirty && !saving && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-[11px] font-semibold text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            )}
            {secondaryAction}
            {onCancel && (
              <FormButton type="button" variant="ghost" onClick={onCancel}>
                {cancelLabel}
              </FormButton>
            )}
            <FormButton type="submit" variant="primary" loading={saving}>
              {saving ? primaryLoadingLabel ?? "Saving..." : primaryLabel}
            </FormButton>
          </div>
        </div>
        {error && (
          <div className="mt-3">
            <FormError message={error} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="space-y-6">{children}</div>

      {/* Mobile sticky footer */}
      <div
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-30",
          "px-4 py-3 bg-white/95 backdrop-blur-xl border-t border-[#E2E8F0] shadow-[0_-4px_16px_-4px_rgba(15,23,42,0.08)]",
          "flex items-center gap-2",
        )}
      >
        {onCancel && (
          <FormButton type="button" variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </FormButton>
        )}
        <FormButton type="submit" variant="primary" loading={saving} className="flex-1">
          {saving ? primaryLoadingLabel ?? "Saving..." : primaryLabel}
        </FormButton>
      </div>
    </form>
  );
}
