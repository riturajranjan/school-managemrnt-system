"use client";

// Exam results (Phase 8C) — real PostgreSQL/API cutover. Results are DERIVED
// live from verified Phase 8B marks (never a second editable marks store)
// until published, at which point an immutable snapshot takes over. Rank,
// GPA/CGPA, supplementary/re-exam and a separate "calculate" step are
// deliberately not built — no real policy exists for any of them (see
// lib/server/results/engine.ts for the documented V1 pass/fail policy).
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useExam } from "@/lib/hooks/api/use-exams-api";
import { publishExamResultsRequest, useExamResults } from "@/lib/hooks/api/use-results-api";
import type { StudentExamResultDto } from "@/lib/api/contracts";
import { formatDateTime } from "@/lib/utils";

const statusTone: Record<string, "success" | "error" | "warning" | "neutral"> = { pass: "success", fail: "error", absent: "neutral", incomplete: "warning" };

export default function ExamResultsPage() {
  const params = useParams<{ examId: string }>();
  const { data: exam } = useExam(params.examId);
  const { data: results, reload } = useExamResults(params.examId);
  const { can } = usePermissions();
  const canPublish = can("results.publish");

  const [detail, setDetail] = useState<StudentExamResultDto | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!exam || !results) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;

  const passCount = results.students.filter((s) => s.status === "pass").length;
  const failCount = results.students.filter((s) => s.status === "fail").length;
  const absentCount = results.students.filter((s) => s.status === "absent").length;

  const columns: ColumnDef<StudentExamResultDto>[] = [
    { id: "student", header: "Student", alwaysVisible: true, cell: (r) => (
      <div><p className="text-sm font-medium text-foreground">{r.name}</p><p className="text-xs text-muted-foreground">Roll {r.rollNumber ?? "—"} · {r.admissionNumber}</p></div>
    ) },
    { id: "marks", header: "Marks", cell: (r) => <span className="text-xs text-muted-foreground">{r.totalMarksObtained}/{r.totalMaxMarks}{r.percentage !== null ? ` · ${r.percentage}%` : ""}</span> },
    { id: "grade", header: "Grade", cell: (r) => (r.grade ? <Badge tone="info">{r.grade}</Badge> : <span className="text-xs text-muted-foreground">—</span>) },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Results — {exam.name}</h1>
          <p className="text-xs text-muted-foreground">{results.gradingSchemeName ? `Grading scheme: ${results.gradingSchemeName}` : "No grading scheme assigned yet"}</p>
        </div>
        <div className="flex items-center gap-xs">
          {results.published ? (
            <Badge tone="success"><CheckCircle2 className="size-3" /> Published</Badge>
          ) : (
            <Badge tone="neutral">Preview — not published</Badge>
          )}
          {!results.published && canPublish && (
            <Button size="sm" onClick={() => setConfirmPublish(true)} disabled={results.studentCount === 0}>
              <ShieldCheck className="size-3.5" /> Publish results
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{error}</p>}

      {results.published && (
        <p className="text-xs text-muted-foreground">Published {results.publishedAt ? formatDateTime(results.publishedAt) : ""} by {results.publishedByName ?? "—"}</p>
      )}

      {!results.gradingSchemeId && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          Assign a grading scheme to this exam (Configuration, on the exam page) before publishing.
        </div>
      )}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Students" value={String(results.studentCount)} icon={Users} tone="neutral" />
        <StatTile label="Pass" value={String(passCount)} tone="success" />
        <StatTile label="Fail" value={String(failCount)} tone="error" />
        <StatTile label="Incomplete" value={String(results.incompleteCount)} tone={results.incompleteCount > 0 ? "warning" : "neutral"} />
      </div>
      {absentCount > 0 && <p className="text-xs text-muted-foreground">{absentCount} student{absentCount === 1 ? "" : "s"} absent overall.</p>}

      <DataTable
        columns={columns}
        rows={results.students}
        getRowId={(r) => r.studentId}
        caption="Exam results"
        onRowClick={setDetail}
        renderMobileCard={(r) => (
          <button type="button" onClick={() => setDetail(r)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
              <Badge tone={statusTone[r.status]}>{r.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.totalMarksObtained}/{r.totalMaxMarks}{r.percentage !== null ? ` · ${r.percentage}%` : ""} {r.grade ? `· ${r.grade}` : ""}</p>
          </button>
        )}
        emptyTitle="No students are eligible for this exam yet"
        emptyDescription="Results appear once papers are scheduled and students are enrolled in the assigned sections."
      />

      <DetailDrawer open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? ""} description={detail ? `Roll ${detail.rollNumber ?? "—"} · ${detail.admissionNumber}` : ""}>
        {detail && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-3 gap-sm text-center text-sm">
              <div className="rounded-md border border-border p-sm"><p className="text-lg font-bold text-foreground">{detail.totalMarksObtained}/{detail.totalMaxMarks}</p><p className="text-xs text-muted-foreground">Marks</p></div>
              <div className="rounded-md border border-border p-sm"><p className="text-lg font-bold text-foreground">{detail.percentage ?? "—"}%</p><p className="text-xs text-muted-foreground">Percentage</p></div>
              <div className="rounded-md border border-border p-sm"><p className="text-lg font-bold text-foreground">{detail.grade ?? "—"}</p><p className="text-xs text-muted-foreground">Grade</p></div>
            </div>
            <Badge tone={statusTone[detail.status]}>{detail.status}</Badge>
            <div className="flex flex-col gap-1">
              {detail.subjects.map((s) => (
                <div key={s.examScheduleEntryId} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                  <div>
                    <p className="font-medium text-foreground">{s.subjectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.markStatus === "marked" ? `${s.marksObtained}/${s.maxMarks}${s.percentage !== null ? ` · ${s.percentage}%` : ""}` : s.markStatus === "unverified" ? "Not yet verified" : s.markStatus === "pending" ? "Not entered" : s.markStatus}
                    </p>
                  </div>
                  <Badge tone={s.passStatus === "pass" ? "success" : s.passStatus === "fail" || s.passStatus === "absent" ? "error" : s.passStatus === "exempt" ? "info" : "warning"}>
                    {s.grade ?? s.passStatus}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish results?"
        description="Freezes every student's result — including the grading bands used — as the official, historical record for this exam. This cannot be undone from here."
        confirmLabel="Publish"
        onConfirm={async () => {
          const res = await publishExamResultsRequest(params.examId);
          if (!res.success) { setError(res.error.message); setConfirmPublish(false); return; }
          setError(null);
          setConfirmPublish(false);
          reload();
        }}
      />
    </div>
  );
}
