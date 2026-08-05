import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import type { Student } from "@/lib/types/students";
import { formatDate } from "@/lib/utils";
import { Award, TrendingDown, TrendingUp } from "lucide-react";

export function AcademicsTab({ student }: { student: Student }) {
  const { academics } = student;
  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Overall" value={`${academics.overallPercent}%`} icon={academics.trend === "up" ? TrendingUp : TrendingDown} tone={academics.overallPercent >= 60 ? "success" : "warning"} />
        <StatTile label="Class rank" value={academics.classRank ? `${academics.classRank} / ${academics.classSize}` : "—"} icon={Award} tone="info" />
        <StatTile label="Trend" value={academics.trend} tone={academics.trend === "up" ? "success" : academics.trend === "down" ? "error" : "neutral"} />
        <StatTile label="At-risk subjects" value={String(academics.subjectsAtRisk.length)} tone={academics.subjectsAtRisk.length > 0 ? "warning" : "success"} />
      </div>

      {academics.subjectsAtRisk.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {academics.subjectsAtRisk.map((s) => (
            <Badge key={s} tone="warning">
              {s} needs attention
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-sm">
        <h3 className="mb-xs text-sm font-semibold text-foreground">Upcoming exams</h3>
        {academics.upcomingExams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exams scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-foreground">
            {academics.upcomingExams.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>{e.subject}</span>
                <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h3 className="mb-xs text-sm font-semibold text-foreground">Homework</h3>
        {academics.recentHomework.length === 0 ? (
          <p className="text-sm text-muted-foreground">No homework recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {academics.recentHomework.map((hw) => (
              <li key={hw.id} className="flex items-center justify-between">
                <span className="text-foreground">
                  {hw.subject}: {hw.title}
                </span>
                <Badge tone={hw.status === "submitted" ? "success" : hw.status === "late" ? "error" : "warning"}>{hw.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
