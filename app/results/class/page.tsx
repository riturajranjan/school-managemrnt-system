"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { overallResultStatusLabels, type StudentResult } from "@/lib/types/results";

const statusTone: Record<string, "success" | "error" | "warning" | "neutral"> = { pass: "success", fail: "error", withheld: "error", absent: "neutral", "re-exam-required": "warning", pending: "neutral" };

export default function ClassResultsPage() {
  const db = useSisStore();
  const classes = useManagedClasses();
  const exams = useExams();
  const { can } = usePermissions();

  const resultExams = exams.filter((e) => db.examResults.some((r) => r.examId === e.id));
  const [examId, setExamId] = useState(resultExams[0]?.id ?? "");
  const examClasses = useMemo(() => classes.filter((c) => db.examClasses.some((ec) => ec.examId === examId && ec.classId === c.id)), [classes, db.examClasses, examId]);
  const [sectionId, setSectionId] = useState("");

  const rows = useMemo(() => {
    let results = db.examResults.filter((r) => r.examId === examId);
    if (sectionId) results = results.filter((r) => r.sectionId === sectionId);
    return results.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [db.examResults, examId, sectionId]);

  if (!can("results.view")) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view results.</p>;

  const studentName = (id: string) => {
    const s = db.students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  };
  const passRate = rows.length > 0 ? Math.round((rows.filter((r) => r.status === "pass").length / rows.length) * 100) : 0;
  const avg = rows.length > 0 ? Math.round((rows.reduce((sum, r) => sum + r.percent, 0) / rows.length) * 10) / 10 : 0;

  const columns: ColumnDef<StudentResult>[] = [
    { id: "rank", header: "Rank", width: "60px", cell: (r) => <span className="text-sm text-foreground">{r.rank ?? "—"}</span> },
    { id: "student", header: "Student", alwaysVisible: true, cell: (r) => <span className="text-sm font-medium text-foreground">{studentName(r.studentId)}</span> },
    { id: "total", header: "Total", cell: (r) => <span className="text-sm text-foreground">{r.totalObtained}/{r.totalMax}</span> },
    { id: "percent", header: "Percent", sortValue: (r) => r.percent, cell: (r) => <span className="text-sm text-foreground">{r.percent}%</span> },
    { id: "grade", header: "Grade", cell: (r) => <Badge tone="info">{r.grade}</Badge> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{overallResultStatusLabels[r.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Class results</h1>
        <p className="text-xs text-muted-foreground">Ranked results by class and section</p>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Select value={examId} onValueChange={(v) => { setExamId(v); setSectionId(""); }}>
          <SelectTrigger className="w-56" aria-label="Exam">
            <SelectValue placeholder="Select exam" />
          </SelectTrigger>
          <SelectContent>
            {resultExams.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sectionId} onValueChange={setSectionId}>
          <SelectTrigger className="w-48" aria-label="Class and section">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            {examClasses.flatMap((c) =>
              c.sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {c.name}-{s.name}
                </SelectItem>
              )),
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-sm">
        <StatTile label="Students" value={String(rows.length)} tone="neutral" />
        <StatTile label="Pass rate" value={`${passRate}%`} tone={passRate >= 75 ? "success" : passRate >= 50 ? "warning" : "error"} />
        <StatTile label="Average" value={`${avg}%`} tone="info" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        caption="Class results"
        renderMobileCard={(r) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {r.rank ? `#${r.rank} · ` : ""}
                {studentName(r.studentId)}
              </p>
              <p className="text-xs text-muted-foreground">{r.percent}% · {r.grade}</p>
            </div>
            <Badge tone={statusTone[r.status]}>{overallResultStatusLabels[r.status]}</Badge>
          </div>
        )}
        emptyTitle="No results for this selection"
      />
    </div>
  );
}
