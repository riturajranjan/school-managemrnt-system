"use client";

// Marks verification (Phase 8B) — real PostgreSQL/API cutover. Submitted papers
// awaiting verification; the detail drawer shows raw descriptive stats (highest/
// average/lowest/missing/below-passing) computed directly from this paper's own
// marks — never a computed grade, rank, or overall exam result (Phase 8C+).
// Verification is SCHOOL_ADMIN/PRINCIPAL only (marks.verify) — no separate
// "verification teacher" stage exists in the real RBAC catalog.
import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useExamMarksRoster, useMarksSummary, verifyMarksRequest } from "@/lib/hooks/api/use-exams-api";
import type { ExamMarksSummaryItemDto } from "@/lib/api/contracts";

export default function MarksVerificationPage() {
  const { data: rows, reload: reloadSummary } = useMarksSummary();
  const submitted = useMemo(() => rows.filter((r) => r.sheetStatus === "submitted"), [rows]);

  const [detail, setDetail] = useState<ExamMarksSummaryItemDto | null>(null);
  const roster = useExamMarksRoster(detail?.examId, detail?.entryId);
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<ExamMarksSummaryItemDto>[] = [
    {
      id: "subject", header: "Subject", alwaysVisible: true,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.section.className}-{r.section.name} · {r.subject.name}</p>
          <p className="text-xs text-muted-foreground">{r.examName} · {r.examDate}</p>
        </div>
      ),
    },
    { id: "entered", header: "Entered", cell: (r) => <span className="text-xs text-muted-foreground">{r.enteredCount}/{r.totalStudents}</span> },
    { id: "status", header: "Status", align: "right", cell: () => <Badge tone="info">Submitted</Badge> },
  ];

  const stats = useMemo(() => {
    if (!roster.data) return null;
    const marked = roster.data.students.filter((s) => s.status === "marked");
    const values = marked.map((s) => s.marksObtained ?? (s.theoryMarks ?? 0) + (s.practicalMarks ?? 0));
    const below = marked.filter((s) => (s.marksObtained ?? (s.theoryMarks ?? 0) + (s.practicalMarks ?? 0)) < roster.data!.entry.passingMarks).length;
    const missing = roster.data.students.filter((s) => s.status === "pending").length;
    return {
      count: values.length,
      average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0,
      highest: values.length ? Math.max(...values) : 0,
      lowest: values.length ? Math.min(...values) : 0,
      below, missing,
    };
  }, [roster.data]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Marks verification</h1>
        <p className="text-xs text-muted-foreground">Review submitted marks before they are locked</p>
      </div>

      <DataTable
        columns={columns}
        rows={submitted}
        getRowId={(r) => r.entryId}
        caption="Marks awaiting verification"
        onRowClick={setDetail}
        renderMobileCard={(r) => (
          <button
            type="button"
            onClick={() => setDetail(r)}
            className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{r.section.className}-{r.section.name} · {r.subject.name}</p>
              <Badge tone="info">Submitted</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.examName} · {r.enteredCount}/{r.totalStudents} entered</p>
          </button>
        )}
        emptyTitle="Nothing awaiting verification"
        emptyDescription="Submitted marks will appear here once teachers finish entry."
      />

      <DetailDrawer
        open={detail !== null}
        onOpenChange={(open) => { if (!open) { setDetail(null); setError(null); } }}
        title={detail ? `${detail.section.className}-${detail.section.name} · ${detail.subject.name}` : ""}
        description={detail?.examName ?? ""}
      >
        {detail && roster.data && stats && (
          <div className="flex flex-col gap-md">
            {error && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{error}</p>}
            <div className="grid grid-cols-3 gap-sm text-center text-sm">
              <div className="rounded-md border border-border p-sm"><p className="text-lg font-bold text-foreground">{stats.highest}</p><p className="text-xs text-muted-foreground">Highest</p></div>
              <div className="rounded-md border border-border p-sm"><p className="text-lg font-bold text-foreground">{stats.average}</p><p className="text-xs text-muted-foreground">Average</p></div>
              <div className="rounded-md border border-border p-sm"><p className="text-lg font-bold text-foreground">{stats.lowest}</p><p className="text-xs text-muted-foreground">Lowest</p></div>
            </div>
            <div className="flex items-center gap-sm text-xs">
              <Badge tone="success">{stats.count} marked</Badge>
              <Badge tone={stats.below > 0 ? "error" : "neutral"}>{stats.below} below passing</Badge>
              <Badge tone={stats.missing > 0 ? "warning" : "neutral"}>{stats.missing} missing</Badge>
            </div>
            {stats.missing > 0 && (
              <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-xs text-warning">
                <AlertTriangle className="size-4 shrink-0" />
                {stats.missing} student{stats.missing === 1 ? "" : "s"} still have no entered marks.
              </div>
            )}
            <div className="flex flex-wrap gap-sm border-t border-border pt-sm">
              {roster.data.canVerify && (
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await verifyMarksRequest(detail.examId, detail.entryId);
                    if (!res.success) { setError(res.error.message); return; }
                    setDetail(null);
                    reloadSummary();
                  }}
                >
                  <ShieldCheck className="size-3.5" />
                  Verify
                </Button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
