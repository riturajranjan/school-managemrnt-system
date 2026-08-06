"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Calendar, ClipboardCheck, FileText, GraduationCap, Layers, UploadCloud, Users } from "lucide-react";
import { PipelineStrip } from "@/components/results/pipeline-stages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeExamPipelineRow } from "@/lib/selectors/results-pipeline";
import { formatDate } from "@/lib/utils";

const relevantStatuses = ["marks-entry", "verification", "result-processing", "result-ready", "published", "archived"];

const publicationBadge: Record<string, { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  published: { label: "Published", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  revoked: { label: "Revoked", tone: "warning" },
  "not-published": { label: "Not published", tone: "neutral" },
};

export default function ResultsHubPage() {
  const exams = useExams();
  const db = useSisStore();
  const classes = useManagedClasses();

  const classNames = (ids: string[]) => ids.map((id) => classes.find((c) => c.id === id)?.name ?? id).join(", ") || "No classes";

  const relevant = exams
    .filter((e) => relevantStatuses.includes(e.status))
    .map((e) => computeExamPipelineRow(db, e, classNames(e.classIds)))
    .sort((a, b) => (a.exam.startDate < b.exam.startDate ? 1 : -1));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Results</h1>
        <p className="text-xs text-muted-foreground">Track every exam through the result pipeline — marks, verification, calculation, review, report cards and publication</p>
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

      <div className="flex flex-col gap-sm">
        {relevant.map((row) => {
          const pubBadge = publicationBadge[row.publicationStatus];
          return (
            <div key={row.exam.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex flex-wrap items-start justify-between gap-sm">
                <div className="min-w-0">
                  <Link href={`/exams/${row.exam.id}`} className="truncate text-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {row.exam.name}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-sm gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" /> {formatDate(row.exam.startDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="size-3" /> {row.className}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-xs">
                  {row.inconsistencies.length > 0 && (
                    <Badge tone="warning">
                      <AlertTriangle className="size-3" /> {row.inconsistencies.length} inconsistenc{row.inconsistencies.length === 1 ? "y" : "ies"}
                    </Badge>
                  )}
                  {pubBadge.tone === "success" && <UploadCloud className="size-3.5 text-success" />}
                  <Badge tone={pubBadge.tone}>{pubBadge.label}</Badge>
                </div>
              </div>

              <PipelineStrip stages={row.stages} />

              <div className="grid grid-cols-2 gap-sm text-xs sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Marks entry</p>
                  <p className="font-medium text-foreground">{row.marksPercent}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verification</p>
                  <p className="font-medium text-foreground">{row.verificationPercent}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Results calculated</p>
                  <p className="flex items-center gap-1 font-medium text-foreground">
                    <FileText className="size-3" /> {row.resultCount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Report cards</p>
                  <p className="flex items-center gap-1 font-medium text-foreground">
                    <ClipboardCheck className="size-3" /> {row.reportCardCount}
                  </p>
                </div>
              </div>

              {(row.blockingIssue || row.inconsistencies.length > 0) && (
                <div className="flex flex-col gap-0.5 rounded-md border border-warning/30 bg-warning/8 px-sm py-1.5 text-xs text-warning">
                  {row.blockingIssue && (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="size-3 shrink-0" /> {row.blockingIssue}
                    </span>
                  )}
                  {row.inconsistencies.map((issue, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <AlertTriangle className="size-3 shrink-0" /> {issue}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button asChild size="sm" variant={row.publicationStatus === "published" ? "outline" : "primary"}>
                  <Link href={row.primaryAction.href}>{row.primaryAction.label}</Link>
                </Button>
              </div>
            </div>
          );
        })}
        {relevant.length === 0 && (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
              <FileText className="size-5" />
            </span>
            <div className="mx-auto flex max-w-sm flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">No exams are at the results stage yet</p>
              <p className="text-sm text-muted-foreground">Once an exam reaches marks entry, verification or beyond, it appears here with its full result pipeline.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
