"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExams, useReportCardTemplates } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { generateReportCards } from "@/lib/services/report-card-service";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };
type Scope = "class" | "section" | "all";

export default function GenerateReportCardsPage() {
  const db = useSisStore();
  const classes = useManagedClasses();
  const exams = useExams();
  const templates = useReportCardTemplates();
  const { can } = usePermissions();

  const resultExams = exams.filter((e) => db.examResults.some((r) => r.examId === e.id));
  const [examId, setExamId] = useState(resultExams[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates.find((t) => t.status === "active")?.id ?? templates[0]?.id ?? "");
  const [scope, setScope] = useState<Scope>("all");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [outcome, setOutcome] = useState<{ completed: number; failed: number } | null>(null);

  const examResults = db.examResults.filter((r) => r.examId === examId);
  const scopedClasses = classes.filter((c) => examResults.some((r) => r.classId === c.id));
  const scopedSections = scopedClasses.find((c) => c.id === classId)?.sections ?? [];

  let scopedResults = examResults;
  if (scope === "class" && classId) scopedResults = scopedResults.filter((r) => r.classId === classId);
  if (scope === "section" && sectionId) scopedResults = scopedResults.filter((r) => r.sectionId === sectionId);
  const targetStudentIds = scopedResults.map((r) => r.studentId);

  if (!can("reportCards.generate")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to generate report cards.</p>;
  }

  async function handleGenerate() {
    if (!templateId || targetStudentIds.length === 0) return;
    setRunning(true);
    setOutcome(null);
    setProgress({ completed: 0, total: targetStudentIds.length });
    const result = await generateReportCards(examId, templateId, scope === "all" ? "all" : scope, targetStudentIds, ACTOR, (completed, total) => setProgress({ completed, total }));
    setOutcome({ completed: result.completed, failed: result.failed });
    setRunning(false);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Generate report cards</h1>
        <p className="text-xs text-muted-foreground">Batch-generate from a template — generation runs in the background so the page stays responsive</p>
      </div>

      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div>
          <label className="mb-xs block text-xs font-medium text-foreground">Exam</label>
          <Select value={examId} onValueChange={(v) => { setExamId(v); setScope("all"); setClassId(""); setSectionId(""); }}>
            <SelectTrigger aria-label="Exam">
              <SelectValue placeholder="Select exam with calculated results" />
            </SelectTrigger>
            <SelectContent>
              {resultExams.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-xs block text-xs font-medium text-foreground">Template</label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger aria-label="Template">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-xs block text-xs font-medium text-foreground">Scope</label>
          <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
            {(["all", "class", "section"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`min-h-9 flex-1 rounded-md px-sm text-xs font-medium capitalize transition-colors ${scope === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
              >
                {s === "all" ? "All students" : s}
              </button>
            ))}
          </div>
        </div>

        {scope !== "all" && (
          <div className="grid grid-cols-2 gap-sm">
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
              <SelectTrigger aria-label="Class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {scopedClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scope === "section" && (
              <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
                <SelectTrigger aria-label="Section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {scopedSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Section {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{targetStudentIds.length} student(s) will receive a report card.</p>

        <Button onClick={handleGenerate} disabled={running || !templateId || targetStudentIds.length === 0}>
          <Sparkles className="size-3.5" />
          {running ? "Generating…" : `Generate ${targetStudentIds.length} report card${targetStudentIds.length === 1 ? "" : "s"}`}
        </Button>

        {running && (
          <div className="flex flex-col gap-1">
            <Progress value={progress.total > 0 ? (progress.completed / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              {progress.completed}/{progress.total} processed
            </p>
          </div>
        )}

        {outcome && (
          <div className="flex items-center gap-sm rounded-md border border-success/25 bg-success/8 p-sm text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            {outcome.completed} generated{outcome.failed > 0 ? `, ${outcome.failed} skipped (no result yet)` : ""}.
            <Button asChild size="sm" variant="ghost" className="ml-auto">
              <Link href="/report-cards">
                <FileText className="size-3.5" />
                View report cards
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
