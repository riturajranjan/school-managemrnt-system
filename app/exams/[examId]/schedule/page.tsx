"use client";

// Exam schedule view (Phase 8A) — real PostgreSQL/API cutover. A read-only,
// date-grouped view of the real schedule built on /exams/[examId]/subjects.
// Auto-generate, Room/Invigilator calendar views and the client conflict engine
// are removed: the server PREVENTS conflicts at save time (see the Subjects
// editor), so there is nothing to detect or auto-resolve here. "Publish" is a
// real status transition (Exam → scheduled), not a results action.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Pencil, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { setExamStatusRequest, useExam, useExamSchedule } from "@/lib/hooks/api/use-exams-api";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function ExamSchedulePage() {
  const params = useParams<{ examId: string }>();
  const { data: exam, reload: reloadExam } = useExam(params.examId);
  const { data: schedule, loading, error } = useExamSchedule(params.examId);
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("exams.publishSchedule");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("exams.view")) {
    return <PermissionDenied action="view the exam schedule" role={roleLabels[role]} backHref="/exams" />;
  }

  if (!exam) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;

  const byDate = new Map<string, typeof schedule>();
  for (const e of schedule ?? []) byDate.set(e.examDate, [...(byDate.get(e.examDate) ?? []), e]);
  const dates = [...byDate.keys()].sort();

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Schedule — {exam.name}</h1>
          <p className="text-xs text-muted-foreground">Real papers, grouped by date</p>
        </div>
        <div className="flex items-center gap-xs">
          <Button asChild size="sm" variant="outline">
            <Link href={`/exams/${exam.id}/subjects`}>
              <Pencil className="size-3.5" />
              Edit schedule
            </Link>
          </Button>
          {canManage && exam.status === "draft" && (
            <Button size="sm" onClick={() => setConfirmPublish(true)}>
              <UploadCloud className="size-3.5" />
              Mark as scheduled
            </Button>
          )}
        </div>
      </div>

      {publishError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{publishError}</p>}
      {error && !loading && <p className="rounded-lg border border-error/30 bg-error/10 p-md text-center text-sm text-error">{error}</p>}

      {loading ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading schedule…</p>
      ) : dates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No papers scheduled yet.</p>
      ) : (
        <div className="flex flex-col gap-md">
          {dates.map((date) => (
            <div key={date} className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                {formatDate(date)}
              </h2>
              <ul className="flex flex-col gap-xs">
                {byDate.get(date)!.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        <span className="mr-2 inline-block size-2 rounded-pill align-middle" style={{ backgroundColor: e.subject.color }} aria-hidden="true" />
                        {e.subject.name} — {e.section.className} {e.section.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{e.startTime}–{e.endTime} · {e.maxMarks} marks{e.invigilator ? ` · Invigilator: ${e.invigilator.name}` : ""}</p>
                    </div>
                    <Badge tone="info">{e.startTime}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Mark this exam as scheduled?"
        description="This moves the exam from Draft to Scheduled."
        confirmLabel="Mark as scheduled"
        onConfirm={async () => {
          setConfirmPublish(false);
          const res = await setExamStatusRequest(exam.id, "scheduled");
          if (!res.success) { setPublishError(res.error.message); return; }
          reloadExam();
        }}
      />
    </div>
  );
}
