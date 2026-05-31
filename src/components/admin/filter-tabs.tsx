"use client";

import { cn } from "@/lib/utils";

type FilterItem = { value: string; label: string; count?: number };

type FilterTabsProps = {
  items: FilterItem[];
  active: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  scrollable?: boolean;
};

export function FilterTabs({ items, active, onChange, size = "sm", className, scrollable }: FilterTabsProps) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto pb-1 scrollbar-none", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150",
            size === "sm" ? "text-[12px] px-3 py-1.5" : "text-[13px] px-3.5 py-2",
            active === item.value
              ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#7C3AED] border border-purple-200"
              : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-transparent"
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
              active === item.value ? "bg-purple-200 text-[#7C3AED]" : "bg-[#F1F5F9] text-[#475569]"
            )}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
