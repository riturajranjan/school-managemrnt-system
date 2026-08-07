"use client";

import Link from "next/link";
import { CalendarClock, GraduationCap, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { trainingCategoryLabels } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

export default function TrainingPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view training" role={roleLabels[role]} backHref="/hr" />;

  const enrollments = db.trainingEnrollments;
  const completed = enrollments.filter((e) => e.status === "completed").length;
  const overdue = enrollments.filter((e) => e.status === "overdue").length;
  const upcoming = db.trainingCourses.filter((c) => c.status === "scheduled");
  const mandatory = db.trainingCourses.filter((c) => c.mandatory);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Training & development</h1>
          <p className="text-xs text-muted-foreground">Courses, enrollments and certificates</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/training/courses"><ListChecks className="size-3.5" /> Courses</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/training/calendar"><CalendarClock className="size-3.5" /> Calendar</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Courses" value={String(db.trainingCourses.length)} icon={GraduationCap} tone="neutral" />
        <StatTile label="Mandatory" value={String(mandatory.length)} icon={GraduationCap} tone="info" />
        <StatTile label="Completed" value={String(completed)} icon={GraduationCap} tone="success" />
        <StatTile label="Overdue" value={String(overdue)} icon={GraduationCap} tone={overdue > 0 ? "warning" : "success"} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Upcoming sessions</h2>
        {upcoming.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">No sessions scheduled.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {upcoming.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{trainingCategoryLabels[c.category]} · {formatDate(c.startDate)} · {c.durationHours}h</p>
                </div>
                {c.mandatory && <Badge tone="warning">Mandatory</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
