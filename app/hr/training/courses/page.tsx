"use client";

import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { trainingCategoryLabels, type TrainingStatus } from "@/lib/types/hr";
import { formatDate } from "@/lib/utils";

const tone: Record<TrainingStatus, "success" | "warning" | "info" | "neutral"> = {
  draft: "neutral",
  scheduled: "info",
  "in-progress": "warning",
  completed: "success",
  cancelled: "neutral",
};

export default function TrainingCoursesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view training courses" role={roleLabels[role]} backHref="/hr/training" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Training courses</h1>
        <p className="text-xs text-muted-foreground">{db.trainingCourses.length} courses</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.trainingCourses.map((c) => {
          const enrolled = db.trainingEnrollments.filter((e) => e.courseId === c.id).length;
          return (
            <div key={c.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="flex items-center gap-sm">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><GraduationCap className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{trainingCategoryLabels[c.category]} · {c.trainer}</p>
                  </div>
                </div>
                <Badge tone={tone[c.status]}>{c.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-xs text-xs text-muted-foreground">
                <span>{c.deliveryType}</span>·<span>{c.durationHours}h</span>·<span>{formatDate(c.startDate)}</span>·<span>{enrolled}/{c.capacity} enrolled</span>
                {c.mandatory && <Badge tone="warning">Mandatory</Badge>}
                {c.hasCertificate && <Badge tone="success">Certificate</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
