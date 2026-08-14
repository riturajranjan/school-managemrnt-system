"use client";

// Marks hub (Phase 8B) — real PostgreSQL/API cutover. Every scheduled paper
// (Phase 8A ExamScheduleEntry) across non-draft exams, with its real marks-entry
// status. CSV import is not migrated in this phase (a distinct bulk-mapping
// feature, not required by the marks-entry scope) — the "Import" entry point is
// removed rather than left dangling against real ids the mock importer can't read.
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, FileBadge, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { useMarksSummary } from "@/lib/hooks/api/use-exams-api";

type Bucket = "not-started" | "in-progress" | "submitted" | "verified";
const bucketLabels: Record<Bucket, string> = { "not-started": "Not started", "in-progress": "In progress", submitted: "Submitted", verified: "Verified" };
const bucketTone: Record<Bucket, "neutral" | "warning" | "info" | "success"> = { "not-started": "neutral", "in-progress": "warning", submitted: "info", verified: "success" };

function bucketOf(r: { sheetStatus: "draft" | "submitted" | "verified"; enteredCount: number }): Bucket {
  return r.sheetStatus === "verified" ? "verified" : r.sheetStatus === "submitted" ? "submitted" : r.enteredCount > 0 ? "in-progress" : "not-started";
}

export default function MarksHubPage() {
  const { data: rows, loading } = useMarksSummary();

  const [statusFilter, setStatusFilter] = useState<Bucket | "all">("all");
  const filtered = statusFilter === "all" ? rows : rows.filter((r) => bucketOf(r) === statusFilter);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { "not-started": 0, "in-progress": 0, submitted: 0, verified: 0 };
    for (const r of rows) c[bucketOf(r)]++;
    return c;
  }, [rows]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Marks</h1>
        <p className="text-xs text-muted-foreground">Every scheduled paper awaiting or in marks entry, across exams</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Not started" value={String(counts["not-started"])} icon={ClipboardList} tone="neutral" />
        <StatTile label="In progress" value={String(counts["in-progress"])} icon={FileBadge} tone="warning" />
        <StatTile label="Submitted" value={String(counts.submitted)} icon={CheckCircle2} tone="info" />
        <StatTile label="Verified" value={String(counts.verified)} icon={ShieldCheck} tone="success" />
      </div>

      <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
        {(["all", "not-started", "in-progress", "submitted", "verified"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`min-h-9 shrink-0 rounded-md px-sm text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
          >
            {s === "all" ? "All" : bucketLabels[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {filtered.map((row) => (
          <Link
            key={row.entryId}
            href={`/marks/entry?examId=${row.examId}&entryId=${row.entryId}`}
            className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.section.className}-{row.section.name} · {row.subject.name}</p>
              <p className="text-xs text-muted-foreground">{row.examName} · {row.examDate}</p>
            </div>
            <div className="flex shrink-0 items-center gap-sm">
              <span className="text-xs text-muted-foreground">{row.enteredCount}/{row.totalStudents}</span>
              <Badge tone={bucketTone[bucketOf(row)]}>{bucketLabels[bucketOf(row)]}</Badge>
            </div>
          </Link>
        ))}
        {!loading && filtered.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Nothing matches this filter.</p>}
      </div>
    </div>
  );
}
