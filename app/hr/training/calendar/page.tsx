"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { trainingCategoryLabels } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

export default function TrainingCalendarPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view the training calendar" role={roleLabels[role]} backHref="/hr/training" />;

  const sorted = [...db.trainingCourses].filter((c) => c.status !== "cancelled").sort((a, b) => a.startDate.localeCompare(b.startDate));
  const byDate = new Map<string, typeof sorted>();
  for (const c of sorted) { const l = byDate.get(c.startDate) ?? []; l.push(c); byDate.set(c.startDate, l); }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Training calendar</h1>
        <p className="text-xs text-muted-foreground">Sessions by start date</p>
      </div>

      {byDate.size === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CalendarClock className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No sessions scheduled.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date}>
              <p className="mb-xs text-sm font-semibold text-foreground">{formatDate(date)}</p>
              <div className="flex flex-col gap-xs">
                {list.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{trainingCategoryLabels[c.category]} · {c.durationHours}h · {c.deliveryType}</p>
                    </div>
                    <Badge tone={c.status === "completed" ? "success" : c.status === "in-progress" ? "warning" : "info"}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
