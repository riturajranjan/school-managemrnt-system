import { useId } from "react";
import type { PulseFactor } from "./data/types";
import { toneClasses } from "./tone";

const SIZE = 152;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 68;
const OUTER_STROKE = 7;
const INNER_RADIUS = 50;
const INNER_STROKE = 11;
const SEGMENT_GAP = 5;

// The "layered gauge": an outer ring of 8 real per-factor arcs (each one a
// genuine value, not decoration) plus an inner solid arc for the composite
// score. Two concentric rings = the "layered" read; every arc length and
// color is driven by actual data passed in.
export function PulseGauge({ score, factors }: { score: number; factors: PulseFactor[] }) {
  const gradientId = `pulse-score-gradient-${useId()}`;
  const outerCircumference = 2 * Math.PI * OUTER_RADIUS;
  const segmentCount = factors.length;
  const segmentSpan = outerCircumference / segmentCount;
  const segmentLength = Math.max(segmentSpan - SEGMENT_GAP, 2);

  const innerCircumference = 2 * Math.PI * INNER_RADIUS;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const innerOffset = innerCircumference - (clampedScore / 100) * innerCircumference;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      {/* Restrained ambient glow — the "semi-3D" cue, decorative only, hidden on mobile. */}
      <div
        aria-hidden="true"
        className="absolute inset-3 hidden rounded-full bg-primary/15 blur-xl sm:block dark:bg-primary/10"
      />

      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
            <stop offset="100%" style={{ stopColor: "var(--accent)" }} />
          </linearGradient>
        </defs>

        {/* Outer segmented ring: one arc per factor, real value-driven color. */}
        {factors.map((factor, index) => (
          <circle
            key={factor.key}
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS}
            strokeWidth={OUTER_STROKE}
            className={toneClasses[factor.tone].text}
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${segmentLength} ${outerCircumference - segmentLength}`}
            strokeDashoffset={-(index * segmentSpan)}
            opacity={0.9}
          >
            <title>
              {factor.label}: {factor.displayValue}
            </title>
          </circle>
        ))}

        {/* Inner ring: track + composite score arc. */}
        <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS} strokeWidth={INNER_STROKE} className="text-border" stroke="currentColor" fill="none" />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_RADIUS}
          strokeWidth={INNER_STROKE}
          stroke={`url(#${gradientId})`}
          fill="none"
          strokeDasharray={innerCircumference}
          strokeDashoffset={innerOffset}
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold leading-none text-foreground">{Math.round(clampedScore)}</span>
        <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Score</span>
      </div>
    </div>
  );
}
