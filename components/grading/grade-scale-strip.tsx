import type { GradeRange } from "@/lib/types/grading";
import { cn } from "@/lib/utils";

/** A proportional 0-100% strip of grade bands, each slightly raised — the "elevated
 * grade bands" dimensional identity for the Grading module. Width is proportional to
 * the band's percentage span so the strip doubles as a coverage/gap preview. */
export function GradeScaleStrip({ ranges, className }: { ranges: GradeRange[]; className?: string }) {
  const sorted = [...ranges].sort((a, b) => a.minPercent - b.minPercent);
  if (sorted.length === 0) {
    return <div className={cn("flex h-6 items-center justify-center rounded-md border border-dashed border-border text-[11px] text-muted-foreground", className)}>No grade bands defined</div>;
  }
  return (
    <div className={cn("flex h-6 w-full overflow-hidden rounded-md border border-border shadow-card", className)} role="img" aria-label={`Grade scale: ${sorted.map((r) => `${r.name} ${r.minPercent} to ${r.maxPercent} percent`).join(", ")}`}>
      {sorted.map((r) => (
        <div
          key={r.id}
          title={`${r.name} · ${r.minPercent}%–${r.maxPercent}% ${r.isPass ? "(pass)" : "(fail)"}`}
          className="flex min-w-[1.5rem] items-center justify-center border-r border-black/10 text-[10px] font-semibold text-white last:border-r-0"
          style={{ width: `${Math.max(r.maxPercent - r.minPercent, 1)}%`, backgroundColor: r.color, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 3px rgba(0,0,0,0.18)" }}
        >
          {r.name}
        </div>
      ))}
    </div>
  );
}
