"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { CURRENT_TEACHER_ID } from "@/lib/current-user";
import { useSisStore } from "@/lib/hooks/use-store";
import { markLessonPlanCompleted, submitForApproval } from "@/lib/services/lesson-plan-service";
import { lessonPlanStatusTone, type LessonPlan } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

export default function TeacherLessonPlansPage() {
  const db = useSisStore();
  const [detail, setDetail] = useState<LessonPlan | null>(null);
  const myPlans = db.lessonPlans.filter((p) => p.teacherId === CURRENT_TEACHER_ID);

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My lesson plans</h1>
        <p className="text-xs text-muted-foreground">Plans you&apos;ve drafted or scheduled</p>
      </div>

      <div className="flex flex-col gap-sm">
        {myPlans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setDetail(p)}
            className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-left hover:bg-surface-secondary/60"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{db.subjects.find((s) => s.id === p.subjectId)?.name}</p>
              <p className="text-xs text-muted-foreground">
                {findClass(p.classId)?.name}-{findSection(p.sectionId)?.section.name} · {formatDate(p.date)} · Period {p.period}
              </p>
            </div>
            <Badge tone={lessonPlanStatusTone[p.status]}>{p.status}</Badge>
          </button>
        ))}
        {myPlans.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No lesson plans yet.</p>}
      </div>

      <DetailDrawer open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title="Lesson plan" description={detail ? formatDate(detail.date) : ""}>
        {detail && (
          <div className="flex flex-col gap-sm">
            <Badge tone={lessonPlanStatusTone[detail.status]} className="self-start">
              {detail.status}
            </Badge>
            <p className="text-sm text-foreground">{detail.learningObjective}</p>
            <p className="text-xs text-muted-foreground">{detail.activity}</p>
            {detail.reviewComment && <p className="rounded-md bg-warning/10 p-sm text-xs text-warning">{detail.reviewComment}</p>}
            <div className="flex gap-xs">
              {detail.status === "draft" && (
                <Button size="sm" onClick={() => { submitForApproval(detail.id); setDetail(null); }}>
                  Submit for approval
                </Button>
              )}
              {(detail.status === "approved" || detail.status === "scheduled") && (
                <Button size="sm" variant="outline" onClick={() => { markLessonPlanCompleted(detail.id); setDetail(null); }}>
                  Mark completed
                </Button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
