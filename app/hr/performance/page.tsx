"use client";

import Link from "next/link";
import { Award, MessagesSquare, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { reviewStageLabels } from "@/lib/types/hr";

export default function PerformancePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view performance" role={roleLabels[role]} backHref="/hr" />;

  const activeCycles = db.performanceCycles.filter((c) => c.status === "active");
  const reviewsDue = db.performanceReviews.filter((r) => r.stage !== "completed");
  const completed = db.performanceReviews.filter((r) => r.stage === "completed");
  const goalsActive = db.performanceGoals.filter((g) => g.status === "active" || g.status === "at-risk");
  const goalsAvg = db.performanceGoals.length ? Math.round(db.performanceGoals.reduce((s, g) => s + g.progress, 0) / db.performanceGoals.length) : 0;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Performance</h1>
          <p className="text-xs text-muted-foreground">Development-focused reviews, goals and feedback</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/appraisals"><Award className="size-3.5" /> Appraisals</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/goals"><Target className="size-3.5" /> Goals</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/feedback"><MessagesSquare className="size-3.5" /> Feedback</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active cycles" value={String(activeCycles.length)} icon={Award} tone="info" />
        <StatTile label="Reviews due" value={String(reviewsDue.length)} icon={Award} tone={reviewsDue.length > 0 ? "warning" : "success"} />
        <StatTile label="Completed" value={String(completed.length)} icon={Award} tone="success" />
        <StatTile label="Avg goal progress" value={`${goalsAvg}%`} icon={Target} tone="neutral" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Active cycles</h2>
        <div className="flex flex-col gap-sm">
          {activeCycles.map((c) => {
            const cReviews = db.performanceReviews.filter((r) => r.cycleId === c.id);
            const cDone = cReviews.filter((r) => r.stage === "completed").length;
            return (
              <Link key={c.id} href="/hr/appraisals" className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{cDone}/{cReviews.length} reviews completed</p>
                </div>
                <Badge tone="info">Active</Badge>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Reviews needing action</h2>
        {reviewsDue.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">All reviews are complete.</p>
        ) : (
          <div className="flex flex-col gap-xs">
            {reviewsDue.slice(0, 8).map((r) => {
              const e = db.employees.find((x) => x.id === r.employeeId);
              return (
                <div key={r.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                  <Link href={`/hr/staff/${r.employeeId}`} className="min-w-0 truncate text-foreground hover:underline">{e ? `${e.firstName} ${e.lastName}` : r.employeeId}</Link>
                  <Badge tone="warning">{reviewStageLabels[r.stage]}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Note: {goalsActive.length} active goals. Performance data is presented for development and structured review — never as a public ranking.</p>
    </div>
  );
}
