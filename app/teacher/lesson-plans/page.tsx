"use client";

// My lesson plans (Phase 9C.2) — real PostgreSQL/API cutover. The
// authenticated teacher's own lesson plans only, resolved via their real
// Staff.id server-side (GET /api/lesson-plans/mine) — never the fake
// CURRENT_TEACHER_ID.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { completeLessonPlanRequest, submitLessonPlanRequest, useLessonPlan, useMyLessonPlanList } from "@/lib/hooks/api/use-lesson-plans-api";
import type { LessonPlanStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<LessonPlanStatusDto, "neutral" | "info" | "success" | "error"> = { draft: "neutral", submitted: "info", approved: "success", rejected: "error", completed: "success" };

function TeacherLessonPlansPageContent() {
  const searchParams = useSearchParams();
  const { data: myPlans, loading, error, reload } = useMyLessonPlanList();
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("open"));
  const { data: detail } = useLessonPlan(detailId ?? undefined);

  async function afterAction() {
    setDetailId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My lesson plans</h1>
        <p className="text-xs text-muted-foreground">Plans you&apos;ve drafted or scheduled</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && myPlans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {myPlans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDetailId(p.id)}
              className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-left hover:bg-surface-secondary/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.subject.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.section.className}-{p.section.name} · {formatDate(p.plannedDate)}{p.period ? ` · Period ${p.period}` : ""}
                </p>
              </div>
              <Badge tone={statusTone[p.status]}>{p.status}</Badge>
            </button>
          ))}
          {myPlans.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No lesson plans yet — this needs a real teaching Staff profile linked to your account.</p>}
        </div>
      )}

      <DetailDrawer open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)} title="Lesson plan" description={detail ? formatDate(detail.plannedDate) : ""}>
        {detail && (
          <div className="flex flex-col gap-sm">
            <Badge tone={statusTone[detail.status]} className="self-start">{detail.status}</Badge>
            <p className="text-sm text-foreground">{detail.learningObjective}</p>
            {detail.activity && <p className="text-xs text-muted-foreground">{detail.activity}</p>}
            {detail.reviewComment && <p className="rounded-md bg-warning/10 p-sm text-xs text-warning">{detail.reviewComment}</p>}
            <div className="flex gap-xs">
              {detail.status === "draft" && (
                <Button size="sm" onClick={async () => { await submitLessonPlanRequest(detail.id); afterAction(); }}>Submit for approval</Button>
              )}
              {detail.status === "approved" && (
                <Button size="sm" variant="outline" onClick={async () => { await completeLessonPlanRequest(detail.id); afterAction(); }}>Mark completed</Button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

export default function TeacherLessonPlansPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <TeacherLessonPlansPageContent />
    </Suspense>
  );
}
