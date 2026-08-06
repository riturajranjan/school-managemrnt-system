"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { subjectById } from "@/lib/data/seed/academics";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10 : sorted[mid];
}

export default function ResultsAnalyticsPage() {
  const db = useSisStore();
  const classes = useManagedClasses();
  const exams = useExams();
  const { can } = usePermissions();

  const resultExams = exams.filter((e) => db.examResults.some((r) => r.examId === e.id));
  const [examId, setExamId] = useState(resultExams[0]?.id ?? "");

  const results = useMemo(() => db.examResults.filter((r) => r.examId === examId), [db.examResults, examId]);

  const percents = results.map((r) => r.percent);
  const passCount = results.filter((r) => r.status === "pass").length;
  const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;
  const average = percents.length > 0 ? Math.round((percents.reduce((s, p) => s + p, 0) / percents.length) * 10) / 10 : 0;
  const highest = percents.length > 0 ? Math.max(...percents) : 0;
  const lowest = percents.length > 0 ? Math.min(...percents) : 0;

  const gradeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) counts.set(r.grade, (counts.get(r.grade) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [results]);

  const subjectPerformance = useMemo(() => {
    const bySubject = new Map<string, number[]>();
    for (const r of results) {
      for (const sr of r.subjectResults) {
        const list = bySubject.get(sr.subjectId) ?? [];
        list.push(sr.percent);
        bySubject.set(sr.subjectId, list);
      }
    }
    return [...bySubject.entries()]
      .map(([subjectId, percentsList]) => ({ subjectId, avg: Math.round((percentsList.reduce((s, p) => s + p, 0) / percentsList.length) * 10) / 10 }))
      .sort((a, b) => b.avg - a.avg);
  }, [results]);

  const sectionComparison = useMemo(() => {
    const bySection = new Map<string, number[]>();
    for (const r of results) {
      const list = bySection.get(r.sectionId) ?? [];
      list.push(r.percent);
      bySection.set(r.sectionId, list);
    }
    return [...bySection.entries()].map(([sectionId, percentsList]) => {
      const schoolClass = classes.find((c) => c.sections.some((s) => s.id === sectionId));
      const section = schoolClass?.sections.find((s) => s.id === sectionId);
      return { label: `${schoolClass?.name ?? ""}-${section?.name ?? ""}`, avg: Math.round((percentsList.reduce((s, p) => s + p, 0) / percentsList.length) * 10) / 10 };
    });
  }, [results, classes]);

  const atRisk = [...results].filter((r) => r.status === "fail" || r.status === "re-exam-required" || r.percent < 40).sort((a, b) => a.percent - b.percent).slice(0, 5);
  const topPerformers = [...results].filter((r) => r.status === "pass").sort((a, b) => b.percent - a.percent).slice(0, 5);

  const studentName = (id: string) => {
    const s = db.students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  };

  if (!can("results.viewAnalytics")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view result analytics.</p>;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Result analytics</h1>
        <p className="text-xs text-muted-foreground">Pass rates, distribution and performance trends — visible to staff only</p>
      </div>

      <Select value={examId} onValueChange={setExamId}>
        <SelectTrigger className="w-64" aria-label="Exam">
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

      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No calculated results for this exam yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
            <StatTile label="Pass rate" value={`${passRate}%`} tone={passRate >= 75 ? "success" : passRate >= 50 ? "warning" : "error"} />
            <StatTile label="Average" value={`${average}%`} tone="info" />
            <StatTile label="Median" value={`${median(percents)}%`} tone="info" />
            <StatTile label="Highest" value={`${highest}%`} tone="success" />
            <StatTile label="Lowest" value={`${lowest}%`} tone="error" />
          </div>

          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Grade distribution</h2>
              <div className="flex flex-col gap-sm">
                {gradeDistribution.map(([grade, count]) => (
                  <div key={grade} className="flex items-center gap-sm">
                    <span className="w-10 shrink-0 text-xs font-medium text-foreground">{grade}</span>
                    <div className="flex-1">
                      <MiniBar percent={(count / results.length) * 100} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Subject performance</h2>
              <div className="flex flex-col gap-sm">
                {subjectPerformance.map((s) => (
                  <div key={s.subjectId} className="flex items-center gap-sm">
                    <span className="w-24 shrink-0 truncate text-xs font-medium text-foreground">{subjectById(s.subjectId)?.name}</span>
                    <div className="flex-1">
                      <MiniBar percent={s.avg} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{s.avg}%</span>
                  </div>
                ))}
              </div>
            </div>

            {sectionComparison.length > 1 && (
              <div className="rounded-lg border border-border bg-surface p-md">
                <h2 className="mb-sm text-sm font-semibold text-foreground">Section comparison</h2>
                <div className="flex flex-col gap-sm">
                  {sectionComparison.map((s) => (
                    <div key={s.label} className="flex items-center gap-sm">
                      <span className="w-16 shrink-0 text-xs font-medium text-foreground">{s.label}</span>
                      <div className="flex-1">
                        <MiniBar percent={s.avg} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{s.avg}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-error/25 bg-error/5 p-md">
              <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-error">
                <AlertTriangle className="size-4" /> At-risk students
              </h2>
              {atRisk.length === 0 ? (
                <p className="text-xs text-muted-foreground">No at-risk students in this exam.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {atRisk.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{studentName(r.studentId)}</span>
                      <Badge tone="error">{r.percent}%</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-success/25 bg-success/5 p-md">
              <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-success">
                <TrendingUp className="size-4" /> High performers
              </h2>
              <ul className="flex flex-col gap-1">
                {topPerformers.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{studentName(r.studentId)}</span>
                    <Badge tone="success">{r.percent}%</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
