"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, ChevronRight, RefreshCcw, RotateCcw, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useExamResults, useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { subjectById } from "@/lib/data/seed/academics";
import { computeExamReadiness } from "@/lib/selectors/exam-insights";
import { checkResultCalculationConfig, calculateResults } from "@/lib/services/result-processing-service";
import { applySupplementaryResults, createSupplementaryExam, getEligibleStudentsForReExam } from "@/lib/services/supplementary-service";
import { supplementaryReasonLabels, type SupplementaryReason } from "@/lib/types/exams";
import { overallResultStatusLabels, type StudentResult } from "@/lib/types/results";
import { cn } from "@/lib/utils";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

const statusTone: Record<string, "success" | "error" | "warning" | "neutral" | "info"> = {
  pass: "success",
  fail: "error",
  withheld: "error",
  absent: "neutral",
  "re-exam-required": "warning",
  pending: "neutral",
};

export default function ExamResultsPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const db = useSisStore();
  const exam = useExam(params.examId);
  const results = useExamResults(params.examId);
  const classes = useManagedClasses();
  const allExams = useExams();
  const { can } = usePermissions();
  const canCalculate = can("results.calculate");

  const [detail, setDetail] = useState<StudentResult | null>(null);
  const [confirmCalc, setConfirmCalc] = useState(false);
  const [calcErrors, setCalcErrors] = useState<string[]>([]);
  const [suppOpen, setSuppOpen] = useState(false);
  const [suppSelected, setSuppSelected] = useState<Set<string>>(new Set());
  const [suppReason, setSuppReason] = useState<SupplementaryReason>("re-test");
  const [suppStart, setSuppStart] = useState("");
  const [suppEnd, setSuppEnd] = useState("");
  const [confirmApplySupp, setConfirmApplySupp] = useState(false);

  const readiness = useMemo(() => (exam ? computeExamReadiness(db, exam.id) : null), [db, exam]);
  const configErrors = useMemo(() => (exam ? checkResultCalculationConfig(db, exam.id) : []), [db, exam]);

  if (!exam || !readiness) return null;

  const students = db.students;
  const studentName = (id: string) => {
    const s = students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  };
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id;

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const withheld = results.filter((r) => r.status === "withheld").length;
  const absent = results.filter((r) => r.status === "absent").length;
  const reExam = results.filter((r) => r.status === "re-exam-required").length;

  const eligibleForReExam = getEligibleStudentsForReExam(exam.id);
  const linkedSupplementaryExams = allExams.filter((e) => e.parentExamId === exam.id);
  const isSupplementary = Boolean(exam.parentExamId);
  const parentExam = isSupplementary ? allExams.find((e) => e.id === exam.parentExamId) : undefined;

  const stages = [
    { label: "Marks complete", done: readiness.marksEntryComplete === "complete" },
    { label: "Verification complete", done: readiness.verificationComplete === "complete" },
    { label: "Calculation", done: readiness.resultsCalculated },
    { label: "Review", done: readiness.resultsCalculated && configErrors.length === 0 },
    { label: "Report cards", done: readiness.reportCardsGenerated === "complete" },
    { label: "Publication", done: readiness.published },
  ];

  const columns: ColumnDef<StudentResult>[] = [
    { id: "student", header: "Student", alwaysVisible: true, sortValue: (r) => studentName(r.studentId), cell: (r) => <span className="text-sm font-medium text-foreground">{studentName(r.studentId)}</span> },
    { id: "class", header: "Class", cell: (r) => <span className="text-sm text-foreground">{className(r.classId)}</span> },
    { id: "total", header: "Total", cell: (r) => <span className="text-sm text-foreground">{r.totalObtained}/{r.totalMax}</span> },
    { id: "percent", header: "Percent", sortValue: (r) => r.percent, cell: (r) => <span className="text-sm text-foreground">{r.percent}%</span> },
    { id: "grade", header: "Grade", cell: (r) => <Badge tone="info">{r.grade}</Badge> },
    { id: "rank", header: "Rank", cell: (r) => <span className="text-sm text-foreground">{r.rank ?? "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{overallResultStatusLabels[r.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Results — {exam.name}</h1>
          <p className="text-xs text-muted-foreground">Calculate, review and prepare results for publication</p>
        </div>
        {canCalculate && (
          <Button
            size="sm"
            onClick={() => {
              const errors = checkResultCalculationConfig(db, exam.id);
              if (errors.length > 0) {
                setCalcErrors(errors.map((e) => e.message));
                return;
              }
              setCalcErrors([]);
              setConfirmCalc(true);
            }}
          >
            {results.length > 0 ? <RotateCcw className="size-3.5" /> : <Calculator className="size-3.5" />}
            {results.length > 0 ? "Recalculate results" : "Calculate results"}
          </Button>
        )}
      </div>

      {/* Pipeline */}
      <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-sm">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex shrink-0 items-center gap-1">
            <div className={cn("flex items-center gap-1.5 rounded-pill px-sm py-1.5 text-xs font-medium", stage.done ? "bg-success/12 text-success" : "bg-surface-secondary text-muted-foreground")}>
              {stage.done ? <CheckCircle2 className="size-3.5" /> : <span className="flex size-3.5 items-center justify-center rounded-pill border border-current text-[9px]">{i + 1}</span>}
              {stage.label}
            </div>
            {i < stages.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          </div>
        ))}
      </div>

      {calcErrors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
          <p className="flex items-center gap-1 font-medium">
            <AlertTriangle className="size-4" /> Can&apos;t calculate results yet
          </p>
          {calcErrors.map((e, i) => (
            <p key={i} className="text-xs">
              {e}
            </p>
          ))}
        </div>
      )}

      {isSupplementary && parentExam && (
        <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-info/30 bg-info/8 p-sm text-sm">
          <span className="text-foreground">
            Supplementary exam linked to <Link href={`/exams/${parentExam.id}`} className="font-medium underline underline-offset-2">{parentExam.name}</Link>
          </span>
          {can("results.calculate") && results.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setConfirmApplySupp(true)}>
              <RefreshCcw className="size-3.5" />
              Apply to original exam
            </Button>
          )}
        </div>
      )}

      {!isSupplementary && eligibleForReExam.length > 0 && can("exams.create") && (
        <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm">
          <span className="flex items-center gap-1.5 text-foreground">
            <Users className="size-4 text-warning" />
            {eligibleForReExam.length} student{eligibleForReExam.length === 1 ? "" : "s"} eligible for a re-take
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSuppSelected(new Set(eligibleForReExam.map((e) => e.studentId)));
              setSuppStart("");
              setSuppEnd("");
              setSuppOpen(true);
            }}
          >
            Create supplementary exam
          </Button>
        </div>
      )}

      {linkedSupplementaryExams.length > 0 && (
        <div className="flex flex-wrap items-center gap-xs text-xs text-muted-foreground">
          Supplementary exams:
          {linkedSupplementaryExams.map((e) => (
            <Link key={e.id} href={`/exams/${e.id}`} className="rounded-pill border border-border px-sm py-1 text-foreground hover:border-primary">
              {e.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total" value={String(results.length)} tone="neutral" />
        <StatTile label="Passed" value={String(passed)} tone="success" />
        <StatTile label="Failed" value={String(failed)} tone="error" />
        <StatTile label="Withheld" value={String(withheld)} tone="error" />
        <StatTile label="Absent" value={String(absent)} tone="neutral" />
        <StatTile label="Re-exam required" value={String(reExam)} tone="warning" />
      </div>

      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No results calculated yet.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={results}
          getRowId={(r) => r.id}
          caption="Student results"
          onRowClick={setDetail}
          renderMobileCard={(r) => (
            <button
              type="button"
              onClick={() => setDetail(r)}
              className="surface-3d flex w-full items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{studentName(r.studentId)}</p>
                <p className="text-xs text-muted-foreground">{className(r.classId)} · {r.percent}% · {r.grade}</p>
              </div>
              <Badge tone={statusTone[r.status]}>{overallResultStatusLabels[r.status]}</Badge>
            </button>
          )}
          emptyTitle="No results yet"
        />
      )}

      <DetailDrawer open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title={detail ? studentName(detail.studentId) : ""} description={detail ? `${className(detail.classId)} · Rank ${detail.rank ?? "—"}` : ""}>
        {detail && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-3 gap-sm text-center text-sm">
              <div className="rounded-md border border-border p-sm">
                <p className="text-lg font-bold text-foreground">{detail.percent}%</p>
                <p className="text-xs text-muted-foreground">Overall</p>
              </div>
              <div className="rounded-md border border-border p-sm">
                <p className="text-lg font-bold text-foreground">{detail.grade}</p>
                <p className="text-xs text-muted-foreground">Grade</p>
              </div>
              <div className="rounded-md border border-border p-sm">
                <p className="text-lg font-bold text-foreground">{detail.rank ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Rank</p>
              </div>
            </div>

            <div>
              <p className="mb-xs text-xs font-semibold text-foreground">Subject-wise results</p>
              <ul className="flex flex-col gap-1">
                {detail.subjectResults.map((sr) => (
                  <li key={sr.examSubjectId} className="flex items-center justify-between rounded-md border border-border px-sm py-1.5 text-sm">
                    <span className="text-foreground">{subjectById(sr.subjectId)?.name}</span>
                    <span className="flex items-center gap-sm text-xs text-muted-foreground">
                      {sr.total}/{sr.maxMarks} · {sr.percent}%
                      <Badge tone={sr.status === "pass" ? "success" : sr.status === "fail" ? "error" : "neutral"}>{sr.grade}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {detail.explanation.length > 0 && (
              <div>
                <p className="mb-xs text-xs font-semibold text-foreground">Calculation trace</p>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {detail.explanation.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Calculation version {detail.calculationVersion} · Attendance {detail.attendancePercent}%</p>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={confirmCalc}
        onOpenChange={setConfirmCalc}
        title={results.length > 0 ? "Recalculate results?" : "Calculate results?"}
        description={results.length > 0 ? "This replaces the current results with a fresh calculation. The previous version is preserved in result history." : "This runs the result engine against all entered marks and attendance for this exam."}
        confirmLabel={results.length > 0 ? "Recalculate" : "Calculate"}
        onConfirm={() => {
          const result = calculateResults(exam.id, ACTOR);
          if (!result.ok) setCalcErrors(result.errors.map((e) => e.message));
          setConfirmCalc(false);
        }}
      />

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/exams/${exam.id}/publish`)} disabled={results.length === 0}>
          Continue to publication
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      <DetailDrawer open={suppOpen} onOpenChange={setSuppOpen} title="Create supplementary exam" description="Only the failed subjects will be included — schedule, marks entry and verification work the same as any exam">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Reason</Label>
            <Select value={suppReason} onValueChange={(v) => setSuppReason(v as SupplementaryReason)}>
              <SelectTrigger aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(supplementaryReasonLabels) as SupplementaryReason[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {supplementaryReasonLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="supp-start">Start date</Label>
              <Input id="supp-start" type="date" value={suppStart} onChange={(e) => setSuppStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="supp-end">End date</Label>
              <Input id="supp-end" type="date" value={suppEnd} onChange={(e) => setSuppEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Eligible students ({suppSelected.size} selected)</Label>
            <ul className="max-h-64 overflow-y-auto rounded-md border border-border">
              {eligibleForReExam.map((e) => (
                <li key={e.studentId} className="flex items-center justify-between gap-sm border-b border-border px-sm py-1.5 last:border-0">
                  <label className="flex flex-1 items-center gap-sm text-sm text-foreground">
                    <Checkbox
                      checked={suppSelected.has(e.studentId)}
                      onCheckedChange={(checked) =>
                        setSuppSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(e.studentId);
                          else next.delete(e.studentId);
                          return next;
                        })
                      }
                    />
                    {studentName(e.studentId)}
                  </label>
                  <span className="text-xs text-muted-foreground">{e.failedSubjectIds.map((id) => subjectById(id)?.name).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            disabled={suppSelected.size === 0 || !suppStart || !suppEnd}
            onClick={() => {
              const selected = eligibleForReExam.filter((e) => suppSelected.has(e.studentId));
              const created = createSupplementaryExam(exam.id, suppReason, selected, { startDate: suppStart, endDate: suppEnd }, ACTOR);
              setSuppOpen(false);
              if (created) router.push(`/exams/${created.id}`);
            }}
          >
            Create exam with {suppSelected.size} student{suppSelected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </DetailDrawer>

      <ConfirmDialog
        open={confirmApplySupp}
        onOpenChange={setConfirmApplySupp}
        title="Apply results to the original exam?"
        description="This replaces only the retaken subjects in each student's original result and recalculates their overall status. The pre-retake result is preserved in result history."
        confirmLabel="Apply"
        onConfirm={() => {
          if (parentExam) applySupplementaryResults(exam.id, ACTOR);
          setConfirmApplySupp(false);
        }}
      />
    </div>
  );
}
