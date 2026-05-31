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
    <div className={cn("flex gap-1", scrollable && "overflow-x-auto pb-1 scrollbar-none", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150",
            size === "sm" ? "text-[12px] px-3 py-1.5" : "text-[13px] px-3.5 py-2",
            active === item.value
              ? "bg-purple-100 text-purple-700 border border-purple-200/60"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/60 border border-transparent"
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
              active === item.value ? "bg-purple-200/60 text-purple-700" : "bg-gray-100 text-gray-500"
            )}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
