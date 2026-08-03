// Small, readable, single-hue chart primitives — no charting library. Thin
// 2px marks, rounded ends, one axis, never a rainbow: see the dataviz skill's
// mark spec. Color is always paired with a text label elsewhere in the widget.

export function RadialProgress({
  percent,
  size = 56,
  strokeWidth = 6,
  toneClassName = "text-primary",
  label,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  toneClassName?: string;
  label?: string;
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="text-border" stroke="currentColor" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={toneClassName}
          stroke="currentColor"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-semibold text-foreground">{label ?? `${Math.round(clamped)}%`}</span>
    </div>
  );
}

export function Sparkline({
  data,
  toneClassName = "text-primary",
  width = 96,
  height = 32,
}: {
  data: number[];
  toneClassName?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = data
    .map((value, index) => `${pad + index * stepX},${pad + (height - pad * 2) * (1 - (value - min) / range)}`)
    .join(" ");
  const last = data[data.length - 1];
  const lastPoint = `${pad + (data.length - 1) * stepX},${pad + (height - pad * 2) * (1 - (last - min) / range)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={toneClassName} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.split(",")[0]} cy={lastPoint.split(",")[1]} r={2.5} fill="currentColor" />
    </svg>
  );
}

export function MiniBar({ percent, toneClassName = "bg-primary" }: { percent: number; toneClassName?: string }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary" role="presentation">
      <div className={`h-full rounded-pill ${toneClassName}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
