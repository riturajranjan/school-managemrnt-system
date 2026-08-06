"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Pencil, Search, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PerformanceOrbit, type OrbitDimension } from "@/components/results/performance-orbit";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { useStudents } from "@/lib/hooks/use-students";
import { subjectById } from "@/lib/data/seed/academics";
import { generateRemarkSuggestion } from "@/lib/services/teacher-ai-service";
import { upsertRemark } from "@/lib/services/teacher-remark-service";
import { overallResultStatusLabels } from "@/lib/types/results";
import { formatDate } from "@/lib/utils";

const REMARK_ACTOR = { name: "Class Teacher", role: "Teacher" };

const departmentTone: Record<string, "success" | "info" | "warning" | "error" | "neutral"> = {};

function toneForPercent(percent: number): "success" | "info" | "warning" | "error" {
  if (percent >= 75) return "success";
  if (percent >= 50) return "info";
  if (percent >= 33) return "warning";
  return "error";
}

function StudentResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useSisStore();
  const students = useStudents();
  const classes = useManagedClasses();
  const exams = useExams();
  const { can } = usePermissions();
  const canView = can("results.view");

  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState(searchParams.get("studentId") ?? "");
  const [examId, setExamId] = useState(searchParams.get("examId") ?? "");
  const [editingRemark, setEditingRemark] = useState(false);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [remarkInfluencedBy, setRemarkInfluencedBy] = useState<string[]>([]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return students.filter((s) => `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q)).slice(0, 8);
  }, [query, students]);

  const student = students.find((s) => s.id === studentId);
  const studentResults = db.examResults.filter((r) => r.studentId === studentId).sort((a, b) => (a.calculatedAt < b.calculatedAt ? 1 : -1));
  const result = studentResults.find((r) => r.examId === examId) ?? studentResults[0];
  const previous = studentResults.find((r) => r.id !== result?.id);
  const exam = exams.find((e) => e.id === result?.examId);
  const schoolClass = student ? classes.find((c) => c.id === student.classId) : undefined;
  const section = schoolClass?.sections.find((s) => s.id === student?.sectionId);

  if (!canView) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view results.</p>;

  const dimensions: OrbitDimension[] = [];
  if (result) {
    const byDepartment = new Map<string, number[]>();
    for (const sr of result.subjectResults) {
      const subject = subjectById(sr.subjectId);
      if (!subject) continue;
      const list = byDepartment.get(subject.department) ?? [];
      list.push(sr.percent);
      byDepartment.set(subject.department, list);
    }
    for (const [department, percents] of byDepartment) {
      const avg = Math.round(percents.reduce((s, p) => s + p, 0) / percents.length);
      dimensions.push({ key: department, label: department, score: avg, tone: toneForPercent(avg), detail: `${avg}% average across ${percents.length} subject${percents.length === 1 ? "" : "s"}` });
    }
    dimensions.push({ key: "attendance", label: "Attendance", score: result.attendancePercent, tone: toneForPercent(result.attendancePercent), detail: `${result.attendancePercent}% exam attendance` });
    if (previous) {
      const delta = Math.round(result.percent - previous.percent);
      const improvementScore = Math.max(0, Math.min(100, 50 + delta * 2));
      dimensions.push({
        key: "improvement",
        label: "Improvement",
        score: improvementScore,
        tone: delta > 0 ? "success" : delta < 0 ? "warning" : "info",
        detail: `${delta > 0 ? "+" : ""}${delta}% vs ${exams.find((e) => e.id === previous.examId)?.name ?? "previous exam"}`,
      });
    }
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Student results</h1>
        <p className="text-xs text-muted-foreground">Look up an individual student&apos;s result across exams</p>
      </div>

      <div className="relative">
        <div className="flex items-center gap-sm rounded-md border border-input bg-surface px-sm">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or admission number"
            className="border-0 px-0 focus-visible:ring-0"
          />
        </div>
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-floating">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStudentId(s.id);
                    setQuery("");
                    router.replace(`/results/student?studentId=${s.id}`);
                  }}
                  className="flex w-full items-center justify-between px-sm py-2 text-left text-sm outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary"
                >
                  <span className="text-foreground">
                    {s.profile.firstName} {s.profile.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.admissionNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!student && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Search for a student to view their results.</p>}

      {student && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {student.profile.firstName} {student.profile.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {schoolClass?.name}-{section?.name} · Roll {student.rollNumber ?? "—"} · {student.admissionNumber}
              </p>
            </div>
            {studentResults.length > 0 && (
              <Select value={result?.examId ?? ""} onValueChange={(v) => { setExamId(v); router.replace(`/results/student?studentId=${student.id}&examId=${v}`); }}>
                <SelectTrigger className="w-56" aria-label="Select exam">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {studentResults.map((r) => (
                    <SelectItem key={r.examId} value={r.examId}>
                      {exams.find((e) => e.id === r.examId)?.name ?? r.examId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!result ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No calculated results yet for this student.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-surface p-sm text-center">
                  <p className="text-xl font-bold text-foreground">{result.percent}%</p>
                  <p className="text-xs text-muted-foreground">Overall</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-sm text-center">
                  <p className="text-xl font-bold text-foreground">{result.grade}</p>
                  <p className="text-xs text-muted-foreground">Grade</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-sm text-center">
                  <p className="text-xl font-bold text-foreground">{result.rank ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Rank</p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-sm text-center">
                  <p className="text-xl font-bold text-foreground">{result.attendancePercent}%</p>
                  <p className="text-xs text-muted-foreground">Attendance</p>
                </div>
              </div>

              <div className="flex items-center gap-sm">
                <Badge tone={result.status === "pass" ? "success" : result.status === "fail" || result.status === "withheld" ? "error" : "warning"}>{overallResultStatusLabels[result.status]}</Badge>
                {exam && <span className="text-xs text-muted-foreground">{exam.name} · {formatDate(exam.startDate)}</span>}
                {previous && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {result.percent >= previous.percent ? <TrendingUp className="size-3.5 text-success" /> : <TrendingDown className="size-3.5 text-warning" />}
                    {result.percent >= previous.percent ? "+" : ""}
                    {Math.round(result.percent - previous.percent)}% vs {exams.find((e) => e.id === previous.examId)?.name}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-md lg:grid-cols-[1fr_240px]">
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary/60 text-left">
                        <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Subject</th>
                        <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Marks</th>
                        <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Grade</th>
                        <th className="px-sm py-2 text-right text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.subjectResults.map((sr) => (
                        <tr key={sr.examSubjectId} className="border-b border-border last:border-0">
                          <td className="px-sm py-2 text-foreground">{subjectById(sr.subjectId)?.name}</td>
                          <td className="px-sm py-2 text-foreground">
                            {sr.total}/{sr.maxMarks} ({sr.percent}%)
                          </td>
                          <td className="px-sm py-2">
                            <Badge tone={departmentTone[sr.grade] ?? "info"}>{sr.grade}</Badge>
                          </td>
                          <td className="px-sm py-2 text-right">
                            <Badge tone={sr.status === "pass" ? "success" : sr.status === "fail" ? "error" : "neutral"}>{sr.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {dimensions.length > 0 && (
                  <div className="rounded-lg border border-border bg-surface p-sm">
                    <p className="mb-xs text-center text-xs font-semibold text-foreground">Performance breakdown</p>
                    <PerformanceOrbit dimensions={dimensions} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                <div className="rounded-lg border border-success/25 bg-success/8 p-sm">
                  <p className="mb-xs text-xs font-semibold text-success">Strengths</p>
                  <p className="text-sm text-foreground">
                    {[...result.subjectResults].sort((a, b) => b.percent - a.percent).slice(0, 2).map((sr) => subjectById(sr.subjectId)?.name).join(", ") || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-warning/25 bg-warning/8 p-sm">
                  <p className="mb-xs text-xs font-semibold text-warning">Improvement areas</p>
                  <p className="text-sm text-foreground">
                    {[...result.subjectResults].sort((a, b) => a.percent - b.percent).slice(0, 2).map((sr) => subjectById(sr.subjectId)?.name).join(", ") || "—"}
                  </p>
                </div>
              </div>

              {(() => {
                const remarks = db.teacherRemarks.filter((r) => r.examId === result.examId && r.studentId === student.id);
                const classTeacherRemark = remarks.find((r) => r.type === "class-teacher");
                const canWrite = can("marks.enter");

                if (!canWrite && remarks.length === 0) return null;

                return (
                  <div className="rounded-lg border border-border bg-surface p-sm">
                    <div className="mb-xs flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Teacher feedback</p>
                      {canWrite && !editingRemark && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRemarkDraft(classTeacherRemark?.text ?? "");
                            setRemarkInfluencedBy([]);
                            setEditingRemark(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                          {classTeacherRemark ? "Edit" : "Add remark"}
                        </Button>
                      )}
                    </div>

                    {!editingRemark ? (
                      <ul className="flex flex-col gap-sm">
                        {remarks.map((r) => (
                          <li key={r.id} className="text-sm text-foreground">
                            <span className="text-xs font-medium text-muted-foreground">{r.authorName}:</span> {r.text}
                          </li>
                        ))}
                        {remarks.length === 0 && <p className="text-sm text-muted-foreground">No remarks yet.</p>}
                      </ul>
                    ) : (
                      <div className="flex flex-col gap-sm">
                        <Textarea value={remarkDraft} onChange={(e) => setRemarkDraft(e.target.value)} rows={3} placeholder="Write a remark, or generate a suggestion to start from" />
                        {remarkInfluencedBy.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">Suggestion based on: {remarkInfluencedBy.join(" · ")}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-xs">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const strongest = [...result.subjectResults].sort((a, b) => b.percent - a.percent)[0];
                              const weakest = [...result.subjectResults].sort((a, b) => a.percent - b.percent)[0];
                              const suggestion = generateRemarkSuggestion({
                                studentName: student.profile.firstName,
                                percent: result.percent,
                                attendancePercent: result.attendancePercent,
                                failedSubjectCount: result.failedSubjectCount,
                                strongestSubject: strongest ? subjectById(strongest.subjectId)?.name : undefined,
                                weakestSubject: weakest ? subjectById(weakest.subjectId)?.name : undefined,
                                percentDeltaVsPrevious: previous ? result.percent - previous.percent : undefined,
                              });
                              setRemarkDraft(suggestion.text);
                              setRemarkInfluencedBy(suggestion.influencedBy);
                            }}
                          >
                            <Sparkles className="size-3.5" />
                            Suggest with AI
                          </Button>
                          <Button
                            size="sm"
                            disabled={!remarkDraft.trim()}
                            onClick={() => {
                              upsertRemark(result.examId, student.id, "class-teacher", remarkDraft.trim(), REMARK_ACTOR, {
                                aiGenerated: remarkInfluencedBy.length > 0,
                                aiInfluencedBy: remarkInfluencedBy.length > 0 ? remarkInfluencedBy : undefined,
                              });
                              setEditingRemark(false);
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRemark(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function StudentResultsPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <StudentResultsContent />
    </Suspense>
  );
}
