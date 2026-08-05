import type { LucideIcon } from "lucide-react";
import { toneClasses } from "@/components/dashboard/tone";
import type { StatusTone } from "@/lib/types/common";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <div className={cn("surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface px-sm py-sm", className)}>
      <div className="flex items-center justify-between gap-xs">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", toneClasses[tone].soft)}>
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="text-lg font-bold text-foreground sm:text-xl">{value}</span>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
