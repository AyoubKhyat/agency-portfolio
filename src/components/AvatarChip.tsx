"use client";

const COLORS = [
  "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-green-500/20 text-green-400 border-green-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
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
}: {
  initials: string;
  name: string;
  showName?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const color = colorForName(name);
  const sizeClass = size === "xs" ? "w-5 h-5 text-[9px]" : size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${sizeClass} rounded-full border flex items-center justify-center font-bold shrink-0 ${color}`}>
        {initials}
      </span>
      {showName && <span className="text-xs text-gray-300 truncate">{name}</span>}
    </span>
  );
}
