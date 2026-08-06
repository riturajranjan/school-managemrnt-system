"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, FileBadge, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { subjectById } from "@/lib/data/seed/academics";
import { marksEntryStatusLabels, type MarksEntryStatus } from "@/lib/types/marks";
import { formatDate } from "@/lib/utils";

export default function MarksHubPage() {
  const db = useSisStore();
  const classes = useManagedClasses();

  const rows = useMemo(() => {
    return db.examSubjects
      .filter((s) => s.date)
      .map((s) => {
        const exam = db.exams.find((e) => e.id === s.examId);
        const session = db.marksEntrySessions.find((ms) => ms.examSubjectId === s.id);
        const schoolClass = classes.find((c) => c.id === s.classId);
        const section = schoolClass?.sections.find((sec) => sec.id === s.sectionId);
        const subject = subjectById(s.subjectId);
        return { examSubject: s, exam, session, className: schoolClass?.name ?? "", sectionName: section?.name ?? "", subjectName: subject?.name ?? "" };
      })
      .filter((r) => r.exam && r.exam.status !== "draft" && r.exam.status !== "archived")
      .sort((a, b) => (a.examSubject.date! < b.examSubject.date! ? 1 : -1));
  }, [db, classes]);

  const [statusFilter, setStatusFilter] = useState<MarksEntryStatus | "all">("all");
  const filtered = statusFilter === "all" ? rows : rows.filter((r) => (r.session?.status ?? "not-started") === statusFilter);

  const notStarted = rows.filter((r) => !r.session || r.session.status === "not-started").length;
  const inProgress = rows.filter((r) => r.session?.status === "draft").length;
  const submitted = rows.filter((r) => r.session?.status === "submitted").length;
  const locked = rows.filter((r) => r.session?.status === "locked").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks</h1>
          <p className="text-xs text-muted-foreground">Every subject awaiting or in marks entry, across exams</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/marks/import">
            <Upload className="size-3.5" />
            Import marks
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Not started" value={String(notStarted)} icon={ClipboardList} tone="neutral" />
        <StatTile label="In progress" value={String(inProgress)} icon={FileBadge} tone="warning" />
        <StatTile label="Submitted" value={String(submitted)} icon={CheckCircle2} tone="info" />
        <StatTile label="Locked" value={String(locked)} icon={CheckCircle2} tone="success" />
      </div>

      <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
        {(["all", "not-started", "draft", "submitted", "locked"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`min-h-9 shrink-0 rounded-md px-sm text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
          >
            {s === "all" ? "All" : marksEntryStatusLabels[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {filtered.map((row) => (
          <Link
            key={row.examSubject.id}
            href={`/marks/entry?examId=${row.exam!.id}&examSubjectId=${row.examSubject.id}`}
            className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {row.className}-{row.sectionName} · {row.subjectName}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.exam!.name} · {formatDate(row.examSubject.date!)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-sm">
              <span className="text-xs text-muted-foreground">{row.session?.completionPercent ?? 0}%</span>
              <Badge tone={row.session?.status === "locked" ? "success" : row.session?.status === "submitted" ? "info" : row.session?.status === "draft" ? "warning" : "neutral"}>
                {marksEntryStatusLabels[row.session?.status ?? "not-started"]}
              </Badge>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Nothing matches this filter.</p>}
      </div>
    </div>
  );
}
