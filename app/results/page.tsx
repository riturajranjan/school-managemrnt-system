"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Calendar, ClipboardCheck, FileText, GraduationCap, Layers, UploadCloud, Users } from "lucide-react";
import { PipelineStrip } from "@/components/results/pipeline-stages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useResultsDashboard } from "@/lib/hooks/api/use-results-dashboard";
import { formatDate } from "@/lib/utils";

const publicationBadge: Record<"published" | "not-published", { label: string; tone: "success" | "neutral" }> = {
  published: { label: "Published", tone: "success" },
  "not-published": { label: "Not published", tone: "neutral" },
};

export default function ResultsHubPage() {
  const { can } = usePermissions();
  const { data, loading, error, reload } = useResultsDashboard();
  const rows = data?.rows ?? [];

  if (!can("results.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view results.</p>;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Results</h1>
        <p className="text-xs text-muted-foreground">Track every exam through the result pipeline — marks, verification, calculation and publication</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link
          href="/results/class"
          className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Class results</p>
            <p className="text-xs text-muted-foreground">Browse by class and section</p>
          </div>
        </Link>
        <Link
          href="/results/student"
          className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <GraduationCap className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Student results</p>
            <p className="text-xs text-muted-foreground">Look up an individual student</p>
          </div>
        </Link>
        <Link
          href="/results/analytics"
          className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Analytics</p>
            <p className="text-xs text-muted-foreground">Pass rates, distribution, trends</p>
          </div>
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load results: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading results…</div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((row) => {
            const pubBadge = publicationBadge[row.published ? "published" : "not-published"];
            return (
              <div key={row.examId} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <Link href={`/exams/${row.examId}`} className="truncate text-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                      {row.examName}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-sm gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> {formatDate(row.startsOn)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="size-3" /> {row.className}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-xs">
                    {row.incompleteCount > 0 && (
                      <Badge tone="warning">
                        <AlertTriangle className="size-3" /> {row.incompleteCount} incomplete
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
                      <FileText className="size-3" /> {row.studentCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Report cards</p>
                    <p className="flex items-center gap-1 font-medium text-foreground">
                      <ClipboardCheck className="size-3" /> {row.reportCardCount}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button asChild size="sm" variant={row.published ? "outline" : "primary"}>
                    <Link href={row.primaryAction.href}>{row.primaryAction.label}</Link>
                  </Button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
                <FileText className="size-5" />
              </span>
              <div className="mx-auto flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">No exams are at the results stage yet</p>
                <p className="text-sm text-muted-foreground">Once an exam&apos;s schedule is set and marks entry begins, it appears here with its full result pipeline.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
