"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, LayoutTemplate, MessageSquareWarning, Sparkles, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { ReportCardStackIllustration } from "@/components/report-cards/report-card-stack-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useExams, useReportCardTemplates } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeReportCardReadiness } from "@/lib/selectors/report-card-readiness";
import { reportCardStatusLabels, type ReportCard } from "@/lib/types/report-cards";
import { formatDateTime } from "@/lib/utils";

type Row = ReportCard & { studentName: string; examName: string };

export default function ReportCardsHubPage() {
  const router = useRouter();
  const db = useSisStore();
  const exams = useExams();
  const templates = useReportCardTemplates();

  const [statusFilter, setStatusFilter] = useState<ReportCard["status"] | "all">("all");

  const rows: Row[] = useMemo(
    () =>
      db.reportCards.map((rc) => {
        const student = db.students.find((s) => s.id === rc.studentId);
        const exam = exams.find((e) => e.id === rc.examId);
        return { ...rc, studentName: student ? `${student.profile.firstName} ${student.profile.lastName}` : rc.studentId, examName: exam?.name ?? rc.examId };
      }),
    [db.reportCards, db.students, exams],
  );

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  const generated = rows.filter((r) => r.status === "generated").length;
  const published = rows.filter((r) => r.status === "published").length;
  const pending = rows.filter((r) => r.status === "pending" || r.status === "generating").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  const readiness = computeReportCardReadiness(db);
  const hasAnyReportCards = rows.length > 0;
  const jobs = [...db.reportCardGenerationJobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const columns: ColumnDef<Row>[] = [
    { id: "student", header: "Student", alwaysVisible: true, sortValue: (r) => r.studentName, cell: (r) => <span className="text-sm font-medium text-foreground">{r.studentName}</span> },
    { id: "exam", header: "Exam", cell: (r) => <span className="text-sm text-foreground">{r.examName}</span> },
    { id: "version", header: "Version", cell: (r) => <span className="text-sm text-muted-foreground">v{r.version}</span>, defaultVisible: false },
    { id: "generated", header: "Generated", cell: (r) => <span className="text-xs text-muted-foreground">{r.generatedAt ? formatDateTime(r.generatedAt) : "—"}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={r.status === "published" ? "success" : r.status === "failed" || r.status === "revoked" ? "error" : "neutral"}>{reportCardStatusLabels[r.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Report cards</h1>
          <p className="text-xs text-muted-foreground">{templates.length} template{templates.length === 1 ? "" : "s"} configured</p>
        </div>
        <div className="flex items-center gap-xs">
          <Button asChild size="sm" variant="outline">
            <Link href="/report-cards/templates">
              <LayoutTemplate className="size-3.5" />
              Templates
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/report-cards/generate">
              <Sparkles className="size-3.5" />
              Generate
            </Link>
          </Button>
        </div>
      </div>

      {hasAnyReportCards ? (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Pending" value={String(pending)} icon={FileText} tone="neutral" />
          <StatTile label="Generated" value={String(generated)} icon={FileText} tone="info" />
          <StatTile label="Published" value={String(published)} icon={CheckCircle2} tone="success" />
          <StatTile label="Failed" value={String(failed)} icon={FileText} tone="error" />
        </div>
      ) : (
        /* Four permanently-zero metric cards say nothing useful before anything has ever
           been generated — a readiness panel explains what's actually true right now. */
        <div className="surface-3d rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Report Card Readiness</h2>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            <div className="rounded-md border border-border p-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Template</p>
              <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                {readiness.templateConfigured ? <CheckCircle2 className="size-3.5 text-success" /> : <AlertTriangle className="size-3.5 text-warning" />}
                {readiness.templateConfigured ? readiness.activeTemplateName : "Not configured"}
              </p>
            </div>
            <div className="rounded-md border border-border p-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Eligible exams</p>
              <p className="text-sm font-medium text-foreground">{readiness.eligibleExamCount}</p>
            </div>
            <div className="rounded-md border border-border p-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Calculated results</p>
              <p className="text-sm font-medium text-foreground">{readiness.calculatedResultCount}</p>
            </div>
            <div className="rounded-md border border-border p-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Eligible students</p>
              <p className="text-sm font-medium text-foreground">{readiness.eligibleStudentCount}</p>
            </div>
            <div className="rounded-md border border-border p-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Missing remarks</p>
              <p className="text-sm font-medium text-foreground">{readiness.missingRemarksCount}</p>
            </div>
            <div className="rounded-md border border-border p-sm">
              <p className="text-[11px] uppercase text-muted-foreground">Blocking issues</p>
              <p className={`text-sm font-medium ${readiness.blockingIssues.length > 0 ? "text-warning" : "text-success"}`}>{readiness.blockingIssues.length}</p>
            </div>
          </div>
          {readiness.blockingIssues.length > 0 && (
            <ul className="mt-sm flex flex-col gap-1">
              {readiness.blockingIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasAnyReportCards && (
        <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
          {(["all", "generated", "published", "revoked"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`min-h-9 shrink-0 rounded-md px-sm text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
            >
              {s === "all" ? "All" : reportCardStatusLabels[s]}
            </button>
          ))}
        </div>
      )}

      {hasAnyReportCards ? (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          caption="Report cards"
          onRowClick={(r) => router.push(`/report-cards/${r.id}`)}
          renderMobileCard={(r) => (
            <Link
              href={`/report-cards/${r.id}`}
              className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{r.studentName}</p>
                <p className="truncate text-xs text-muted-foreground">{r.examName}</p>
              </div>
              <Badge tone={r.status === "published" ? "success" : "neutral"}>{reportCardStatusLabels[r.status]}</Badge>
            </Link>
          )}
          emptyTitle="No report cards yet"
          emptyDescription="Generate report cards from a calculated result to see them here."
        />
      ) : (
        <div className="flex flex-col items-center gap-md rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ReportCardStackIllustration />
          <div className="mx-auto flex w-full max-w-[400px] min-w-0 flex-col gap-1.5">
            <p className="text-sm font-semibold text-foreground">No report cards generated yet</p>
            <p className="text-sm text-muted-foreground">
              Report cards need an active template and at least one exam with calculated results. Once those are in place, generate cards for a class, section or the whole exam in a few clicks.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-sm">
            <Button asChild size="sm">
              <Link href="/report-cards/generate">
                <Sparkles className="size-3.5" />
                Generate report cards
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/report-cards/templates">
                <LayoutTemplate className="size-3.5" />
                Preview template
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/results">
                <ClipboardList className="size-3.5" />
                View eligible results
              </Link>
            </Button>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Generation history</h2>
          <ul className="flex flex-col gap-sm">
            {jobs.slice(0, 8).map((job) => {
              const exam = exams.find((e) => e.id === job.examId);
              const template = templates.find((t) => t.id === job.templateId);
              return (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border px-sm py-sm text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {exam?.name ?? job.examId} · {template?.name ?? "Unknown template"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.scope} · {formatDateTime(job.createdAt)} by {job.createdBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-xs text-xs">
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="size-3.5" /> {job.completed}
                    </span>
                    {job.failed > 0 && (
                      <span className="flex items-center gap-1 text-error">
                        <MessageSquareWarning className="size-3.5" /> {job.failed}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3.5" /> {job.total}
                    </span>
                    <Badge tone={job.status === "completed" ? "success" : job.status === "completed-with-errors" ? "warning" : job.status === "failed" ? "error" : "neutral"}>{job.status}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
