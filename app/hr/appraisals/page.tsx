"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { advanceReviewStage } from "@/lib/services/hr-service";
import { roleLabels } from "@/lib/permissions/roles";
import { REVIEW_STAGES, reviewStageLabels } from "@/lib/types/hr";

export default function AppraisalsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [cycleId, setCycleId] = useState<string>(db.performanceCycles[0]?.id ?? "");
  const [, force] = useState(0);
  if (!can("hr.view")) return <PermissionDenied action="view appraisals" role={roleLabels[role]} backHref="/hr/performance" />;
  const canManage = can("hr.managePerformance");

  const reviews = db.performanceReviews.filter((r) => r.cycleId === cycleId);
  const empName = (id: string) => { const e = db.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Appraisal cycles</h1>
        <p className="text-xs text-muted-foreground">Self review → Manager → Reviewer → HR → Final discussion → Completed</p>
      </div>

      <div className="flex flex-wrap gap-xs">
        {db.performanceCycles.map((c) => (
          <button key={c.id} onClick={() => setCycleId(c.id)} className={`rounded-pill px-3 py-1.5 text-xs font-medium ${cycleId === c.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{c.name}</button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No reviews in this cycle.</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {reviews.map((r) => {
            const stageIndex = REVIEW_STAGES.indexOf(r.stage);
            return (
              <div key={r.id} className="rounded-lg border border-border bg-surface p-sm">
                <div className="mb-sm flex items-center justify-between gap-sm">
                  <Link href={`/hr/staff/${r.employeeId}`} className="truncate text-sm font-medium text-foreground hover:underline">{empName(r.employeeId)}</Link>
                  <div className="flex items-center gap-xs">
                    <Badge tone={r.stage === "completed" ? "success" : "info"}>{reviewStageLabels[r.stage]}</Badge>
                    {canManage && r.stage !== "completed" && <Button size="sm" variant="outline" onClick={() => { advanceReviewStage(r.id); force((n) => n + 1); }}><Check className="size-3.5" /> Advance</Button>}
                  </div>
                </div>
                {/* Stepper */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {REVIEW_STAGES.map((s, i) => (
                    <div key={s} className="flex items-center gap-1">
                      <span className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${i < stageIndex ? "bg-primary/15 text-primary" : i === stageIndex ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground"}`}>{i + 1}</span>
                      {i < REVIEW_STAGES.length - 1 && <span className={`h-0.5 w-4 rounded-pill ${i < stageIndex ? "bg-primary/50" : "bg-border"}`} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
