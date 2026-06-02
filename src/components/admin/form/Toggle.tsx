"use client";

import { cn } from "@/lib/utils";

export type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group w-full flex items-center justify-between gap-4 text-left",
        "py-2 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#0F172A]">{label}</p>
        {description && <p className="text-[12px] text-[#64748B] mt-0.5">{description}</p>}
      </div>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] shadow-sm shadow-purple-500/30" : "bg-[#CBD5E1]",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
