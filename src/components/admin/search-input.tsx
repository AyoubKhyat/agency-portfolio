"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchInput({ value, onChange, placeholder = "Search...", className }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm bg-white/80 border border-[var(--os-border)] rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all duration-150"
      />
    </div>
  );
}
