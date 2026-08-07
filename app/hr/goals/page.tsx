"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { updateGoalProgress } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { goalStatusTone, type GoalStatus } from "@/lib/types/hr";

export default function GoalsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [filter, setFilter] = useState<GoalStatus | "all">("all");
  const [, force] = useState(0);
  if (!can("hr.view")) return <PermissionDenied action="view goals" role={roleLabels[role]} backHref="/hr/performance" />;
  const canManage = can("hr.managePerformance");

  const empName = (id: string) => { const e = db.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const rows = filter === "all" ? db.performanceGoals : db.performanceGoals.filter((g) => g.status === filter);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Goals & OKRs</h1>
        <p className="text-xs text-muted-foreground">{db.performanceGoals.length} goals across the team</p>
      </div>

      <div className="flex flex-wrap gap-xs">
        {(["all", "active", "at-risk", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-pill px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{f.replace("-", " ")}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Target className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No goals in this view.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.slice(0, 40).map((g) => (
            <div key={g.id} className="rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{g.title}</p>
                  <Link href={`/hr/staff/${g.employeeId}`} className="text-xs text-muted-foreground hover:underline">{empName(g.employeeId)}</Link>
                </div>
                <Badge tone={goalStatusTone[g.status]}>{g.status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-sm">
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-secondary">
                  <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${g.progress}%` }} />
                </div>
                <span className="w-9 text-right text-xs font-medium text-foreground">{g.progress}%</span>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" aria-label="Decrease" onClick={() => { updateGoalProgress(g.id, g.progress - 10); force((n) => n + 1); }}><Minus className="size-3.5" /></Button>
                    <Button size="icon" variant="outline" aria-label="Increase" onClick={() => { updateGoalProgress(g.id, g.progress + 10); force((n) => n + 1); }}><Plus className="size-3.5" /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
