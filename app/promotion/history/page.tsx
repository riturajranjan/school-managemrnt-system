"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { usePromotionRuns } from "@/lib/hooks/use-exams";
import { formatDateTime } from "@/lib/utils";

export default function PromotionHistoryPage() {
  const runs = usePromotionRuns();
  const classes = useManagedClasses();

  const sorted = [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Promotion history</h1>
        <p className="text-xs text-muted-foreground">Every promotion run across classes and sessions</p>
      </div>

      <div className="flex flex-col gap-1">
        {sorted.map((run) => {
          const className = classes.find((c) => c.id === run.classId)?.name ?? run.classId;
          const promoted = run.decisions.filter((d) => d.decision === "promote" || d.decision === "conditional-promotion").length;
          const retained = run.decisions.filter((d) => d.decision === "retain").length;
          return (
            <Link
              key={run.id}
              href={`/promotion/run?runId=${run.id}`}
              className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {className} · {run.fromSession} → {run.toSession}
                </p>
                <p className="text-xs text-muted-foreground">
                  {promoted} promoted · {retained} retained · {run.confirmedAt ? formatDateTime(run.confirmedAt) : `Created ${formatDateTime(run.createdAt)}`}
                </p>
              </div>
              <Badge tone={run.status === "completed" ? "success" : run.status === "rolled-back" ? "error" : "neutral"}>{run.status}</Badge>
            </Link>
          );
        })}
        {sorted.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No promotion runs yet.</p>}
      </div>
    </div>
  );
}
