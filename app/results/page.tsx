"use client";

import Link from "next/link";
import { BarChart3, GraduationCap, UploadCloud, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { examStatusLabels, examStatusTone } from "@/lib/types/exams";
import { formatDate } from "@/lib/utils";

export default function ResultsHubPage() {
  const exams = useExams();
  const db = useSisStore();

  const relevant = exams.filter((e) => ["result-processing", "result-ready", "published", "verification"].includes(e.status));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Results</h1>
        <p className="text-xs text-muted-foreground">Calculated results across exams — view by class, by student, or analyse trends</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link href="/results/class" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Class results</p>
            <p className="text-xs text-muted-foreground">Browse by class and section</p>
          </div>
        </Link>
        <Link href="/results/student" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <GraduationCap className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Student results</p>
            <p className="text-xs text-muted-foreground">Look up an individual student</p>
          </div>
        </Link>
        <Link href="/results/analytics" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Analytics</p>
            <p className="text-xs text-muted-foreground">Pass rates, distribution, trends</p>
          </div>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        {relevant.map((exam) => {
          const resultCount = db.examResults.filter((r) => r.examId === exam.id).length;
          const publication = db.resultPublications.find((p) => p.examId === exam.id);
          return (
            <Link
              key={exam.id}
              href={`/exams/${exam.id}/results`}
              className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{exam.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(exam.startDate)} · {resultCount} result{resultCount === 1 ? "" : "s"} calculated
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                {publication?.status === "published" && (
                  <Badge tone="success">
                    <UploadCloud className="size-3" /> Published
                  </Badge>
                )}
                <Badge tone={examStatusTone[exam.status]}>{examStatusLabels[exam.status]}</Badge>
              </div>
            </Link>
          );
        })}
        {relevant.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No exams are at the results stage yet.</p>}
      </div>
    </div>
  );
}
