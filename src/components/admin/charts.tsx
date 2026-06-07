"use client";

import { useEffect, useState, useRef } from "react";

// ── Shared color palette ──────────────────────────────────────────
const COLORS = [
  "#8B5CF6", // purple
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#6366F1", // indigo
  "#14B8A6", // teal
];

const PIPELINE_COLORS: Record<string, string> = {
  A_ENVOYER: "#94A3B8",
  ENVOYE: "#F59E0B",
  REPONDU: "#10B981",
  MEETING: "#3B82F6",
  PROPOSAL_SENT: "#8B5CF6",
  CLIENT: "#EC4899",
};

const FUNNEL_COLORS: Record<string, string> = {
  NEW: "#3B82F6",
  CONTACTED: "#F59E0B",
  QUALIFIED: "#10B981",
  CLOSED: "#6366F1",
};

const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "To Send",
  ENVOYE: "Sent",
  REPONDU: "Replied",
  MEETING: "Meeting",
  PROPOSAL_SENT: "Proposal",
  CLIENT: "Client",
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
};

// ── 1. FunnelChart ────────────────────────────────────────────────
type FunnelItem = { status: string; count: number };

export function FunnelChart({ data }: { data: FunnelItem[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = (item.count / maxCount) * 100;
        const funnelPct = total > 0 ? ((item.count / total) * 100).toFixed(0) : "0";
        const color = FUNNEL_COLORS[item.status] || COLORS[i % COLORS.length];
        return (
          <div key={item.status}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[#475569]">
                {STATUS_LABELS[item.status] || item.status}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#94A3B8]">{funnelPct}%</span>
                <span className="text-sm font-bold text-[#0F172A]">{item.count}</span>
              </div>
            </div>
            <div className="h-7 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg transition-all duration-1000 ease-out"
                style={{
                  width: mounted ? `${Math.max(pct, 3)}%` : "0%",
                  backgroundColor: color,
                  opacity: 0.85,
                  transitionDelay: `${i * 120}ms`,
                }}
                title={`${STATUS_LABELS[item.status] || item.status}: ${item.count}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 2. BarChart (vertical) ────────────────────────────────────────
type BarItem = { label: string; value: number; color?: string };

export function BarChart({ data, height = 180 }: { data: BarItem[]; height?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = data.length > 0 ? Math.min(40, Math.floor(100 / data.length) - 4) : 40;

  return (
    <div className="flex flex-col">
      <div
        className="flex items-end justify-around gap-1 px-2"
        style={{ height: `${height}px` }}
      >
        {data.map((item, i) => {
          const barH = (item.value / maxVal) * (height - 28);
          const color = item.color || COLORS[i % COLORS.length];
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-[10px] font-semibold text-[#475569]">{item.value}</span>
              <div
                className="rounded-t-md transition-all duration-700 ease-out w-full"
                style={{
                  maxWidth: `${barWidth}px`,
                  height: mounted ? `${Math.max(barH, 4)}px` : "4px",
                  backgroundColor: color,
                  opacity: 0.8,
                  transitionDelay: `${i * 80}ms`,
                }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-around gap-1 px-2 mt-2 border-t border-gray-100 pt-2">
        {data.map((item, i) => (
          <span key={i} className="text-[10px] text-[#94A3B8] text-center flex-1 truncate">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 3. DonutChart ─────────────────────────────────────────────────
type DonutItem = { label: string; value: number; color?: string };

export function DonutChart({ data, size = 180 }: { data: DonutItem[]; size?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 20) / 2;
  const strokeWidth = radius * 0.35;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={cx}
            cy={cy}
            r={innerRadius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {/* Data segments */}
          {data.map((item, i) => {
            const segmentLength = total > 0 ? (item.value / total) * circumference : 0;
            const offset = cumulativeOffset;
            cumulativeOffset += segmentLength;
            const color = item.color || COLORS[i % COLORS.length];
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={innerRadius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                className="transition-all duration-1000 ease-out"
                style={{
                  opacity: mounted ? 0.85 : 0,
                  transitionDelay: `${i * 150}ms`,
                }}
              >
                <title>{`${item.label}: ${item.value}`}</title>
              </circle>
            );
          })}
        </svg>
        {/* Center total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#0F172A]">{total}</span>
          <span className="text-[10px] text-[#94A3B8]">Total</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {data.map((item, i) => {
          const color = item.color || COLORS[i % COLORS.length];
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-[#475569] truncate flex-1">{item.label}</span>
              <span className="text-[11px] font-semibold text-[#0F172A]">{item.value}</span>
              <span className="text-[10px] text-[#94A3B8]">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 4. LineChart ──────────────────────────────────────────────────
type LinePoint = { label: string; value: number };

export function LineChart({
  data,
  height = 200,
  color = "#8B5CF6",
  formatValue,
}: {
  data: LinePoint[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const [mounted, setMounted] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    setMounted(true);
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      pathRef.current.style.strokeDasharray = `${length}`;
      pathRef.current.style.strokeDashoffset = `${length}`;
      requestAnimationFrame(() => {
        if (pathRef.current) {
          pathRef.current.style.transition = "stroke-dashoffset 1.2s ease-out";
          pathRef.current.style.strokeDashoffset = "0";
        }
      });
    }
  }, [data]);

  if (data.length === 0) return null;

  const padding = { top: 20, right: 15, bottom: 35, left: 50 };
  const svgWidth = 600;
  const svgHeight = height;
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  // Round max up for cleaner grid lines
  const gridMax = Math.ceil(maxVal / (Math.pow(10, Math.floor(Math.log10(maxVal || 1))))) * Math.pow(10, Math.floor(Math.log10(maxVal || 1)));
  const gridLines = 4;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH - (d.value / (gridMax || 1)) * chartH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Gradient fill path
  const fillD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const fmt = formatValue || ((v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v));

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lineGradientFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padding.top + (i / gridLines) * chartH;
        const val = gridMax - (i / gridLines) * gridMax;
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={svgWidth - padding.right}
              y2={y}
              stroke="#F1F5F9"
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[10px]" fill="#94A3B8" fontSize="10">
              {fmt(Math.round(val))}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path
        d={fillD}
        fill="url(#lineGradientFill)"
        className="transition-opacity duration-1000"
        style={{ opacity: mounted ? 1 : 0 }}
      />

      {/* Line */}
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4"
            fill="white"
            stroke={color}
            strokeWidth="2"
            className="transition-all duration-500"
            style={{
              opacity: mounted ? 1 : 0,
              transitionDelay: `${600 + i * 100}ms`,
            }}
          >
            <title>{`${p.label}: ${fmt(p.value)}`}</title>
          </circle>
          {/* X-axis labels */}
          <text
            x={p.x}
            y={svgHeight - 8}
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="10"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── 5. HorizontalBarChart ─────────────────────────────────────────
type HBarItem = { label: string; value: number; color?: string };

export function HorizontalBarChart({ data }: { data: HBarItem[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {data.map((item, i) => {
        const pct = (item.value / maxVal) * 100;
        const color = item.color || COLORS[i % COLORS.length];
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#475569] truncate max-w-[60%]">{item.label}</span>
              <span className="text-[12px] font-semibold text-[#0F172A]">{item.value}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-800 ease-out"
                style={{
                  width: mounted ? `${Math.max(pct, 2)}%` : "0%",
                  backgroundColor: color,
                  opacity: 0.8,
                  transitionDelay: `${i * 100}ms`,
                }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 6. PipelineFunnel (for prospect pipeline) ─────────────────────
export function PipelineFunnel({ data }: { data: FunnelItem[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = (item.count / maxCount) * 100;
        const funnelPct = total > 0 ? ((item.count / total) * 100).toFixed(0) : "0";
        const color = PIPELINE_COLORS[item.status] || COLORS[i % COLORS.length];
        const convRate = i > 0 && data[i - 1].count > 0
          ? ((item.count / data[i - 1].count) * 100).toFixed(0) + "%"
          : null;
        return (
          <div key={item.status}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-medium text-[#475569]">
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {convRate && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-[#64748B]">
                    {convRate}
                  </span>
                )}
                <span className="text-[10px] text-[#94A3B8]">{funnelPct}%</span>
                <span className="text-sm font-bold text-[#0F172A]">{item.count}</span>
              </div>
            </div>
            <div className="h-5 bg-gray-100 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-1000 ease-out"
                style={{
                  width: mounted ? `${Math.max(pct, 3)}%` : "0%",
                  backgroundColor: color,
                  opacity: 0.75,
                  transitionDelay: `${i * 120}ms`,
                }}
                title={`${STATUS_LABELS[item.status] || item.status}: ${item.count}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 7. TeamPerformanceChart ───────────────────────────────────────
type TeamMember = {
  name: string;
  initials: string;
  sent: number;
  replied: number;
  converted: number;
};

export function TeamPerformanceChart({ data }: { data: TeamMember[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const maxVal = Math.max(...data.map((d) => Math.max(d.sent, d.replied, d.converted)), 1);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
          Sent
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          Replied
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
          Converted
        </div>
      </div>
      {/* Bars */}
      <div className="space-y-4">
        {data.map((member, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-[10px] font-bold text-purple-700 shrink-0">
                {member.initials}
              </div>
              <span className="text-[12px] font-medium text-[#1E293B] truncate">{member.name}</span>
            </div>
            <div className="space-y-1.5 pl-9">
              {([
                { label: "Sent", value: member.sent, color: "#3B82F6" },
                { label: "Replied", value: member.replied, color: "#10B981" },
                { label: "Converted", value: member.converted, color: "#8B5CF6" },
              ] as const).map((metric) => {
                const pct = (metric.value / maxVal) * 100;
                return (
                  <div key={metric.label} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-800 ease-out"
                        style={{
                          width: mounted ? `${Math.max(pct, 1)}%` : "0%",
                          backgroundColor: metric.color,
                          opacity: 0.8,
                          transitionDelay: `${idx * 150 + 100}ms`,
                        }}
                        title={`${member.name} - ${metric.label}: ${metric.value}`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-[#475569] w-5 text-right">{metric.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
