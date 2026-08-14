"use client";

// Attendance hub (Phase 5B) — same visual design as before (stat tiles, quick-nav
// cards, unmarked-sections banner, Rules drawer) now fully PostgreSQL/API-backed
// via /api/attendance/dashboard. No mock store, no localStorage, no seeded numbers.
// The Rules drawer is READ-ONLY: it displays the effective server-side attendance
// policy (Phase 5B defaults). Persistent, school-configurable rules are deferred
// to a dedicated settings phase.
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardCheck, Settings2, TrendingDown, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAttendanceDashboard } from "@/lib/hooks/api/use-attendance";

export default function AttendanceHubPage() {
  const { data: dashboard, loading, error } = useAttendanceDashboard();
  const { can } = usePermissions();
  const [rulesOpen, setRulesOpen] = useState(false);

  const shortageThreshold = dashboard?.policy.shortageThresholdPct ?? 75;
  const consecutiveThreshold = dashboard?.policy.consecutiveAbsenceThreshold ?? 3;
  const pending = dashboard?.pendingSections ?? 0;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Attendance</h1>
          <p className="text-xs text-muted-foreground">School-wide attendance overview</p>
        </div>
        <div className="flex flex-wrap gap-xs">
          {can("attendance.configureRules") && (
            <Button size="sm" variant="outline" onClick={() => setRulesOpen(true)}>
              <Settings2 className="size-3.5" />
              Rules
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/attendance/reports">Reports</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/attendance/students">Mark attendance</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-error/30 bg-error/10 px-sm py-sm text-xs text-error">{error}</p>
      ) : null}

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Present today" value={`${dashboard?.presentTodayPct ?? 0}%`} icon={ClipboardCheck} tone="success" />
        <StatTile label="Late arrivals" value={String(dashboard?.lateToday ?? 0)} icon={CalendarClock} tone="warning" />
        <StatTile label="Below minimum" value={String(dashboard?.belowMinimumCount ?? 0)} icon={TrendingDown} tone="error" hint={`< ${shortageThreshold}%`} />
        <StatTile label="Consecutive-absence risk" value={String(dashboard?.consecutiveAbsenceRiskCount ?? 0)} icon={AlertTriangle} tone="error" />
      </section>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Link href="/attendance/students" className="rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
          <Users className="mb-1 size-5 text-info" />
          <p className="text-sm font-medium text-foreground">Student attendance</p>
          <p className="text-xs text-muted-foreground">Mark daily or period attendance</p>
        </Link>
        <Link href="/attendance/staff" className="rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
          <UserCog className="mb-1 size-5 text-info" />
          <p className="text-sm font-medium text-foreground">Staff attendance</p>
          <p className="text-xs text-muted-foreground">Check-in status and corrections</p>
        </Link>
        <Link href="/attendance/leave" className="rounded-lg border border-border bg-surface p-sm hover:bg-surface-secondary/60">
          <CalendarClock className="mb-1 size-5 text-info" />
          <p className="text-sm font-medium text-foreground">Leave management</p>
          <p className="text-xs text-muted-foreground">Requests and approvals</p>
        </Link>
      </div>

      {!loading && pending > 0 && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-warning/30 bg-warning/10 px-sm py-sm text-xs text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{pending} section(s) haven&apos;t marked attendance today.</span>
        </div>
      )}

      <DetailDrawer open={rulesOpen} onOpenChange={setRulesOpen} title="Attendance rules" description="Effective attendance policy applied across alerts and reports">
        <div className="flex flex-col gap-md">
          <div className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Minimum attendance percentage</p>
              <p className="text-xs text-muted-foreground">Below this, a student is flagged as attendance-risk.</p>
            </div>
            <div className="flex shrink-0 items-center gap-xs">
              <span className="text-sm font-semibold text-foreground">{shortageThreshold}</span>
              <span className="text-xs text-muted-foreground">percent</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Consecutive absence rule</p>
              <p className="text-xs text-muted-foreground">Consecutive absences before a student is flagged at-risk.</p>
            </div>
            <div className="flex shrink-0 items-center gap-xs">
              <span className="text-sm font-semibold text-foreground">{consecutiveThreshold}</span>
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </div>
          <Label className="text-xs text-muted-foreground">These are the current system-default attendance rules. School-configurable rules arrive with a future School Settings release.</Label>
        </div>
      </DetailDrawer>
    </div>
  );
}
