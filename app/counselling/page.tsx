"use client";

// Counselling hub (Phase 9S) — real PostgreSQL/API cutover for stat tiles.
// Resources stays mock (deferred — a static content library, no clinical
// record; out of scope for this phase — see route-mock-guard.test.ts).
import Link from "next/link";
import { BookOpen, CalendarClock, Gauge, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCounselingDashboard } from "@/lib/hooks/api/use-counseling-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function CounsellingHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: dashboard } = useCounselingDashboard();
  if (!capabilitiesLoading && !hasServerPermission("counseling.view")) return <PermissionDenied action="view counselling" role={roleLabels[role]} backHref="/campus-life" />;
  const s = dashboard ?? { sessionsToday: 0, totalOpenCases: 0, totalActiveCases: 0, unassignedCases: 0 };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Counselling</h1><p className="text-xs text-muted-foreground">Administrative case tracking only — confidential content stays with counsellors</p></div>
        <Button asChild size="sm"><Link href="/counselling/dashboard"><Gauge className="size-3.5" /> Dashboard</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Sessions today" value={String(s.sessionsToday)} icon={CalendarClock} tone="neutral" />
        <StatTile label="Open cases" value={String(s.totalOpenCases)} tone="info" />
        <StatTile label="Active cases" value={String(s.totalActiveCases)} tone="neutral" />
        <StatTile label="Unassigned" value={String(s.unassignedCases)} tone={s.unassignedCases > 0 ? "warning" : "success"} />
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link href="/counselling/appointments" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarClock className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Cases</p><p className="text-xs text-muted-foreground">Referrals and status</p></div></Link>
        <Link href="/counselling/resources" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><BookOpen className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Resources</p><p className="text-xs text-muted-foreground">Student wellbeing library</p></div></Link>
        <Link href="/counselling/dashboard" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><HandHeart className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Command Centre</p><p className="text-xs text-muted-foreground">Overview</p></div></Link>
      </div>
    </div>
  );
}
