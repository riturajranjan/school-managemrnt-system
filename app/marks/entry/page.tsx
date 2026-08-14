"use client";

// Marks entry (Phase 8B) — real PostgreSQL/API cutover. Same keyboard-first grid
// shell as before; the paper selector now lists real, scheduled ExamScheduleEntry
// rows (Phase 8A) instead of mock exam subjects, and marks are validated + saved
// against the entry's SNAPSHOTTED maxMarks/theoryMarks/practicalMarks — never a
// live Subject default. Internal/project marks and a computed grade are removed
// (no real snapshot exists for the former; grading is Phase 8C+) rather than
// fabricated. Absence is an explicit status, never zero — Status must be set to
// "Present" before a numeric mark can be entered.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ShieldCheck, UploadCloud } from "lucide-react";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExamSchedule, useExamMarksRoster, useExams, saveMarksRequest, submitMarksRequest, verifyMarksRequest } from "@/lib/hooks/api/use-exams-api";
import type { ExamMarkStatus, ExamMarksRosterStudentDto, ExamMarksSaveRecord } from "@/lib/api/contracts";
import { downloadTextFile } from "@/lib/utils";

const statusOptions: { value: ExamMarkStatus; label: string }[] = [
  { value: "pending", label: "Not entered" },
  { value: "marked", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "exempt", label: "Exempt" },
];
const statusTone: Record<ExamMarkStatus, "neutral" | "success" | "error" | "info"> = { pending: "neutral", marked: "success", absent: "error", exempt: "info" };

function MarksEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exams = useExams();
  const scheduledExams = useMemo(() => exams.data.filter((e) => e.status !== "draft" && e.status !== "archived"), [exams.data]);

  const [examId, setExamId] = useState(searchParams.get("examId") ?? "");
  const schedule = useExamSchedule(examId || undefined);
  const [entryId, setEntryId] = useState(searchParams.get("entryId") ?? "");
  const activeEntryId = entryId || schedule.data?.[0]?.id || "";

  const roster = useExamMarksRoster(examId || undefined, activeEntryId || undefined);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errorsByCell, setErrorsByCell] = useState<Record<string, string>>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  if (!examId || scheduledExams.length === 0) {
    return (
      <div className="flex flex-col gap-md">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks entry</h1>
          <p className="text-xs text-muted-foreground">Select an exam to begin</p>
        </div>
        <Select value={examId} onValueChange={(v) => { setExamId(v); setEntryId(""); router.replace(`/marks/entry?examId=${v}`); }}>
          <SelectTrigger className="w-72" aria-label="Select exam"><SelectValue placeholder="Select exam" /></SelectTrigger>
          <SelectContent>{scheduledExams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>
        {scheduledExams.length === 0 && <p className="text-sm text-muted-foreground">No exams are scheduled yet.</p>}
      </div>
    );
  }

  if (!activeEntryId || !roster.data) {
    return (
      <div className="flex flex-col gap-md">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks entry</h1>
          <p className="text-xs text-muted-foreground">{schedule.loading || roster.loading ? "Loading…" : "This exam has no scheduled papers yet."}</p>
        </div>
      </div>
    );
  }

  const data = roster.data;
  // Must match the server's rule exactly (lib/server/exams/marks-service.ts): a
  // paper is "split" whenever its practicalMarks snapshot is > 0.
  const hasSplit = data.entry.practicalMarks > 0;
  const isLocked = data.sheet.status === "verified";
  const isEditable = data.canEnter;

  function studentById(id: string) {
    return data!.students.find((s) => s.studentId === id);
  }
  function cellKey(studentId: string, field: string) {
    return `${studentId}:${field}`;
  }
  function draftOrValue(studentId: string, field: "theoryMarks" | "practicalMarks" | "marksObtained"): string {
    const key = cellKey(studentId, field);
    if (key in drafts) return drafts[key];
    const v = studentById(studentId)?.[field];
    return v === null || v === undefined ? "" : String(v);
  }

  async function persist(studentId: string, overrides: Partial<Pick<ExamMarksSaveRecord, "status" | "theoryMarks" | "practicalMarks" | "marksObtained" | "remarks">>) {
    const s = studentById(studentId);
    if (!s) return;
    const record: ExamMarksSaveRecord = {
      studentId,
      status: overrides.status ?? s.status,
      theoryMarks: overrides.theoryMarks !== undefined ? overrides.theoryMarks : hasSplit ? s.theoryMarks : undefined,
      practicalMarks: overrides.practicalMarks !== undefined ? overrides.practicalMarks : hasSplit ? s.practicalMarks : undefined,
      marksObtained: overrides.marksObtained !== undefined ? overrides.marksObtained : !hasSplit ? s.marksObtained : undefined,
      remarks: overrides.remarks !== undefined ? overrides.remarks : s.remarks,
    };
    // Absent/exempt/pending carry no numeric fields.
    if (record.status !== "marked") { record.theoryMarks = null; record.practicalMarks = null; record.marksObtained = null; }
    const res = await saveMarksRequest(examId, activeEntryId, [record]);
    if (!res.success) { setBanner(res.error.message); return; }
    roster.reload();
  }

  function commitNumericCell(studentId: string, field: "theoryMarks" | "practicalMarks" | "marksObtained") {
    const key = cellKey(studentId, field);
    const raw = drafts[key];
    if (raw === undefined) return;
    setDrafts((prev) => { const next = { ...prev }; delete next[key]; return next; });
    if (raw.trim() === "") return;
    const value = Number(raw);
    const max = field === "theoryMarks" ? data!.entry.theoryMarks : field === "practicalMarks" ? data!.entry.practicalMarks : data!.entry.maxMarks;
    if (Number.isNaN(value) || !Number.isInteger(value) || value < 0 || value > max) {
      setErrorsByCell((prev) => ({ ...prev, [key]: `0–${max}` }));
      return;
    }
    setErrorsByCell((prev) => ({ ...prev, [key]: "" }));
    void persist(studentId, { status: "marked", [field]: value });
  }

  function changeStatus(studentId: string, status: ExamMarkStatus) {
    void persist(studentId, { status });
  }

  const editableRows = data.students.filter((s) => s.currentlyEnrolled);
  const historicalRows = data.students.filter((s) => !s.currentlyEnrolled);

  function renderMarksCells(s: ExamMarksRosterStudentDto, readOnly: boolean) {
    const rowDisabled = readOnly || !isEditable || s.status === "absent" || s.status === "exempt";
    if (hasSplit) {
      return (
        <>
          <MarksCell studentId={s.studentId} field="theoryMarks" max={data!.entry.theoryMarks} disabled={rowDisabled} value={draftOrValue(s.studentId, "theoryMarks")}
            error={errorsByCell[cellKey(s.studentId, "theoryMarks")]} onChange={(v) => setDrafts((p) => ({ ...p, [cellKey(s.studentId, "theoryMarks")]: v }))}
            onCommit={() => commitNumericCell(s.studentId, "theoryMarks")} />
          <MarksCell studentId={s.studentId} field="practicalMarks" max={data!.entry.practicalMarks} disabled={rowDisabled} value={draftOrValue(s.studentId, "practicalMarks")}
            error={errorsByCell[cellKey(s.studentId, "practicalMarks")]} onChange={(v) => setDrafts((p) => ({ ...p, [cellKey(s.studentId, "practicalMarks")]: v }))}
            onCommit={() => commitNumericCell(s.studentId, "practicalMarks")} />
        </>
      );
    }
    return (
      <MarksCell studentId={s.studentId} field="marksObtained" max={data!.entry.maxMarks} disabled={rowDisabled} value={draftOrValue(s.studentId, "marksObtained")}
        error={errorsByCell[cellKey(s.studentId, "marksObtained")]} onChange={(v) => setDrafts((p) => ({ ...p, [cellKey(s.studentId, "marksObtained")]: v }))}
        onCommit={() => commitNumericCell(s.studentId, "marksObtained")} />
    );
  }

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks entry</h1>
          <p className="text-xs text-muted-foreground">Marks are validated and saved against this paper&apos;s configured limits — values save on blur</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const rows = data.students.map((s) => ({
              Roll: s.rollNumber ?? "", Student: s.name, Status: s.status,
              ...(hasSplit ? { Theory: s.theoryMarks ?? "", Practical: s.practicalMarks ?? "" } : { Marks: s.marksObtained ?? "" }),
              Remarks: s.remarks ?? "",
            }));
            downloadTextFile(`marks-${activeEntryId}.csv`, Papa.unparse(rows));
          }}
        >
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Select value={examId} onValueChange={(v) => { setExamId(v); setEntryId(""); router.replace(`/marks/entry?examId=${v}`); }}>
          <SelectTrigger className="w-48" aria-label="Exam"><SelectValue /></SelectTrigger>
          <SelectContent>{scheduledExams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={activeEntryId} onValueChange={(v) => { setEntryId(v); router.replace(`/marks/entry?examId=${examId}&entryId=${v}`); }}>
          <SelectTrigger className="w-64" aria-label="Class, section and subject"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(schedule.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.section.className}-{s.section.name} · {s.subject.name} · {s.examDate}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {banner && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{banner}</p>}

      <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
        <div>
          <p className="text-sm font-semibold text-foreground">{data.entry.section.className}-{data.entry.section.name} · {data.entry.subject.name}</p>
          <p className="text-xs text-muted-foreground">
            {data.summary.enteredCount}/{data.summary.totalStudents} entered · {data.entry.examDate} ·{" "}
            {hasSplit ? `Theory /${data.entry.theoryMarks} + Practical /${data.entry.practicalMarks}` : `Max /${data.entry.maxMarks}`} · Pass {data.entry.passingMarks}
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <Badge tone={isLocked ? "success" : data.sheet.status === "submitted" ? "info" : "warning"}>{data.sheet.status}</Badge>
          {data.canEnter && (
            <Button size="sm" variant="outline" onClick={() => setConfirmSubmit(true)} disabled={data.summary.enteredCount === 0}>
              <UploadCloud className="size-3.5" />
              Submit
            </Button>
          )}
          {data.canVerify && (
            <Button size="sm" variant="outline" onClick={() => setConfirmVerify(true)}>
              <ShieldCheck className="size-3.5" />
              Verify
            </Button>
          )}
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/60 text-left">
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Roll</th>
              <th className="min-w-40 px-sm py-2 text-xs font-semibold text-muted-foreground">Student</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Status</th>
              {hasSplit ? (
                <>
                  <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Theory <span className="font-normal">/{data.entry.theoryMarks}</span></th>
                  <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Practical <span className="font-normal">/{data.entry.practicalMarks}</span></th>
                </>
              ) : (
                <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Marks <span className="font-normal">/{data.entry.maxMarks}</span></th>
              )}
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {editableRows.map((s) => (
              <tr key={s.studentId} className="border-b border-border last:border-0">
                <td className="px-sm py-1.5 text-xs text-muted-foreground">{s.rollNumber ?? "—"}</td>
                <td className="min-w-40 px-sm py-1.5 text-sm text-foreground">{s.name}</td>
                <td className="px-sm py-1.5">
                  <Select value={s.status} onValueChange={(v) => changeStatus(s.studentId, v as ExamMarkStatus)} disabled={!isEditable}>
                    <SelectTrigger className="h-8 w-32 text-xs" aria-label={`Status for ${s.name}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                {renderMarksCells(s, false)}
                <td className="px-sm py-1.5">
                  <Input defaultValue={s.remarks ?? ""} onBlur={(e) => void persist(s.studentId, { remarks: e.target.value.trim() || null })} disabled={!isEditable} className="h-9 w-32 text-xs" aria-label={`Remark for ${s.name}`} />
                </td>
              </tr>
            ))}
            {historicalRows.map((s) => (
              <tr key={s.studentId} className="border-b border-border bg-surface-secondary/30 last:border-0">
                <td className="px-sm py-1.5 text-xs text-muted-foreground">{s.rollNumber ?? "—"}</td>
                <td className="min-w-40 px-sm py-1.5 text-sm text-foreground">
                  {s.name} <span className="text-xs text-muted-foreground">(no longer enrolled — historical)</span>
                </td>
                <td className="px-sm py-1.5"><Badge tone={statusTone[s.status]}>{statusOptions.find((o) => o.value === s.status)?.label}</Badge></td>
                {hasSplit ? (
                  <>
                    <td className="px-sm py-1.5 text-sm text-foreground">{s.theoryMarks ?? "—"}</td>
                    <td className="px-sm py-1.5 text-sm text-foreground">{s.practicalMarks ?? "—"}</td>
                  </>
                ) : (
                  <td className="px-sm py-1.5 text-sm text-foreground">{s.marksObtained ?? "—"}</td>
                )}
                <td className="px-sm py-1.5 text-xs text-muted-foreground">{s.remarks ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one student at a time */}
      <div className="flex flex-col gap-sm md:hidden">
        {editableRows.map((s) => (
          <div key={s.studentId} className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">Roll {s.rollNumber ?? "—"}</p>
              </div>
              <Select value={s.status} onValueChange={(v) => changeStatus(s.studentId, v as ExamMarkStatus)} disabled={!isEditable}>
                <SelectTrigger className="h-8 w-28 text-xs" aria-label={`Status for ${s.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {s.status === "absent" || s.status === "exempt" ? (
              <p className="rounded-md border border-dashed border-border p-sm text-center text-sm text-muted-foreground">Marked {s.status} — no marks to enter.</p>
            ) : (
              <div className="flex flex-col gap-sm">{renderMarksCells(s, false)}</div>
            )}
          </div>
        ))}
      </div>

      {data.summary.totalStudents === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No students enrolled in this section.</p>}

      {!isEditable && !isLocked && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {data.sheet.status === "submitted" ? "Marks have been submitted and are read-only." : "You have read-only access to marks entry."}
        </div>
      )}
      {isLocked && (
        <div className="flex items-center gap-sm rounded-lg border border-success/30 bg-success/8 px-sm py-sm text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Marks are verified and locked.
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title="Submit marks?"
        description="Submits this paper's marks for verification. You won't be able to edit them until an admin reviews or reopens them."
        confirmLabel="Submit"
        onConfirm={async () => {
          const res = await submitMarksRequest(examId, activeEntryId);
          if (!res.success) setBanner(res.error.message);
          setConfirmSubmit(false);
          roster.reload();
        }}
      />
      <ConfirmDialog
        open={confirmVerify}
        onOpenChange={setConfirmVerify}
        title="Verify marks?"
        description="Locks this paper's marks. This cannot be undone from here."
        confirmLabel="Verify"
        onConfirm={async () => {
          const res = await verifyMarksRequest(examId, activeEntryId);
          if (!res.success) setBanner(res.error.message);
          setConfirmVerify(false);
          roster.reload();
        }}
      />
    </div>
  );
}

function MarksCell({ field, max, disabled, value, error, onChange, onCommit }: {
  studentId: string; field: string; max: number; disabled: boolean; value: string; error?: string; onChange: (v: string) => void; onCommit: () => void;
}) {
  return (
    <td className="px-1 py-1">
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className={`h-9 w-20 text-sm ${error ? "border-error" : ""}`}
        aria-label={field}
        aria-invalid={Boolean(error)}
      />
      {error && <p className="mt-0.5 text-[10px] text-error">{error}</p>}
    </td>
  );
}

export default function MarksEntryPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <MarksEntryContent />
    </Suspense>
  );
}
