"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileBadge,
  FileText,
  History,
  Pencil,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useExamAuditLog, useExamClasses, useExamSubjects, useGradingSchemes, useReportCardTemplates, useResultRules } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeExamReadiness, type ExamStageStatus } from "@/lib/selectors/exam-insights";
import { deleteExam, updateExam } from "@/lib/services/exam-service";
import { examAuditActionLabels, examStatusLabels, examStatusTone, examTypeLabels } from "@/lib/types/exams";
import { formatDate, formatDateTime } from "@/lib/utils";

const stageToneOf: Record<ExamStageStatus, "success" | "warning" | "neutral"> = { complete: "success", "in-progress": "warning", "not-started": "neutral" };
const stageLabelOf: Record<ExamStageStatus, string> = { complete: "Complete", "in-progress": "In progress", "not-started": "Not started" };

export default function ExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const db = useSisStore();
  const exam = useExam(params.examId);
  const examClasses = useExamClasses(params.examId);
  const examSubjects = useExamSubjects(params.examId);
  const classes = useManagedClasses();
  const gradingSchemes = useGradingSchemes();
  const resultRules = useResultRules();
  const reportCardTemplates = useReportCardTemplates();
  const auditLog = useExamAuditLog(params.examId);
  const { can } = usePermissions();
  const canManage = can("exams.manageSchedule");

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", code: "", term: "", description: "", startDate: "", endDate: "", resultDate: "" });
  const [auditVisible, setAuditVisible] = useState(10);

  if (!exam) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Exam not found.</p>;
  }

  const readiness = computeExamReadiness(db, exam.id);
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id;
  const studentCount = examClasses.reduce((sum, ec) => {
    const section = classes.find((c) => c.id === ec.classId)?.sections.find((s) => s.id === ec.sectionId);
    return sum + Math.max(0, (section?.enrolledCount ?? 0) - ec.excludedStudentIds.length);
  }, 0);

  function openEdit() {
    if (!exam) return;
    setEdit({ name: exam.name, code: exam.code, term: exam.term, description: exam.description ?? "", startDate: exam.startDate, endDate: exam.endDate, resultDate: exam.resultDate ?? "" });
    setEditOpen(true);
  }

  const stageCards = [
    { key: "subjects", label: "Subjects", href: `/exams/${exam.id}/subjects`, icon: FileText, status: readiness.subjectsConfigured, detail: `${readiness.subjectCount} configured` },
    { key: "schedule", label: "Schedule", href: `/exams/${exam.id}/schedule`, icon: CalendarClock, status: readiness.scheduleComplete, detail: `${readiness.scheduledSubjectCount}/${readiness.subjectCount} scheduled` },
    { key: "students", label: "Students", href: `/exams/${exam.id}/students`, icon: Users, status: examClasses.length > 0 ? "complete" : "not-started", detail: `${studentCount} eligible` },
    { key: "attendance", label: "Attendance", href: `/exams/${exam.id}/attendance`, icon: ClipboardCheck, status: readiness.attendanceComplete, detail: `${readiness.attendanceCompletionPercent}% marked` },
    { key: "marks", label: "Marks entry", href: `/exams/${exam.id}/marks`, icon: FileBadge, status: readiness.marksEntryComplete, detail: `${readiness.marksEntryPercent}% entered` },
    { key: "results", label: "Results", href: `/exams/${exam.id}/results`, icon: CheckCircle2, status: readiness.resultsCalculated ? "complete" : "not-started", detail: readiness.resultsCalculated ? "Calculated" : "Not calculated" },
    { key: "publish", label: "Publish", href: `/exams/${exam.id}/publish`, icon: UploadCloud, status: readiness.published ? "complete" : "not-started", detail: readiness.published ? "Published" : "Not published" },
  ] as const;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-xs">
            <h1 className="text-lg font-semibold text-foreground">{exam.name}</h1>
            <Badge tone={examStatusTone[exam.status]}>{examStatusLabels[exam.status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {exam.code} · {examTypeLabels[exam.type]} · {exam.term} · {formatDate(exam.startDate)} – {formatDate(exam.endDate)}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-xs">
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            {exam.status === "draft" && (
              <Button size="sm" variant="outline" className="text-error" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {exam.description && <p className="rounded-lg border border-border bg-surface-secondary/40 p-sm text-sm text-muted-foreground">{exam.description}</p>}

      {deleteError && (
        <div className="flex items-center gap-sm rounded-lg border border-error/30 bg-error/8 px-sm py-sm text-sm text-error">
          <AlertTriangle className="size-4 shrink-0" />
          {deleteError}
        </div>
      )}

      {examSubjects.length === 0 && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          No subjects configured yet — start with Subjects below to build the schedule.
        </div>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-4">
        {stageCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <card.icon className="size-4" aria-hidden="true" />
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.detail}</p>
            </div>
            <Badge tone={stageToneOf[card.status]}>{stageLabelOf[card.status]}</Badge>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Configuration</h2>
        <div className="grid grid-cols-1 gap-sm text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Classes</p>
            <p className="text-foreground">{exam.classIds.map(className).join(", ") || "None selected"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grading scheme</p>
            <p className="text-foreground">{gradingSchemes.find((s) => s.id === exam.gradingSchemeId)?.name ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Result rule</p>
            <p className="text-foreground">{resultRules.find((r) => r.id === exam.resultRuleId)?.name ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Report card template</p>
            <p className="text-foreground">{reportCardTemplates.find((t) => t.id === exam.reportCardTemplateId)?.name ?? "Not set"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          <Badge tone="neutral">{auditLog.length} event{auditLog.length === 1 ? "" : "s"}</Badge>
        </div>
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {auditLog.slice(0, auditVisible).map((entry) => (
              <li key={entry.id} className="flex items-start gap-sm border-b border-border pb-sm last:border-0 last:pb-0">
                <History className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{examAuditActionLabels[entry.action]}</span> — {entry.summary}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorName} ({entry.actorRole}) · {formatDateTime(entry.createdAt)}
                    {entry.reason ? ` · Reason: ${entry.reason}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {auditLog.length > auditVisible && (
          <Button variant="ghost" size="sm" className="mt-sm" onClick={() => setAuditVisible((v) => v + 10)}>
            Show more
          </Button>
        )}
      </div>

      <DetailDrawer open={editOpen} onOpenChange={setEditOpen} title="Edit exam details" description={exam.code}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!edit.name.trim() || !edit.code.trim()) return;
            updateExam(exam.id, { name: edit.name.trim(), code: edit.code.trim(), term: edit.term.trim(), description: edit.description || undefined, startDate: edit.startDate, endDate: edit.endDate, resultDate: edit.resultDate || undefined });
            setEditOpen(false);
          }}
          className="flex flex-col gap-sm"
        >
          <div>
            <Label htmlFor="edit-name">Exam name</Label>
            <Input id="edit-name" value={edit.name} onChange={(e) => setEdit((prev) => ({ ...prev, name: e.target.value }))} />
            <FieldError>{!edit.name.trim() ? "Required" : undefined}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" value={edit.code} onChange={(e) => setEdit((prev) => ({ ...prev, code: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-term">Term</Label>
              <Input id="edit-term" value={edit.term} onChange={(e) => setEdit((prev) => ({ ...prev, term: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" rows={2} value={edit.description} onChange={(e) => setEdit((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-sm">
            <div>
              <Label htmlFor="edit-start">Start</Label>
              <Input id="edit-start" type="date" value={edit.startDate} onChange={(e) => setEdit((prev) => ({ ...prev, startDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-end">End</Label>
              <Input id="edit-end" type="date" value={edit.endDate} onChange={(e) => setEdit((prev) => ({ ...prev, endDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-result">Result date</Label>
              <Input id="edit-result" type="date" value={edit.resultDate} onChange={(e) => setEdit((prev) => ({ ...prev, resultDate: e.target.value }))} />
            </div>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </DetailDrawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this exam?"
        description="This permanently removes the draft exam. This can't be undone."
        confirmLabel="Delete exam"
        destructive
        onConfirm={() => {
          const result = deleteExam(exam.id);
          if (!result.ok) {
            setDeleteError(result.error);
            return;
          }
          setDeleteError(null);
          router.push("/exams");
        }}
      />
    </div>
  );
}
