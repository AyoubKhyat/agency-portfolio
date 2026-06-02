import { cn } from "@/lib/utils";

export const PROJECT_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "REVIEW", label: "Review" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PUBLISHED", label: "Published" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];

const STYLES: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  DRAFT:       { text: "text-[#374151]", bg: "bg-[#F3F4F6]", border: "border-[#E5E7EB]", dot: "bg-[#9CA3AF]" },
  IN_PROGRESS: { text: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]", border: "border-[#BFDBFE]", dot: "bg-[#2563EB]" },
  REVIEW:      { text: "text-[#B45309]", bg: "bg-[#FEF3C7]", border: "border-[#FDE68A]", dot: "bg-[#D97706]" },
  COMPLETED:   { text: "text-[#047857]", bg: "bg-[#D1FAE5]", border: "border-[#A7F3D0]", dot: "bg-[#059669]" },
  PUBLISHED:   { text: "text-[#7E22CE]", bg: "bg-[#F3E8FF]", border: "border-[#E9D5FF]", dot: "bg-[#8B00FF]" },
};

const LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_STATUSES.map((s) => [s.value, s.label]),
);

export function projectStatusLabel(value: string | null | undefined): string {
  if (!value) return "Draft";
  return LABELS[value] ?? value.replace(/_/g, " ");
}

export function ProjectStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const key = status && STYLES[status] ? status : "DRAFT";
  const s = STYLES[key];
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        padding,
        s.text,
        s.bg,
        s.border,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {projectStatusLabel(key)}
    </span>
  );
}
