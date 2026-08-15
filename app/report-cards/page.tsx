"use client";

// Report Cards hub (Phase 8D) — real PostgreSQL/API cutover. A report card is a
// PRESENTATION of an already-published, immutable exam result (Phase 8C); there
// is no separate "generate"/"publish" lifecycle and no template system here — a
// published exam's results ARE its students' official report cards. This page
// lists every exam whose results have been published; pick one to see its
// student roster, then open a student's card to view/print it.
import Link from "next/link";
import { FileText, GraduationCap, Users } from "lucide-react";
import { ReportCardStackIllustration } from "@/components/report-cards/report-card-stack-illustration";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useReportCardExams } from "@/lib/hooks/api/use-report-cards-api";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function ReportCardsHubPage() {
  const { can } = usePermissions();
  const { data: exams, loading, error } = useReportCardExams();

  if (!can("results.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view report cards.</p>;
  }
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>;

  const totalStudents = exams.reduce((sum, e) => sum + e.studentCount, 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Report cards</h1>
        <p className="text-xs text-muted-foreground">Official report cards, drawn from each exam&apos;s published results</p>
      </div>

      {exams.length > 0 && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
          <StatTile label="Published exams" value={String(exams.length)} icon={GraduationCap} tone="info" />
          <StatTile label="Students covered" value={String(totalStudents)} icon={Users} tone="success" />
          <StatTile label="Report card layout" value="Standard" icon={FileText} tone="neutral" />
        </div>
      )}

      {exams.length === 0 ? (
        <div className="flex flex-col items-center gap-md rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ReportCardStackIllustration />
          <div className="mx-auto flex w-full max-w-[400px] min-w-0 flex-col gap-1.5">
            <p className="text-sm font-semibold text-foreground">No report cards available yet</p>
            <p className="text-sm text-muted-foreground">
              Report cards become available once an exam&apos;s results are published. Publish results from the exam&apos;s Results page to see them here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {exams.map((e) => (
            <Link
              key={e.examId}
              href={`/report-cards/${e.examId}`}
              className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{e.examName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.examCode} · {e.termName} · {formatDate(e.startsOn)} – {formatDate(e.endsOn)}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> {e.studentCount} student{e.studentCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Published {formatDateTime(e.publishedAt)}{e.publishedByName ? ` by ${e.publishedByName}` : ""}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
