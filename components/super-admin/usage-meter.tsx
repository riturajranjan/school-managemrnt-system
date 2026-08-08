import { usageKeyLabels, usageKeyUnit, type TenantUsageMetric } from "@/lib/types/saas";

function pct(u: TenantUsageMetric) { return u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0; }
function toneFor(p: number) { return p >= 100 ? "error" : p >= 90 ? "error" : p >= 80 ? "warning" : "success"; }

/** Accessible used/limit meter. Colour + text both convey the state (never
 * colour alone) — screen readers get the full "used of limit" sentence. */
export function UsageMeter({ metric }: { metric: TenantUsageMetric }) {
  const p = pct(metric);
  const unit = usageKeyUnit[metric.key];
  const tone = toneFor(p);
  const barColor = tone === "error" ? "bg-error" : tone === "warning" ? "bg-warning" : "bg-success";
  const label = `${usageKeyLabels[metric.key]}: ${metric.used}${unit ? ` ${unit}` : ""} of ${metric.limit}${unit ? ` ${unit}` : ""} used (${p}%)${p >= 80 ? p >= 100 ? " — over limit" : " — near limit" : ""}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{usageKeyLabels[metric.key]}</span>
        <span className={p >= 90 ? "text-error" : p >= 80 ? "text-warning" : "text-muted-foreground"}>{metric.used.toLocaleString("en-IN")}{unit && ` ${unit}`} / {metric.limit.toLocaleString("en-IN")}{unit && ` ${unit}`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-secondary" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-pill ${barColor}`} style={{ width: `${p}%` }} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
