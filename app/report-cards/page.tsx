"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCircle2, FileText, LayoutTemplate, Sparkles } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useExams, useReportCardTemplates } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
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

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Pending" value={String(pending)} icon={FileText} tone="neutral" />
        <StatTile label="Generated" value={String(generated)} icon={FileText} tone="info" />
        <StatTile label="Published" value={String(published)} icon={CheckCircle2} tone="success" />
        <StatTile label="Failed" value={String(failed)} icon={FileText} tone="error" />
      </div>

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
              <p className="text-xs text-muted-foreground">{r.examName}</p>
            </div>
            <Badge tone={r.status === "published" ? "success" : "neutral"}>{reportCardStatusLabels[r.status]}</Badge>
          </Link>
        )}
        emptyTitle="No report cards yet"
        emptyDescription="Generate report cards from a calculated result to see them here."
      />
    </div>
  );
}
