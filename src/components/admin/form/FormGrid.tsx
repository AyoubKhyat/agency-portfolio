"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GridLayout = "split-70-30" | "stack" | "two-col";

const LAYOUTS: Record<GridLayout, string> = {
  "split-70-30": "grid grid-cols-1 lg:grid-cols-3 gap-6",
  "stack": "space-y-6",
  "two-col": "grid grid-cols-1 sm:grid-cols-2 gap-4",
};

export function FormGrid({
  layout = "stack",
  className,
  children,
}: {
  layout?: GridLayout;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(LAYOUTS[layout], className)}>{children}</div>;
}

export function FormGridMain({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("lg:col-span-2 space-y-6", className)}>{children}</div>;
}

export function FormGridAside({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
