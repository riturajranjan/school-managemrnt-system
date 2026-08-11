// Accessible usage meter (Super Admin SA-4G). Renders a real UsageMetricDto vs
// its plan limit. Colour + text both convey state (never colour alone); untracked
// / unlimited / no-subscription states show an honest label instead of a fake bar.
import type { UsageMetricDto } from "@/lib/api/contracts";
import { usageStateLabel } from "@/lib/plans/usage-state";

function fmt(n: number, unit: string | null): string {
  return `${n.toLocaleString("en-IN")}${unit ? ` ${unit}` : ""}`;
}

export function UsageMeter({ metric }: { metric: UsageMetricDto }) {
  const measurable = metric.percent !== null && metric.used !== null && metric.limit !== null;
  const p = measurable ? Math.min(100, Math.round(metric.percent!)) : 0;
  const barColor = metric.state === "LIMIT_REACHED" ? "bg-error" : metric.state === "WARNING" ? "bg-warning" : "bg-success";
  const rightText = measurable
    ? `${fmt(metric.used!, metric.unit)} / ${fmt(metric.limit!, metric.unit)}`
    : metric.state === "UNLIMITED" && metric.used !== null
      ? `${fmt(metric.used, metric.unit)} · Unlimited`
      : usageStateLabel(metric.state);
  const label = measurable
    ? `${metric.label}: ${fmt(metric.used!, metric.unit)} of ${fmt(metric.limit!, metric.unit)} used (${metric.percent}%)${metric.state === "LIMIT_REACHED" ? " — over limit" : metric.state === "WARNING" ? " — near limit" : ""}`
    : `${metric.label}: ${usageStateLabel(metric.state)}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{metric.label}</span>
        <span className={metric.state === "LIMIT_REACHED" ? "text-error" : metric.state === "WARNING" ? "text-warning" : "text-muted-foreground"}>{rightText}</span>
      </div>
      {measurable ? (
        <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-secondary" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className={`h-full rounded-pill ${barColor}`} style={{ width: `${p}%` }} />
        </div>
      ) : (
        <div className="h-2 w-full rounded-pill bg-surface-secondary/60" aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
