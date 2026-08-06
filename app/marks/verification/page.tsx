"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { useStudents } from "@/lib/hooks/use-students";
import { subjectById } from "@/lib/data/seed/academics";
import { computeMarksSummary } from "@/lib/selectors/marks-summary";
import { approveMarks, bulkVerify, lockVerification, reopenVerification, requestCorrection, verifyMarks } from "@/lib/services/marks-verification-service";
import { marksVerificationStatusLabels, marksVerificationStageLabels, type MarksVerification } from "@/lib/types/marks";
import type { ExamSubject } from "@/lib/types/exams";
import { formatDateTime } from "@/lib/utils";

const ACTOR_BY_STAGE = { verify: { name: "Examination Controller", role: "Examination Controller" }, approve: { name: "Principal", role: "Principal" } };

type Row = { examSubject: ExamSubject; verification: MarksVerification | undefined; examName: string; className: string; sectionName: string; subjectName: string };

export default function MarksVerificationPage() {
  const db = useSisStore();
  const classes = useManagedClasses();
  const students = useStudents();
  const { can } = usePermissions();
  const canVerify = can("marks.verify");
  const canApprove = can("marks.approve");

  const rows: Row[] = useMemo(() => {
    return db.examSubjects
      .filter((s) => s.date)
      .map((s) => {
        const session = db.marksEntrySessions.find((ms) => ms.examSubjectId === s.id);
        if (!session || (session.status !== "submitted" && session.status !== "locked")) return null;
        const exam = db.exams.find((e) => e.id === s.examId);
        const verification = db.marksVerifications.find((v) => v.examSubjectId === s.id);
        if (verification?.status === "approved" || verification?.status === "locked") return null;
        const schoolClass = classes.find((c) => c.id === s.classId);
        const section = schoolClass?.sections.find((sec) => sec.id === s.sectionId);
        return { examSubject: s, verification, examName: exam?.name ?? "", className: schoolClass?.name ?? "", sectionName: section?.name ?? "", subjectName: subjectById(s.subjectId)?.name ?? "" };
      })
      .filter((r): r is Row => r !== null);
  }, [db, classes]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [showCorrectionField, setShowCorrectionField] = useState(false);

  function summaryFor(row: Row) {
    const roster = students.filter((s) => s.sectionId === row.examSubject.sectionId);
    const marks = db.studentMarks.filter((m) => m.examSubjectId === row.examSubject.id);
    const attendance = db.examAttendance.filter((a) => a.examSubjectId === row.examSubject.id);
    return { roster, summary: computeMarksSummary(roster, marks, attendance, row.examSubject) };
  }

  const safeToBulkVerify = rows.filter((r) => {
    const { summary } = summaryFor(r);
    return summary.failedCount === 0 && summary.missingStudentIds.length === 0 && summary.unusualStudentIds.length === 0 && (!r.verification || r.verification.status === "submitted");
  });

  const columns: ColumnDef<Row>[] = [
    {
      id: "subject",
      header: "Subject",
      alwaysVisible: true,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">
            {r.className}-{r.sectionName} · {r.subjectName}
          </p>
          <p className="text-xs text-muted-foreground">{r.examName}</p>
        </div>
      ),
    },
    {
      id: "summary",
      header: "Summary",
      cell: (r) => {
        const { summary } = summaryFor(r);
        return (
          <span className="text-xs text-muted-foreground">
            Avg {summary.average} · {summary.failedCount} failed · {summary.missingStudentIds.length} missing
          </span>
        );
      },
    },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={r.verification?.status === "verified" ? "info" : "warning"}>{marksVerificationStatusLabels[r.verification?.status ?? "submitted"]}</Badge> },
  ];

  const detailData = detail ? summaryFor(detail) : null;
  const missingNames = detailData?.summary.missingStudentIds.map((id) => detailData.roster.find((s) => s.id === id)).filter(Boolean) ?? [];
  const failedNames = detailData?.summary.failedStudentIds.map((id) => detailData.roster.find((s) => s.id === id)).filter(Boolean) ?? [];
  const unusualNames = detailData?.summary.unusualStudentIds.map((id) => detailData.roster.find((s) => s.id === id)).filter(Boolean) ?? [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks verification</h1>
          <p className="text-xs text-muted-foreground">Review submitted marks before they feed into results</p>
        </div>
        {canVerify && safeToBulkVerify.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              bulkVerify(safeToBulkVerify[0].examSubject.examId, safeToBulkVerify.map((r) => r.examSubject.id), ACTOR_BY_STAGE.verify);
            }}
          >
            <Sparkles className="size-3.5" />
            Bulk-verify {safeToBulkVerify.length} clean subject{safeToBulkVerify.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.examSubject.id}
        caption="Marks awaiting verification"
        onRowClick={setDetail}
        selectable={canVerify}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActionBar={
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-secondary/60 px-sm py-2 text-sm">
            <span className="text-foreground">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={() => {
                bulkVerify(rows[0]?.examSubject.examId ?? "", [...selectedIds], ACTOR_BY_STAGE.verify);
                setSelectedIds(new Set());
              }}
            >
              Verify selected
            </Button>
          </div>
        }
        renderMobileCard={(r) => {
          const { summary } = summaryFor(r);
          return (
            <button
              type="button"
              onClick={() => setDetail(r)}
              className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">
                  {r.className}-{r.sectionName} · {r.subjectName}
                </p>
                <Badge tone={r.verification?.status === "verified" ? "info" : "warning"}>{marksVerificationStatusLabels[r.verification?.status ?? "submitted"]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Avg {summary.average} · {summary.failedCount} failed · {summary.missingStudentIds.length} missing
              </p>
            </button>
          );
        }}
        emptyTitle="Nothing awaiting verification"
        emptyDescription="Submitted marks will appear here once teachers finish entry."
      />

      <DetailDrawer
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null);
            setShowCorrectionField(false);
            setCorrectionReason("");
          }
        }}
        title={detail ? `${detail.className}-${detail.sectionName} · ${detail.subjectName}` : ""}
        description={detail?.examName ?? ""}
      >
        {detail && detailData && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-3 gap-sm text-center text-sm">
              <div className="rounded-md border border-border p-sm">
                <p className="text-lg font-bold text-foreground">{detailData.summary.highest}</p>
                <p className="text-xs text-muted-foreground">Highest</p>
              </div>
              <div className="rounded-md border border-border p-sm">
                <p className="text-lg font-bold text-foreground">{detailData.summary.average}</p>
                <p className="text-xs text-muted-foreground">Average</p>
              </div>
              <div className="rounded-md border border-border p-sm">
                <p className="text-lg font-bold text-foreground">{detailData.summary.lowest}</p>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </div>
            </div>

            <div className="flex items-center gap-sm text-xs">
              <Badge tone="success">{detailData.summary.passedCount} passed</Badge>
              <Badge tone={detailData.summary.failedCount > 0 ? "error" : "neutral"}>{detailData.summary.failedCount} failed</Badge>
              <Badge tone={detailData.summary.missingStudentIds.length > 0 ? "warning" : "neutral"}>{detailData.summary.missingStudentIds.length} missing</Badge>
            </div>

            {missingNames.length > 0 && (
              <div>
                <p className="mb-xs flex items-center gap-1 text-xs font-semibold text-warning">
                  <AlertTriangle className="size-3.5" /> Missing marks
                </p>
                <p className="text-sm text-foreground">{missingNames.map((s) => `${s!.profile.firstName} ${s!.profile.lastName}`).join(", ")}</p>
              </div>
            )}
            {failedNames.length > 0 && (
              <div>
                <p className="mb-xs text-xs font-semibold text-error">Failed students</p>
                <p className="text-sm text-foreground">{failedNames.map((s) => `${s!.profile.firstName} ${s!.profile.lastName}`).join(", ")}</p>
              </div>
            )}
            {unusualNames.length > 0 && (
              <div>
                <p className="mb-xs text-xs font-semibold text-info">Unusual values (worth a second look)</p>
                <p className="text-sm text-foreground">{unusualNames.map((s) => `${s!.profile.firstName} ${s!.profile.lastName}`).join(", ")}</p>
              </div>
            )}

            {detail.verification && detail.verification.history.length > 0 && (
              <div>
                <p className="mb-xs text-xs font-semibold text-foreground">History</p>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {detail.verification.history.map((h) => (
                    <li key={h.id}>
                      {marksVerificationStageLabels[h.stage]} · {h.action} by {h.actorName} · {formatDateTime(h.createdAt)}
                      {h.comment && ` — "${h.comment}"`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-sm border-t border-border pt-sm">
              {canVerify && (!detail.verification || detail.verification.status === "submitted" || detail.verification.status === "changes-requested") && (
                <Button
                  size="sm"
                  onClick={() => {
                    verifyMarks(detail.examSubject.examId, detail.examSubject.id, ACTOR_BY_STAGE.verify);
                    setDetail(null);
                  }}
                >
                  <CheckCircle2 className="size-3.5" />
                  Verify
                </Button>
              )}
              {canApprove && detail.verification?.status === "verified" && (
                <Button
                  size="sm"
                  onClick={() => {
                    approveMarks(detail.examSubject.examId, detail.examSubject.id, ACTOR_BY_STAGE.approve);
                    setDetail(null);
                  }}
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </Button>
              )}
              {canVerify && (
                <Button size="sm" variant="outline" onClick={() => setShowCorrectionField((v) => !v)}>
                  Request correction
                </Button>
              )}
              {canApprove && detail.verification?.status === "verified" && (
                <Button size="sm" variant="outline" onClick={() => lockVerification(detail.examSubject.examId, detail.examSubject.id, ACTOR_BY_STAGE.approve)}>
                  Lock
                </Button>
              )}
              {canVerify && detail.verification && detail.verification.status !== "submitted" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    reopenVerification(detail.examSubject.examId, detail.examSubject.id, ACTOR_BY_STAGE.verify, "Reopened for review");
                    setDetail(null);
                  }}
                >
                  Reopen
                </Button>
              )}
            </div>

            {showCorrectionField && (
              <div className="flex flex-col gap-xs">
                <Label htmlFor="correction-reason">What needs to change?</Label>
                <Textarea id="correction-reason" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} rows={2} />
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  disabled={!correctionReason.trim()}
                  onClick={() => {
                    requestCorrection(detail.examSubject.examId, detail.examSubject.id, ACTOR_BY_STAGE.verify, correctionReason.trim());
                    setShowCorrectionField(false);
                    setCorrectionReason("");
                    setDetail(null);
                  }}
                >
                  Send back to teacher
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
