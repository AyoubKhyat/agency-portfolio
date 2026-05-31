"use client";

const COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function AvatarChip({
  initials,
  name,
  showName = true,
  size = "sm",
  onClick,
  active,
}: {
  initials: string;
  name: string;
  showName?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  onClick?: () => void;
  active?: boolean;
}) {
  const color = colorForName(name);
  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-7 h-7 text-[11px]",
    md: "w-9 h-9 text-xs",
    lg: "w-11 h-11 text-sm",
  };

  const circle = (
    <span
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold shrink-0 ${color.bg} ${color.text} ${active ? "ring-2 ring-violet-500 ring-offset-2" : ""} ${onClick ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
    >
      {initials}
    </span>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="inline-flex items-center gap-2 group" title={name}>
        {circle}
        {showName && <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{name}</span>}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {circle}
      {showName && <span className="text-sm text-gray-700">{name}</span>}
    </span>
  );
}
